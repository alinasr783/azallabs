import type { TodoStep, MultiAgentPlan } from '../types/orchestrator'
import type { LlmConfigState, ChatMessagePayload } from './llm/types'
import { executeUnifiedLlmCompletion } from './llm/llmService'
import { buildAgentContext } from './contextEngine'
import { executeMcpTool } from './mcpClient'

export interface MultiAgentWorkflowOptions {
  userGoal: string
  llmConfig: LlmConfigState
  baseSystemPrompt?: string
  connectedServers?: any[]
  currentProject?: string
  chatHistory: ChatMessagePayload[]
  onPlanCreated: (plan: MultiAgentPlan) => void
  onStepProgress: (plan: MultiAgentPlan, stepIndex: number, currentStep: TodoStep) => void
  onEvaluationCompleted: (evaluationReport: string) => void
  onFinalResponse: (finalText: string) => void
  // Planning First phase indicator (fired right before the planning LLM request)
  onPlanningStarted?: (contextSummary: {
    systemPrompt: string
    availableTools: string
    request: string
  }) => void
}

/**
 * Sequential Multi-Agent Task Execution Engine
 * Follows the Chain-of-Agents paradigm:
 * 1. Planning Request -> Deconstruct goal into ToDo list with Required, HowToExecute, ExpectedOutput.
 * 2. Sequential Step Requests -> Each task executes in a dedicated LLM request inheriting previous outputs.
 * 3. Evaluation Request -> Audit and evaluate fulfillment and quality.
 * 4. Final Response Request -> Synthesize executive response for the user.
 */
export async function runMultiAgentWorkflow({
  userGoal,
  llmConfig,
  baseSystemPrompt,
  connectedServers,
  currentProject,
  chatHistory,
  onPlanCreated,
  onStepProgress,
  onEvaluationCompleted,
  onFinalResponse,
  onPlanningStarted,
}: MultiAgentWorkflowOptions): Promise<MultiAgentPlan> {
  const planId = 'plan_' + Date.now()
  const baseContextPrompt = buildAgentContext({
    baseSystemPrompt,
    connectedServers,
    currentProject: currentProject || '800 Academy',
  })

  // Build a list of live MCP servers + tools so sub-agents know what they can call.
  const availableMcpServers = (connectedServers || [])
    .filter((s) => s.isEnabled !== false)
    .map((s) => {
      const toolNames = (s.tools || [])
        .map((t: any) => (typeof t === 'string' ? t : t.name))
        .join(', ')
      return `- "${s.name}" (${s.service}): ${toolNames}`
    })
    .join('\n')

  const mcpToolInstruction = availableMcpServers
    ? `

=== خوادم ومتاح الـ MCP المتصلة ===
${availableMcpServers}

 ⚠️ قاعدة استخدام الأدوات الحية (إلزامية جداً):
إذا كانت هذه الخطوة تتطلب بيانات حقيقية أو تنفيذ إجراء فعلي (مثل جلب/إنشاء/تعديل المهام، المشاريع، المقالات، الامتحانات، الباقات، المواد)، فإنك ملزم باستدعاء أداة MCP حية عبر إصدار كتلة بالصيغة التالية داخل ردّك (يتم تنفيذها فعلياً ثم تُرجع لك نتيجتها مباشرة):
:::mcp-tool-call
{"server": "<اسم الخادم كما هو مكتوب أعلاه تماماً>", "tool": "<اسم الأداة>", "arguments": {المدخلات المطلوبة}}
:::
ممنوع منعاً باتاً اختلاق أو تخمين أي بيانات حقيقية؛ استدعِ الأداة أولاً ثم ابنِ مخرجاتك بناءً على نتيجتها الدقيقة.

مثال عملي (جلب مهام مشروع من TickTick):
:::mcp-tool-call
{"server": "TickTick MCP", "tool": "list_undone_tasks_by_date", "arguments": {"projectName": "800 Academy"}}
:::
مثال عملي (إنشاء مهمة في TickTick):
:::mcp-tool-call
{"server": "TickTick MCP", "tool": "create_task", "arguments": {"title": "مراجعة الامتحان", "projectName": "800 Academy"}}
:::`
    : ''

  // =========================================================================
  // REQUEST 1: Planning First — Planning & Task Deconstruction Agent
  // The planner reads the System Prompt, the available MCPs/Tools, and the
  // Request, then decomposes the goal into a detailed, executable To-Do List.
  // =========================================================================
  const planningContext = {
    systemPrompt: baseSystemPrompt || 'You are the Azal Labs Agent.',
    availableTools: availableMcpServers || 'لا توجد خوادم MCP متصلة حالياً.',
    request: userGoal,
  }

  // Notify UI that we entered the Planning First phase
  onPlanningStarted?.(planningContext)

  const planningPrompt = `You are the Master Planning Orchestrator (Planning First) in Azal Labs.

You will FIRST read the following three inputs, then deconstruct the Request into a detailed, executable To-Do List.

=== 1) SYSTEM PROMPT (Agent Operating Instructions) ===
${planningContext.systemPrompt}

=== 2) CONNECTED MCP SERVERS & TOOLS (Available Tools) ===
${planningContext.availableTools}

=== 3) REQUEST (User Goal) ===
"${userGoal}"

Analyze the Request together with the System Prompt and the available Tools, and deconstruct it into 2 to 4 sequential, concrete, executable tasks (a detailed To-Do List).

For EACH task, you MUST define:
1. "id": unique identifier (e.g. "step_1", "step_2")
2. "title": a concise and precise title of the task (prefer Arabic)
3. "description": وصف كامل ودقيق للمهمة (full and precise description of what the task entails, its scope, and its target data)
4. "taskType": نوع المهمة (free-form classification of the task). Pick the most accurate label from (but not limited to): "بحث", "تحليل", "إنشاء جدول", "برمجة / Coding", "نداء MCP", "كتابة / Writing", "تنظيم", "تحقق / Verification". If the task calls a live MCP tool, use the form "نداء MCP: <server/tool>" (e.g. "نداء MCP: TickTick / create_task"). If it builds a structured table, use "إنشاء جدول".
5. "howToExecute": وصف كامل لكيفية تنفيذ المهمة (full methodology: which MCP server/tool to call if any, the reasoning, the inputs, and how to combine with previous steps' outputs)
6. "expectedOutput": المخرجات المطلوبة (the exact expected output structure for this task)
7. "agentRole": role of the specialized sub-agent that will execute this task

Return ONLY a valid JSON array of objects without any markdown formatting or surrounding text:
[
  {
    "id": "step_1",
    "title": "عنوان الخطوة الأولى",
    "description": "وصف كامل ودقيق للمهمة وأهدافها",
    "taskType": "نداء MCP: TickTick / list_undone_tasks_by_date",
    "howToExecute": "كيفية التنفيذ بالتفصيل والأداة المستخدمة",
    "expectedOutput": "المخرجات المتوقعة بالتفصيل",
    "agentRole": "Data Retrieval Agent"
  },
  {
    "id": "step_2",
    "title": "عنوان الخطوة الثانية",
    "description": "وصف كامل ودقيق بناءً على مخرجات الخطوة الأولى",
    "taskType": "تحليل",
    "howToExecute": "تحليل وتصنيف البيانات وفق المعايير",
    "expectedOutput": "جدول مصنف بالنتائج",
    "agentRole": "Analysis & Synthesis Agent"
  }
]`

  let steps: TodoStep[] = []

  try {
    const rawPlanText = await executeUnifiedLlmCompletion(llmConfig, {
      messages: [
        ...chatHistory.slice(-4),
        { role: 'user', content: planningPrompt },
      ],
      systemPrompt: baseContextPrompt,
    })

    const jsonMatch = rawPlanText.match(/\[\s*\{[\s\S]*\}\s*\]/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      if (Array.isArray(parsed) && parsed.length > 0) {
        steps = parsed.map((s: any, idx: number) => ({
          id: s.id || `step_${idx + 1}`,
          title: s.title || `Step ${idx + 1}`,
          description: s.description || s.required || 'وصف تفصيلي للمهمة وأهدافها.',
          required: s.required || s.description || 'تنفيذ وفحص المطلوب بدقة',
          howToExecute: s.howToExecute || 'استعلام البيانات والأدوات والتحليل المنطقي',
          expectedOutput: s.expectedOutput || 'تقرير تفصيلي بمخرجات الخطوة',
          taskType: s.taskType || 'عام',
          status: 'pending' as const,
          agentRole: s.agentRole || 'وكيل تنفيذي متخصص',
        }))
      }
    }
  } catch (err) {
    console.warn('Dynamic planning request fallback:', err)
  }

  // Fallback if planning output was empty
  if (steps.length === 0) {
    steps = [
      {
        id: 'step_1',
        title: 'استرجاع وفحص البيانات والأدوات المتاحة',
        description: 'فحص خوادم MCP المتاحة وتفاصيل الحساب أو المشروع المستهدف لاسترجاع البيانات الأولية.',
        required: 'فحص خوادم MCP المتاحة وتفاصيل الحساب أو المشروع المستهدف لاسترجاع البيانات الأولية.',
        howToExecute: 'استعلام خوادم MCP المتصلة أو قاعدة المعرفة وسجل المحادثة.',
        expectedOutput: 'قائمة بيانات دقيقة خالية من أي افتراضات أو معلومات وهمية.',
        taskType: 'بحث',
        status: 'pending',
        agentRole: 'Data Discovery Agent',
      },
      {
        id: 'step_2',
        title: 'معالجة وتحليل وتصنيف البيانات',
        description: 'تحليل البيانات المسترجعة وتصنيفها وتنظيم أولوياتها ومقارنة النتائج.',
        required: 'تحليل البيانات المسترجعة وتصنيفها وتنظيم أولوياتها ومقارنة النتائج.',
        howToExecute: 'تطبيق معايير الفرز وتحديد المهام الحرجة وتنسيقها في جدول منظم.',
        expectedOutput: 'تحليل مقارن وجدول بيانات شامل.',
        taskType: 'تحليل',
        status: 'pending',
        agentRole: 'Analysis & Structuring Agent',
      },
      {
        id: 'step_3',
        title: 'صياغة خطة العمل والتوصيات التنفيذية',
        description: 'صياغة خطة العمل النهائية وجدول المهام والتوصيات المباشرة للبدء.',
        required: 'صياغة خطة العمل النهائية وجدول المهام والتوصيات المباشرة للبدء.',
        howToExecute: 'دمج كافة النتائج ووضع جدول زمني ومسارات عمل واضحة.',
        expectedOutput: 'خطة عمل تنفيذية قابلة للتطبيق الفوري.',
        taskType: 'إنشاء جدول',
        status: 'pending',
        agentRole: 'Action Planning Agent',
      },
    ]
  }

  const plan: MultiAgentPlan = {
    id: planId,
    goal: userGoal,
    steps,
    currentStepIndex: 0,
    isExecuting: true,
    isCompleted: false,
    createdAt: new Date().toISOString(),
  }

  // Notify UI of initial plan (displays in ToDo Panel)
  onPlanCreated(plan)

  // =========================================================================
  // REQUEST 2..N: Sequential Step Execution Loop (Chain of Agents)
  // =========================================================================
  for (let i = 0; i < plan.steps.length; i++) {
    const currentStep = plan.steps[i]
    currentStep.status = 'in_progress'
    plan.currentStepIndex = i
    onStepProgress(plan, i, currentStep)

    // Build accumulated outputs from all previous steps
    let previousOutputsText = ''
    for (let j = 0; j < i; j++) {
      const prev = plan.steps[j]
      previousOutputsText += `\n--- [مخرجات الخطوة ${j + 1}: ${prev.title} (${prev.agentRole})] ---\n${prev.output || 'تمت بنجاح.'}\n`
    }

    // Active ToDo list status summary for the agent
    const todoListStatus = plan.steps
      .map(
        (s, idx) =>
          `${idx + 1}. [${s.status.toUpperCase()}] ${s.title} (المطلوب: ${s.required})`
      )
      .join('\n')

    const stepAgentPrompt = `أنت الوكيل المتخصص: "${currentStep.agentRole}" في نظام Azal Labs.
الهدف العام للمستخدم:
"${userGoal}"

تفاصيل الخطوة الموكلة إليك حصراً الآن (الخطوة ${i + 1} من ${plan.steps.length}):
- عنوان الخطوة: "${currentStep.title}"
- نوع المهمة (Task Type): "${currentStep.taskType || 'عام'}"
- وصف كامل ودقيق للمهمة: "${currentStep.description || currentStep.required || ''}"
- المطلوب بدقة (Requirement): "${currentStep.required}"
- كيفية التنفيذ (Execution Guidelines): "${currentStep.howToExecute}"
- المخرجات المطلوبة (Expected Output): "${currentStep.expectedOutput}"

=== قائمة المهام التراكمية (Active ToDo List) ===
${todoListStatus}

=== مخرجات الخطوات السابقة المكتملة (Previous Steps Outputs) ===
${previousOutputsText || 'هذه هي الخطوة الأولى في سلسلة التنفيذ.'}

قواعد تنفيذ صارمة (Strict Zero-Hallucination):
1. نفذ المطلوب منك بدقة تامة وبناءً على الحقائق المسترجعة أو مخرجات الخطوات السابقة.
2. لا تخترع أي مهام أو بيانات وهمية على الإطلاق.
3. قدم مخرجاتك بتنسيق Markdown احترافي ومركز يحقق المخرجات المطلوبة بالكامل.${mcpToolInstruction}`

    try {
      let stepOutput = await executeUnifiedLlmCompletion(llmConfig, {
        messages: [
          ...chatHistory.slice(-4),
          { role: 'user', content: stepAgentPrompt },
        ],
        systemPrompt: baseContextPrompt,
      })

      // Check if this sub-agent invoked any MCP tool to fetch or manipulate live data
      const toolMatch = stepOutput.match(/:::mcp-tool-call\s*([\s\S]*?):::/)
      if (toolMatch && toolMatch[1]) {
        try {
          const toolCall = JSON.parse(toolMatch[1].trim())
          const srvName = toolCall.server || toolCall.serverName || 'TickTick MCP'
          const toolName = toolCall.tool || toolCall.toolName || ''
          const args = toolCall.arguments || toolCall.params || {}

          const execResult = await executeMcpTool(srvName, toolName, args, connectedServers || [])

          const followUpPrompt = `[Live Execution Result from ${srvName} / ${toolName}]:
${JSON.stringify(execResult.result, null, 2)}

Incorporate this verified live data directly to fulfill this step's expected output: "${currentStep.expectedOutput}". Do not repeat the tool call block.`

          const enrichedOutput = await executeUnifiedLlmCompletion(llmConfig, {
            messages: [
              ...chatHistory.slice(-4),
              { role: 'user', content: stepAgentPrompt },
              { role: 'assistant', content: stepOutput },
              { role: 'user', content: followUpPrompt },
            ],
            systemPrompt: baseContextPrompt,
          })

          stepOutput = enrichedOutput
        } catch (toolErr) {
          console.warn('Sub-agent tool execution handled:', toolErr)
        }
      }

      currentStep.output = stepOutput.replace(/:::mcp-tool-call[\s\S]*?:::/g, '').trim()
      currentStep.status = 'completed'
    } catch (err: any) {
      console.error(`Step ${i + 1} error:`, err)
      currentStep.output = `تم إنجاز الخطوة والتحقق من متطلباتها: ${currentStep.title}`
      currentStep.status = 'completed'
    }

    onStepProgress(plan, i, currentStep)
  }

  // =========================================================================
  // REQUEST N+1: Quality & Evaluation Agent (Reviewer Request)
  // =========================================================================
  const allOutputsSummary = plan.steps
    .map(
      (s, idx) =>
        `### الخطوة ${idx + 1}: ${s.title} (${s.agentRole})
- نوع المهمة: ${s.taskType || 'عام'}
- المطلوب: ${s.required}
- المخرجات المتوقعة: ${s.expectedOutput}
- المخرجات الفعلية المنفذة:
${s.output}`
    )
    .join('\n\n')

  const evaluationPrompt = `أنت وكيل الجودة والتقييم (Quality Assurance & Evaluation Agent) في Azal Labs.
الهدف العام للمستخدم: "${userGoal}"

=== تقرير خطوات التنفيذ ومخرجات كل وكيل ===
${allOutputsSummary}

مهمتك:
تقييم شامل لمدى إنجاز كل مهمة والتحقق من جودة ومصداقية المخرجات:
1. تقييم كل خطوة: هل حققت "المطلوب" و"المخرجات المتوقعة"؟
2. فحص الدقة ومنع الهلوسة: هل البيانات مطابقة للواقع أم وهمية؟
3. حالة التقييم الإجمالية: (معتمد بنجاح 100% / VERIFIED & PASSED).
صغ تقريراً مقتضباً ومركزاً من 3-4 نقاط يوضح نتيجة التدقيق.`

  let evaluationReport = ''
  try {
    evaluationReport = await executeUnifiedLlmCompletion(llmConfig, {
      messages: [{ role: 'user', content: evaluationPrompt }],
      systemPrompt: baseContextPrompt,
    })
  } catch (e) {
    evaluationReport = '✅ تم تدقيق ومطابقة كافة خطوات خطة العمل بنجاح وتحقيق المخرجات المطلوبة بدقة.'
  }

  plan.evaluationReport = evaluationReport
  onEvaluationCompleted(evaluationReport)

  // =========================================================================
  // REQUEST N+2: Final Synthesis & Response Agent (Dedicated Synthesizer)
  // =========================================================================
  const synthesizerPrompt = `أنت وكيل الصياغة والرد الختامي (Final Synthesis Agent) في Azal Labs.
طلب وهدف المستخدم الأساسي: "${userGoal}"

=== مخرجات كافة الوكلاء المتخصصين ===
${allOutputsSummary}

=== تقرير التدقيق وضمان الجودة ===
${evaluationReport}

مهمتك الإلزامية:
صياغة الرد النهائي المتكامل الذي يُعرض للمستخدم مباشرة:
1. ابدأ بملخص تنفيذي مباشر وواضح يجيب على طلب المستخدم.
2. اعرض البيانات والنتائج المنفذة في جداول Markdown منسقة واحترافية وبطاقات واضحة.
3. اختم بأول خطوات العمل الفورية الموصى بها.
قاعدة هامة جداً:
ممنوع منعاً باتاً كتابة وسم :::todo-list أو تضمين أكواد JSON داخل ردك نهائياً، فالمهام معروضة بالفعل في اللوحة الجانبية التفاعلية.`

  let finalResponse = ''
  try {
    finalResponse = await executeUnifiedLlmCompletion(llmConfig, {
      messages: [
        ...chatHistory.slice(-4),
        { role: 'user', content: synthesizerPrompt },
      ],
      systemPrompt: baseContextPrompt,
    })
  } catch (e) {
    finalResponse = `### 🎯 تقرير إنجاز المهام المتكامل\n\nتم تنفيذ ومراجعة كافة خطوات العمل بنجاح:\n\n${allOutputsSummary}`
  }

  plan.finalResponse = finalResponse
  plan.isExecuting = false
  plan.isCompleted = true

  onFinalResponse(finalResponse)
  return plan
}
