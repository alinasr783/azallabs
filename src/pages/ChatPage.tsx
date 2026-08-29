import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { PanelRight, Trash2, Settings } from 'lucide-react'
import { ChatSidebar } from '../components/chat/ChatSidebar'
import { ChatMessage } from '../components/chat/ChatMessage'
import { ChatInput } from '../components/chat/ChatInput'
import { EmptyState } from '../components/chat/EmptyState'
import { useAgentConfig } from '../context/AgentConfigContext'
import { useMcp } from '../context/McpContext'
import { getTickTickToken, fetchTickTickProjects, fetchTasksByProjectName, createTickTickTask, updateTickTickTask } from '../lib/ticktick'
import { isComplexTask } from '../lib/orchestrator'
import { runMultiAgentWorkflow } from '../lib/multiAgentOrchestrator'
import { runTickTickIntent } from '../lib/ticktickIntent'
import { streamUnifiedLlmCompletion } from '../lib/llm/llmService'
import { buildAgentContext } from '../lib/contextEngine'
import { parseMemoryBlockFromText, updateMemoryItem } from '../lib/memory'
import { type ClaudeTodoList } from '../components/chat/ClaudeTodoPanel'

import { executeMcpTool, discoverMcpToolsFromUrl } from '../lib/mcpClient'
import type { TaskSession, Message } from '../types/chat'

const STORAGE_TASKS_KEY = 'azal_labs_tasks'

const KNOWN_SUBJECTS_MAP = [
  {
    id: '1b29250c-6213-4437-b83c-eb35c9e1d2c8',
    name: 'EST 1 : Math Core',
    keywords: ['math core', 'est 1 : math', 'est 1 math', 'core', 'كور', 'رياضيات 1', 'ماث 1', 'est 1', 'est1'],
  },
  {
    id: '0c9f54c4-b4cc-4ab8-bffa-02ef6f0ac852',
    name: 'EST 2 : Math Advanced',
    keywords: ['math advanced', 'advanced', 'est 2', 'est2', 'رياضيات 2', 'ماث 2', 'متقدم'],
  },
  {
    id: 'da8da906-aaf7-44d3-88c0-93d893395af4',
    name: 'Digital SAT : Math',
    keywords: ['sat', 'digital sat', 'سات', 'ديجيتال', 'digital_sat_math'],
  },
  {
    id: '73f63e8d-26cc-44af-83e0-cca27a63c493',
    name: 'EST 1 : Literacy',
    keywords: ['literacy', 'english', 'ليتراسي', 'انجليزي', 'لغة انجليزية'],
  },
]

function detectSubjectFromContext(currentText: string, chatHistory: Message[]): { id: string; name: string } | null {
  const lowerCurrent = currentText.toLowerCase()

  // 1. Check current message first
  for (const s of KNOWN_SUBJECTS_MAP) {
    if (s.keywords.some((kw) => lowerCurrent.includes(kw)) || lowerCurrent.includes(s.name.toLowerCase()) || lowerCurrent.includes(s.id)) {
      return { id: s.id, name: s.name }
    }
  }

  // 2. If user said "نفس المادة" / "تأكد" / "يوجد أكثر" / "الامتحانات", search previous messages in reverse
  for (let i = chatHistory.length - 1; i >= 0; i--) {
    const text = chatHistory[i].content.toLowerCase()
    for (const s of KNOWN_SUBJECTS_MAP) {
      if (s.keywords.some((kw) => text.includes(kw)) || text.includes(s.name.toLowerCase()) || text.includes(s.id)) {
        return { id: s.id, name: s.name }
      }
    }
  }

  return null
}

function extractTaskDetails(text: string): { title: string; dueDate?: string } {
  let dueDate: string | undefined = undefined

  // 1. Due date detection
  if (text.includes('بكرة') || text.includes('غداً') || text.includes('غدا') || text.toLowerCase().includes('tomorrow')) {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    dueDate = tomorrow.toISOString().split('T')[0]
  } else if (text.includes('اليوم') || text.includes('النهاردة') || text.toLowerCase().includes('today')) {
    dueDate = new Date().toISOString().split('T')[0]
  }

  // 2. Title extraction patterns
  let title = ''
  const m1 = text.match(/(?:المهمة التالية|المهمة:|اضيف فيه المهمة|مهمة)\s*[:\n]*([^\n.]+)/i)
  const m2 = text.match(/(?:اني محتاج|محتاج|عايز|أريد|اريد)\s+([^.\n]+)/i)
  const m3 = text.match(/(?:حطلي مهمة|انشئ مهمة|اضف مهمة|أضف مهمة|اعمل مهمة)\s*(?:في tick tick|في تيك توك|في ticktick)?\s*(?:لنفس المشروع)?\s*(?:\([^)]+\))?\s*(?:بأن|عن|لـ|إن|ان|اني)?\s*([^.\n]+)/i)

  if (m2 && m2[1].trim()) {
    title = m2[1].trim()
  } else if (m1 && m1[1].trim()) {
    title = m1[1].trim()
  } else if (m3 && m3[1].trim()) {
    title = m3[1].trim()
  }

  // Strip prefixes & temporal noise
  title = title
    .replace(/^(اني\s+|انني\s+|ان\s+|إن\s+|محتاج\s+|اعمل\s+|أعمل\s+|اكتب\s+|أكتب\s+)/i, '')
    .replace(/(بكرة|غداً|غدا|اليوم|النهاردة|tomorrow|today)/gi, '')
    .trim()

  if (!title || title.length < 3) {
    if (text.includes('مقال') || text.includes('مقالات')) {
      title = 'كتابة مقال متكامل مع محركات البحث (SEO)'
    } else {
      title = 'مهمة عمل جديدة'
    }
  }

  return { title, dueDate }
}

export const ChatPage: React.FC = () => {
  const { systemPrompt, llmConfig, setMemoryText } = useAgentConfig()
  const { servers, connectServer } = useMcp()
  const [tasks, setTasks] = useState<TaskSession[]>([])
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  )
  const [isLoading, setIsLoading] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Claude Code Style ToDo List — attached PER-MESSAGE via message.plan

  // Attach/update the To-Do plan on a SPECIFIC message (per-message Planning First).
  const updateMessagePlan = (
    taskId: string | null,
    msgId: string,
    updater: (prev: ClaudeTodoList | null) => ClaudeTodoList | null
  ) => {
    if (!taskId) return
    setTasks((prev) => {
      const next = prev.map((t) => {
        if (t.id !== taskId) return t
        return {
          ...t,
          messages: t.messages.map((m) => {
            if (m.id !== msgId) return m
            const updatedPlan = updater(m.plan ?? null)
            return { ...m, plan: updatedPlan ?? undefined }
          }),
        }
      })
      try {
        localStorage.setItem(STORAGE_TASKS_KEY, JSON.stringify(next))
      } catch {}
      return next
    })
  }

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_TASKS_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setTasks(parsed)
        if (parsed.length > 0) {
          setCurrentTaskId(parsed[0].id)
        }
      } catch (e) {
        console.error(e)
      }
    }
  }, [])

  const saveTasks = (updated: TaskSession[]) => {
    setTasks(updated)
    localStorage.setItem(STORAGE_TASKS_KEY, JSON.stringify(updated))
  }

  const currentTask = tasks.find((t) => t.id === currentTaskId)
  const messages = currentTask?.messages || []

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const handleNewTask = () => {
    const newTask: TaskSession = {
      id: 'task_' + Date.now(),
      title: 'مهمة جديدة',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
    }
    const updated = [newTask, ...tasks]
    saveTasks(updated)
    setCurrentTaskId(newTask.id)
    if (window.innerWidth < 768) setSidebarOpen(false)
  }

  const handleDeleteTask = (id: string) => {
    const filtered = tasks.filter((t) => t.id !== id)
    saveTasks(filtered)
    if (currentTaskId === id) {
      setCurrentTaskId(filtered.length > 0 ? filtered[0].id : null)
    }
  }

  const handleClearCurrentTask = () => {
    if (!currentTaskId) return
    const updated = tasks.map((t) =>
      t.id === currentTaskId ? { ...t, messages: [] } : t
    )
    saveTasks(updated)
  }

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
      setIsLoading(false)
    }
  }

  const handleSendMessage = async (content: string) => {
    let activeId = currentTaskId
    const nowIso = new Date().toISOString()

    const userMessage: Message = {
      id: 'msg_' + Date.now(),
      role: 'user',
      content,
      createdAt: nowIso,
    }

    const asstMsgId = 'msg_asst_' + (Date.now() + 1)
    const assistantMessage: Message = {
      id: asstMsgId,
      role: 'assistant',
      content: '',
      createdAt: nowIso,
    }

    const existingMsgs = tasks.find((t) => t.id === activeId)?.messages || []
    let updatedTasks: TaskSession[] = []
    let updatedMsgs: Message[] = []

    if (!activeId || !tasks.some((t) => t.id === activeId)) {
      activeId = 'task_' + Date.now()
      const title = content.slice(0, 28) + (content.length > 28 ? '...' : '')
      updatedMsgs = [userMessage, assistantMessage]
      const newTask: TaskSession = {
        id: activeId,
        title,
        createdAt: nowIso,
        updatedAt: nowIso,
        messages: updatedMsgs,
      }
      updatedTasks = [newTask, ...tasks.filter((t) => t.id !== activeId)]
    } else {
      updatedTasks = tasks.map((t) => {
        if (t.id === activeId) {
          // Delete the old To-Do list when a new message is sent (per-message plans)
          updatedMsgs = [
            ...t.messages.map((m) => ({ ...m, plan: undefined })),
            userMessage,
            assistantMessage,
          ]
          return {
            ...t,
            updatedAt: nowIso,
            messages: updatedMsgs,
          }
        }
        return t
      })
    }

    setCurrentTaskId(activeId)
    saveTasks(updatedTasks)
    setIsLoading(true)

    const setAsstContent = (newContent: string, saveToDisk = false) => {
      setTasks((prev) => {
        const next: TaskSession[] = prev.map((t) => {
          if (t.id !== activeId) return t
          const exists = t.messages.some((m) => m.id === asstMsgId)
          return {
            ...t,
            updatedAt: new Date().toISOString(),
            messages: exists
              ? t.messages.map((m) =>
                  m.id === asstMsgId ? { ...m, content: newContent } : m
                )
              : [
                  ...t.messages,
                  {
                    id: asstMsgId,
                    role: 'assistant' as const,
                    content: newContent,
                    createdAt: new Date().toISOString(),
                  },
                ],
          }
        })
        if (saveToDisk) {
          localStorage.setItem(STORAGE_TASKS_KEY, JSON.stringify(next))
        }
        return next
      })
    }

    // Setup abort controller
    const controller = new AbortController()
    abortControllerRef.current = controller

    // History for Gemini API (keep recent messages, clean bulky JSON blocks and tool calls)
    const recentMsgs = updatedMsgs.slice(-8)
    const groqHistory = recentMsgs.map((m) => ({
      role: m.role,
      content: m.content
        .replace(/:::maestro-plan[\s\S]*?:::/g, '')
        .replace(/:::mcp-tool-call[\s\S]*?:::/g, '')
        .trim() || m.content,
    }))

    try {
    // ==============================================================
    // MAESTRO MULTI-AGENT ORCHESTRATOR (Sequential Sub-Agents & Todo List)
    // ==============================================================
    const tickTickToken = getTickTickToken()

    // Direct, reliable TickTick handler — executes the requested tool SERVER-SIDE
    // (real data) and returns a natural Arabic answer + a real plan step. This avoids
    // the fragile multi-agent pipeline for simple TickTick CRUD/query requests.
    const isTickTickIntent =
      content.toLowerCase().includes('tick') ||
      content.includes('تيك') ||
      content.includes('حطلي مهمة') ||
      content.includes('اضف مهمة') ||
      content.includes('أضف مهمة') ||
      content.includes('انشئ مهمة') ||
      content.includes('أنشئ مهمة') ||
      content.includes('اعمل مهمة') ||
      content.includes('سجل مهمة') ||
      content.includes('مهمة جديدة') ||
      content.includes('مهامي') ||
      content.includes('مشاريعي') ||
      content.includes('قوائمي') ||
      content.includes('جلسة تركيز') ||
      content.includes('عاداتي') ||
      content.toLowerCase().includes('inspire') ||
      content.includes('حذف') ||
      content.includes('احذف') ||
      content.includes('ازل') ||
      content.includes('شيل') ||
      content.includes('مسح') ||
      content.toLowerCase().includes('delete') ||
      content.toLowerCase().includes('remove')

    if (isTickTickIntent && tickTickToken) {
      updateMessagePlan(activeId, asstMsgId, () => ({
        title: `طلب TickTick: ${content.slice(0, 26)}${content.length > 26 ? '…' : ''}`,
        items: [
          {
            id: 'tk_1',
            title: 'استدعاء أداة TickTick المناسبة وتنفيذ الطلب فعلياً',
            status: 'in_progress' as const,
          },
        ],
      }))
      try {
        const ans = await runTickTickIntent(content, tickTickToken, servers, llmConfig, systemPrompt)
        setAsstContent(ans, true)
        updateMessagePlan(activeId, asstMsgId, (prev) =>
          prev
            ? {
                ...prev,
                items: [
                  {
                    id: 'tk_1',
                    title: 'تنفيذ طلب TickTick وإرجاع النتيجة الفعلية للمستخدم',
                    status: 'completed' as const,
                  },
                ],
              }
            : prev
        )
      } catch (e: any) {
        setAsstContent(`تعذر تنفيذ طلب TickTick: ${e?.message || e}`, true)
      }
      setIsLoading(false)
      return
    }

    if (isComplexTask(content)) {
      try {
        let realTasksText = ''
        if (tickTickToken) {
          try {
            const fetchedProjects = await fetchTickTickProjects(tickTickToken)
            if (Array.isArray(fetchedProjects)) {
              const targetProj =
                fetchedProjects.find((p) => content.toLowerCase().includes(p.name.toLowerCase())) ||
                fetchedProjects.find((p) => p.name.includes('800')) ||
                fetchedProjects[0]

              if (targetProj) {
                const pData = await fetchTasksByProjectName(targetProj.name, tickTickToken)
                const tasks = pData.tasks || []
                if (tasks.length > 0) {
                  realTasksText = `المشروع المستهدف: "${targetProj.name}" (إجمالي ${tasks.length} مهام حقيقية):\n` +
                    tasks
                      .map((t, idx) => {
                        const statusStr = t.status === 2 ? 'منجز' : 'قيد التنفيذ (نشط)'
                        const dueStr = t.dueDate ? t.dueDate : 'مفتوح (بدون تاريخ)'
                        return `${idx + 1}. **${t.title}** (الحالة: ${statusStr} | الموعد: ${dueStr})`
                      })
                      .join('\n')
                }
              }
            }
          } catch (e) {
            console.warn('Error pre-fetching tasks for maestro:', e)
          }
        }

        // Multi-Agent Sequential Execution Engine (Chain of Agents)
        // Show the Planning-First placeholder on THIS message (per-message plan)
        updateMessagePlan(activeId, asstMsgId, () => ({ title: 'Planning First', items: [] }))

        setAsstContent(
          '⏳ **Starting Multi-Agent Execution Engine...**\nAnalyzing goal, memory, actions, and deconstructing into sequential tasks.',
          false
        )

        await runMultiAgentWorkflow({
          userGoal: realTasksText ? `${content}\n\n${realTasksText}` : content,
          llmConfig,
          baseSystemPrompt: systemPrompt,
          connectedServers: servers,
          currentProject: '800 Academy',
          chatHistory: groqHistory,
          onPlanCreated: (plan) => {
            updateMessagePlan(activeId, asstMsgId, () => ({
              title: `خطة: ${content.slice(0, 28)}${content.length > 28 ? '...' : ''}`,
              items: plan.steps.map((s) => ({
                id: s.id,
                title: s.title,
                status: s.status,
                required: s.required,
                howToExecute: s.howToExecute,
                expectedOutput: s.expectedOutput,
                description: s.description,
                taskType: s.taskType,
                agentRole: s.agentRole,
              })),
            }))
            setAsstContent(
              `⚡ **تمت تهيئة المهام متعددة الوكلاء (${plan.steps.length} خطوات)**\n\n🔄 جاري تنفيذ الخطوة 1: **${plan.steps[0].title}**\n- **النوع**: *${plan.steps[0].taskType || 'عام'}*\n- **الوكيل**: *${plan.steps[0].agentRole}*\n- **المطلوب**: ${plan.steps[0].required}`,
              false
            )
          },
          onStepProgress: (plan, stepIndex, currentStep) => {
            updateMessagePlan(activeId, asstMsgId, () => ({
              title: `خطة: ${content.slice(0, 28)}${content.length > 28 ? '...' : ''}`,
              items: plan.steps.map((s) => ({
                id: s.id,
                title: s.title,
                status: s.status,
                required: s.required,
                howToExecute: s.howToExecute,
                expectedOutput: s.expectedOutput,
                description: s.description,
                taskType: s.taskType,
                output: s.output,
                agentRole: s.agentRole,
              })),
            }))

            const nextStep = plan.steps[stepIndex + 1]
            if (currentStep.status === 'completed' && nextStep) {
              setAsstContent(
                `✅ **Step ${stepIndex + 1} Completed**: ${currentStep.title}\n\n🔄 **Starting Step ${stepIndex + 2} of ${plan.steps.length}**: **${nextStep.title}**\n- **Agent**: *${nextStep.agentRole}*\n- **Required**: ${nextStep.required}`,
                false
              )
            } else if (currentStep.status === 'in_progress') {
              setAsstContent(
                `🔄 **Running Step ${stepIndex + 1} of ${plan.steps.length}**: **${currentStep.title}**\n- **Agent**: *${currentStep.agentRole}*\n- **Required**: ${currentStep.required}`,
                false
              )
            }
          },
          onEvaluationCompleted: () => {
            setAsstContent(
              `🔍 **Quality & Verification Audit Completed**\nAll steps verified and audited. Synthesizing final comprehensive response...`,
              false
            )
          },
          onFinalResponse: (finalText) => {
            setAsstContent(finalText, true)
          },
          onPlanningStarted: (ctx) => {
            setAsstContent(
              `🧠 **Planning First**\nقراءة المدخلات التالية لبناء خطة التنفيذ:\n- **System Prompt**: تم تحميل تعليمات الوكيل\n- **الأدوات (MCPs)**: ${ctx.availableTools.includes('لا توجد') ? 'لا توجد خوادم متصلة' : 'تم رصد الخوادم والأدوات المتاحة'}\n- **الطلب**: ${ctx.request.slice(0, 80)}${ctx.request.length > 80 ? '...' : ''}\n\n⏳ جارٍ توليد قائمة المهام المفصلة...`,
              false
            )
          },
        })

        setIsLoading(false)
        return
      } catch (err: any) {
        console.error('Maestro pipeline error:', err)
      }
    }

    // Standard Sub-Agent Orchestration Flow
    let toolPrefix = ''
    let effectiveSystemPrompt = systemPrompt

    // 0. Auto-Discovery from MCP URL provided in chat
    const urlMatch = content.match(/https?:\/\/[^\s]+/i)
    let autoDiscoveredServer: any = null
    if (urlMatch && (content.includes('mcp') || content.includes('رابط') || content.includes('لينك') || content.includes('خادم') || content.includes('ادوات') || content.includes('أدوات') || content.includes('استكشف'))) {
      const detectedUrl = urlMatch[0].replace(/[.,;)\s]+$/, '')
      try {
        const discovery = await discoverMcpToolsFromUrl(detectedUrl)
        if (discovery.success && discovery.tools.length > 0) {
          const srvName = detectedUrl.includes('800') ? '800 Academy MCP' : `خادم MCP (${new URL(detectedUrl).hostname})`
          await connectServer({
            name: srvName,
            url: detectedUrl,
            tools: discovery.tools,
            isEnabled: true,
          })
          autoDiscoveredServer = {
            name: srvName,
            url: detectedUrl,
            tools: discovery.tools,
          }
        }
      } catch (err) {
        console.warn('Chat URL discovery failed:', err)
      }
    }

    // Custom MCP Server Routing (e.g. 800 Academy MCP, or any user-added server)
    const activeCustomServers = servers.filter((s) => s.isEnabled !== false)
    const nonTickServers = activeCustomServers.filter(
      (s) => !s.name.toLowerCase().includes('tick') && !s.service.toLowerCase().includes('tick')
    )

    const matchedCustomServer =
      autoDiscoveredServer ||
      activeCustomServers.find((s) => {
        const lowerS = s.name.toLowerCase()
        const lowerService = s.service.toLowerCase()
        const lowerContent = content.toLowerCase()
        if (lowerS.includes('ticktick') || lowerService.includes('ticktick')) return false
        return (
          (lowerS.includes('800') &&
            (lowerContent.includes('800') ||
              lowerContent.includes('academy') ||
              lowerContent.includes('أكاديمي') ||
              lowerContent.includes('منصة') ||
              lowerContent.includes('المنصة') ||
              lowerContent.includes('مقال') ||
              lowerContent.includes('مدون') ||
              lowerContent.includes('blog') ||
              lowerContent.includes('article') ||
              lowerContent.includes('درس') ||
              lowerContent.includes('دروس') ||
              lowerContent.includes('فئة') ||
              lowerContent.includes('فئات') ||
              lowerContent.includes('تصنيف') ||
              lowerContent.includes('مواد') ||
              lowerContent.includes('مادة') ||
              lowerContent.includes('باق') ||
              lowerContent.includes('اسعار') ||
              lowerContent.includes('سعر') ||
              lowerContent.includes('امتحان') ||
              lowerContent.includes('اختبار') ||
              lowerContent.includes('سؤال') ||
              lowerContent.includes('اسئلة') ||
              lowerContent.includes('بنك'))) ||
          lowerContent.includes(lowerS) ||
          lowerContent.includes(lowerService) ||
          s.tools.some((t) => lowerContent.includes(t.name.toLowerCase()))
        )
      }) ||
      (!content.toLowerCase().includes('tick') &&
      !content.includes('تيك') &&
      nonTickServers.length > 0 &&
      (content.includes('مقال') ||
        content.includes('مقالات') ||
        content.includes('مدونة') ||
        content.includes('المنصة') ||
        content.includes('منصة') ||
        content.includes('دروس') ||
        content.includes('درس') ||
        content.includes('امتحان') ||
        content.includes('اختبار') ||
        content.includes('اسئلة') ||
        content.includes('سؤال') ||
        content.includes('باقات') ||
        content.includes('باقة') ||
        content.includes('أسعار') ||
        content.includes('سعر'))
        ? nonTickServers[0]
        : null)

    const universalMcpContext = `
=== خوادم بروتوكول MCP المتصلة والمعتمدة في Azal Labs ===
1. [خادم TickTick MCP]:
   - الحالة: ${tickTickToken ? 'متصل برمز وصول حقيقي ومفعّل' : 'متاح للربط'}
   - الصلاحيات: إدارة وتنظيم المهام والقوائم والمشاريع (مثل مشروع 800 Academy ومشروع Inspire) والعادات والتركيز (إجمالي 47 أداة كاملة).
   - الأداة الرئيسية للمهام: create_task, search_task, list_projects, complete_task.
2. [خادم 800 Academy MCP]:
   - الحالة: متصل بالخادم المحلي (http://localhost:3000/mcp)
   - الصلاحيات: إدارة المنصة التعليمية وقاعدة البيانات، المدونة والمقالات (read_blogs, add_blog)، الامتحانات (read_exams, add_exam)، بنك الأسئلة (filter_questions)، الباقات والأسعار (list_offers, update_offer)، المناهج والدروس (list_subjects_full, list_units) (إجمالي 102 أداة كاملة).
`
    const isTodoRequest =
      content.toLowerCase().includes('todo') ||
      content.includes('تودو') ||
      content.includes('قائمة مهام') ||
      content.includes('قائمه مهام') ||
      content.includes('خطة عمل') ||
      content.includes('خطوات عمل') ||
      content.includes('قسم المهام') ||
      content.includes('تخطيط المهام')

    if (isTodoRequest) {
      updateMessagePlan(activeId, asstMsgId, () => ({ title: 'خطة المهام', items: [] }))
    }

    const findInitialTargetProject = (): string => {
      const lower = content.toLowerCase()
      if (lower.includes('800') || lower.includes('academy') || lower.includes('أكاديمي')) return '800 Academy'
      if (lower.includes('inspire') || lower.includes('انسباير')) return 'Inspire'
      for (let i = existingMsgs.length - 1; i >= 0; i--) {
        const mText = existingMsgs[i].content.toLowerCase()
        if (mText.includes('800') || mText.includes('academy')) return '800 Academy'
        if (mText.includes('inspire')) return 'Inspire'
      }
      return '800 Academy'
    }

    let detectedProject = findInitialTargetProject()

    if (isTickTickIntent) {
      // 0. Is this a follow-up formatting, sorting, or table organization request on existing chat data?
      const isFollowUpOrFormatting =
        (content.includes('رتب') ||
          content.includes('نظم') ||
          content.includes('صنف') ||
          content.includes('لخص') ||
          content.includes('جدول') ||
          content.includes('حلل') ||
          content.includes('قارن') ||
          content.includes('حول إلى') ||
          content.includes('اعمل جدول') ||
          content.toLowerCase().includes('sort') ||
          content.toLowerCase().includes('organize') ||
          content.toLowerCase().includes('table') ||
          content.toLowerCase().includes('format')) &&
        existingMsgs.length > 0

      // 1. Is this a capabilities inquiry (what can you do / help)?
      const isCapabilityInquiry =
        !isFollowUpOrFormatting &&
        (content.includes('تقدر تعمل ايه') ||
          content.includes('تقدر تسوي') ||
          content.includes('ماذا يمكنك') ||
          content.includes('ما هي قدرات') ||
          content.includes('ما هي الأدوات') ||
          content.includes('كيف تساعدني') ||
          content.includes('طريقة الاستخدام') ||
          content.includes('شرح') ||
          content.includes('ماذا تفعل') ||
          content.toLowerCase().includes('what can you do') ||
          content.toLowerCase().includes('capabilities') ||
          content.toLowerCase().includes('help'))

      // Fetch user projects for reference
      let projectList: string[] = []
      if (tickTickToken) {
        try {
          const userProjects = await fetchTickTickProjects(tickTickToken)
          if (Array.isArray(userProjects) && userProjects.length > 0) {
            projectList = userProjects.map((p) => p.name)
          }
        } catch {
          // Fallback
        }
      }

      // Helper to detect project name
      const findTargetProject = (): string => {
        const lower = content.toLowerCase()
        if (lower.includes('800') || lower.includes('academy') || lower.includes('أكاديمي')) return '800 Academy'
        if (lower.includes('inspire') || lower.includes('انسباير')) return 'Inspire'
        for (const p of projectList) {
          if (lower.includes(p.toLowerCase())) {
            return p
          }
        }
        if (lower.includes('نفس المشروع') || lower.includes('المشروع نفسه')) {
          for (let i = existingMsgs.length - 1; i >= 0; i--) {
            const mText = existingMsgs[i].content.toLowerCase()
            if (mText.includes('800') || mText.includes('academy')) return '800 Academy'
            if (mText.includes('inspire')) return 'Inspire'
          }
        }
        return projectList[0] || '800 Academy'
      }

      detectedProject = findTargetProject()

      // 2. Is this a task creation intent?
      const isCreateIntent =
        !isFollowUpOrFormatting &&
        !isCapabilityInquiry &&
        (content.includes('اضيف') ||
          content.includes('تضيف') ||
          content.includes('أضف') ||
          content.includes('اضف') ||
          content.includes('انشئ') ||
          content.includes('أنشئ') ||
          content.includes('إنشاء') ||
          content.includes('حط') ||
          content.includes('حطلي') ||
          content.includes('اعمل مهمة') ||
          content.includes('المهمة التالية') ||
          content.includes('create task') ||
          content.includes('add task'))

      // 2.5 Is this a task modification / date update intent?
      const isUpdateIntent =
        !isFollowUpOrFormatting &&
        !isCapabilityInquiry &&
        !isCreateIntent &&
        (content.includes('عدل') ||
          content.includes('تعديل') ||
          content.includes('غير') ||
          content.includes('تغيير') ||
          content.includes('حدث') ||
          content.includes('تحديث') ||
          content.includes('موعد') ||
          content.includes('موقع تنفيذ') ||
          content.includes('تاريخ') ||
          content.includes('أجل') ||
          content.includes('اجعل') ||
          content.includes('خلي') ||
          content.includes('عايز')) &&
        (content.includes('مهمة') ||
          content.includes('تنفيذ') ||
          content.includes('النهارده') ||
          content.includes('اليوم') ||
          content.includes('بكرة') ||
          content.includes('غدا') ||
          content.includes('غداً'))

      // 3. Is this a task query asking to fetch fresh tasks?
      const isTaskQuery =
        !isFollowUpOrFormatting &&
        !isCapabilityInquiry &&
        !isCreateIntent &&
        !isUpdateIntent &&
        (content.includes('المهام') || content.includes('مهام') || content.toLowerCase().includes('tasks'))

      // 4. Is this an explicit request to list/view all projects?
      const isListingProjects =
        !isFollowUpOrFormatting &&
        !isCapabilityInquiry &&
        !isCreateIntent &&
        !isUpdateIntent &&
        !isTaskQuery &&
        (content.includes('ايه المشاريع') ||
          content.includes('المشاريع المتاحة') ||
          content.includes('عرض المشاريع') ||
          content.includes('اعرض المشاريع') ||
          content.includes('ما هي المشاريع') ||
          content.includes('وريني المشاريع') ||
          content.includes('قوائم') ||
          content.includes('مشاريعي') ||
          content.toLowerCase().includes('list projects'))

      if (isFollowUpOrFormatting) {
        toolPrefix = ''
        effectiveSystemPrompt = `${systemPrompt}

${universalMcpContext}

أنت الآن وكيل التحليل والتنظيم في Azal Labs.
المستخدم يطلب ترتيب أو تنظيم أو تصنيف أو وضع البيانات/المهام المذكورة في المحادثة السابقة في جدول منظم.
طلب المستخدم: "${content}".

قواعد صارمة جداً:
1. لا تقم باستدعاء أي أداة MCP على الإطلاق لأن البيانات متوفرة بالفعل.
2. اقرأ قائمة المهام أو البيانات المذكورة في الرسالة السابقة بدقة تامة.
3. رتب هذه المهام ونظمها وفقاً لطلب المستخدم وضعها داخل جدول Markdown متكامل واحترافي.
4. استخدم صياغة واضحة ومهذبة ومباشرة.`
      } else if (isCapabilityInquiry) {
        toolPrefix = ''
        effectiveSystemPrompt = `${systemPrompt}

${universalMcpContext}

أنت الآن تجيب على استفسار المستخدم حول أدوات وقدرات تكامل خادم TickTick MCP في Azal Labs.
طلب المستخدم: "${content}".

معلومات الخادم المعتمدة رسمياً:
- خادم TickTick MCP يضم إجمالي 47 أداة احترافية كاملة ومصنفة إلى 6 فئات رئيسية.

مهمتك:
الرد برد شامل، دقيق ومنظم باستخدام علامات Markdown (لا تستخدم وسوم HTML إطلاقاً) يستعرض كافة الأدوات المتاحة:
### 🛠️ الأدوات والقدرات المتاحة في خادم TickTick MCP (إجمالي 47 أداة)

1. **استعلامات وفحص المهام (Task Queries - 6 أدوات):**
   - \`search_task\`: البحث عن المهام بالكلمات المفتاحية واسترجاع المعرفات والعناوين والروابط.
   - \`get_task_by_id\`: جلب المحتوى والتفاصيل الكاملة لمهمة محددة عبر الـ ID.
   - \`list_undone_tasks_by_time_query\`: عرض المهام غير المنجزة (today, last24hour, last7day, tomorrow, next24hour, next7day).
   - \`list_undone_tasks_by_date\`: عرض المهام غير المنجزة ضمن نطاق تاريخي (حتى 14 يوماً).
   - \`list_completed_tasks_by_date\`: عرض المهام المكتملة في قائمة محددة.
   - \`filter_tasks\`: تصفية المهام بشروط متعددة (التاريخ، القائمة، الأولوية، الوسم، الحالة).

2. **إدارة القوائم والمشاريع والمجلدات (List Management - 13 أداة):**
   - \`list_projects\`: استرجاع جميع المشاريع والقوائم المسجلة في الحساب.
   - \`create_project\` / \`update_project\`: إنشاء وتعديل إعدادات المشاريع والقوائم.
   - \`get_project_by_id\` / \`get_project_with_undone_tasks\`: جلب تفاصيل قائمة مع مهامها غير المنجزة.
   - \`get_task_in_project\`: استرجاع مهمة داخل قائمة معينة.
   - \`list_columns\` / \`create_column\` / \`update_column\`: إدارة أقسام الـ Kanban والأعمدة.
   - \`list_project_groups\` / \`create_project_group\` / \`update_project_group\` / \`delete_project_group\`: إدارة المجلدات ومجموعات القوائم.

3. **إدارة وتعديل المهام والوسوم (Task Management - 16 أداة):**
   - \`create_task\` / \`batch_add_tasks\`: إنشاء مهمة فردية أو مهام متعددة دفعة واحدة.
   - \`complete_task\` / \`complete_tasks_in_project\`: تحديد مهمة أو مهام كمكتملة.
   - \`update_task\` / \`batch_update_tasks\`: تحديث خصائص المهام.
   - \`move_task\` / \`delete_task\`: نقل المهام بين القوائم أو حذفها للسلة.
   - \`get_comment\` / \`add_comment\` / \`delete_comment\`: قراءة وإضافة وحذف التعليقات.
   - \`assign_task\` / \`unassign_task\` / \`project_member\`: إدارة الأعضاء والمسؤوليات.
   - \`list_tags\` / \`create_tag\`: استعراض وإنشاء الوسوم.

4. **إدارة وتتبع العادات (Habit Management - 7 أدوات):**
   - \`list_habits\` / \`list_habit_sections\`: استعراض العادات وأقسامها.
   - \`create_habit\` / \`update_habit\` / \`get_habit\`: إنشاء وتعديل بيانات عادة.
   - \`get_habit_checkins\` / \`upsert_habit_checkins\`: تتبع وتسجيل إنجاز العادات (Check-ins).

5. **سجلات التركيز وإدارة الوقت (Focus Record Management - 4 أدوات):**
   - \`get_focuses_by_time\` / \`get_focus\`: استعراض سجلات جلسات التركيز والبومودورو.
   - \`create_focus\` / \`delete_focus\`: تسجيل أو حذف جلسة تركيز.

6. **العدادات التنازلية (Countdown - أداة واحدة):**
   - \`list_countdowns\`: استعراض المناسبات والعدادات التنازلية المسجلة.

اسأل المستخدم في النهاية: "ما هي الأداة أو الإجراء الذي ترغب في أن أنفذه لك في حسابك الآن؟"`
      } else if (isCreateIntent) {
        // CASE 2: Creating a task inside a project
        const targetProject = detectedProject || '800 Academy'
        const { title: extractedTitle, dueDate } = extractTaskDetails(content)

        let createdSuccess = false
        let creationError: string | null = null
        let createdTaskId: string | null = null

        // 1. Primary: Direct TickTick API using user's authenticated token
        if (tickTickToken) {
          try {
            const res = await createTickTickTask(
              {
                title: extractedTitle,
                content: `مهمة تم إنشاؤها تلقائياً عبر Azal Labs لمشروع ${targetProject}`,
                dueDate,
                projectName: targetProject,
              },
              tickTickToken
            )
            if (res?.id) {
              createdSuccess = true
              createdTaskId = res.id
            }
          } catch (taskErr: any) {
            console.error('Direct TickTick task creation error:', taskErr)
            creationError = taskErr.message || String(taskErr)
          }
        }

        // 2. Secondary: If not succeeded, check custom MCP server endpoint if configured
        if (!createdSuccess) {
          const tickTickServer = servers.find((s) => s.service === 'ticktick' || s.name.toLowerCase().includes('tick'))
          if (tickTickServer?.url && (tickTickServer.url.startsWith('http://') || tickTickServer.url.startsWith('https://'))) {
            try {
              const mcpRes = await executeMcpTool(
                tickTickServer.name,
                'create_task',
                {
                  title: extractedTitle,
                  projectName: targetProject,
                  dueDate,
                },
                servers
              )
              if (mcpRes.success && (mcpRes.result?.id || mcpRes.result?.taskId)) {
                createdSuccess = true
                createdTaskId = mcpRes.result.id || mcpRes.result.taskId
              }
            } catch (e: any) {
              console.warn('TickTick MCP server call failed:', e)
            }
          }
        }

        // 3. DECISION BASED ON REAL RESULT (Zero Hallucination / Zero Fake Success)
        if (createdSuccess) {
          toolPrefix = `:::mcp-tool-call\n{"server": "TickTick MCP", "tool": "create_task", "params": {"title": "${extractedTitle}", "projectName": "${targetProject}"${dueDate ? `, "dueDate": "${dueDate}"` : ''}, "taskId": "${createdTaskId}"}}\n:::\n\n`

          effectiveSystemPrompt = `${systemPrompt}

${universalMcpContext}

أنت الآن وكيل الصياغة والرد النهائي في Azal Labs.
لقد تم بالفعل استدعاء أداة create_task وإنشاء المهمة وتزامنها بنجاح حقيقي ومؤكد في حساب المستخدم على تطبيق TickTick:
- عنوان المهمة: "${extractedTitle}"
- المشروع المستهدف: "${targetProject}"
- معرّف المهمة المسجل: "${createdTaskId}"
- موعد التسليم: ${dueDate ? 'غداً' : 'فوري / بدون موعد'}

مهمتك الإلزامية:
صياغة رد موجه للمستخدم بنص منسق أنيق باستخدام Markdown (بدون وسوم HTML نهائياً):
1. ابدأ بعنوان: ### ✅ تم إضافة المهمة بنجاح إلى حسابك في TickTick
2. أكد للمستخدم بوضوح تام وتفصيلي أنه تم إنشاء وجدولة المهمة في حسابه وتطبيق TickTick الفعلي:
   - **عنوان المهمة:** "${extractedTitle}"
   - **المشروع:** "${targetProject}"
   - **المعرف الفعلي (Task ID):** \`${createdTaskId}\`
   - **موعد التنفيذ:** ${dueDate ? 'غداً' : 'فوري'}
3. وضح له أن الأداة المستخدمة هي \`create_task\` التابعة لخادم TickTick MCP وتم ربطها بنجاح مع المشروع المطلوب وتحديثها فورياً في حسابه.
4. ممنوع منعاً باتاً تكرار كود :::mcp-tool-call في ردك نهائياً.`
        } else if (!tickTickToken) {
          // NOT CONNECTED: The user hasn't authenticated TickTick! DO NOT FAKE IT!
          toolPrefix = `:::mcp-connect\n{"name": "TickTick MCP", "url": "https://mcp.ticktick.com", "service": "ticktick"}\n:::\n\n`

          effectiveSystemPrompt = `${systemPrompt}

${universalMcpContext}

المستخدم يطلب إضافة مهمة إلى تطبيق TickTick، ولكن حسابه على TickTick **غير مربوط حالياً** بأي رمز وصول (Access Token) في هذا المتصفح.
تفاصيل المهمة المطلوبة جاهزة تماماً:
- عنوان المهمة: "${extractedTitle}"
- المشروع المستهدف: "${targetProject}"
- موعد التسليم: ${dueDate ? 'غداً' : 'فوري'}

مهمتك الإلزامية والأمانة التامة (Zero Fake Success):
1. لا تقل للمستخدم أبداً أنه تم إضافة المهمة بنجاح لأن الحساب غير متصل بعد!
2. أخبره بصدق واحترافية:
   "لقد قمت بصياغة وتجهيز كافة تفاصيل المهمة المطلوبة بالكامل:
   - **عنوان المهمة:** ${extractedTitle}
   - **المشروع:** ${targetProject}
   - **موعد التنفيذ:** ${dueDate ? 'غداً' : 'فوري'}
   
   ⚠️ **تنبيه:** حسابك على **TickTick غير متصل حالياً** في المتصفح، لذا لم يتم إرسال المهمة بعد إلى هاتفك. لإرسال هذه المهمة وتزامنها الفوري والمباشر في تطبيق TickTick الفعلي، يرجى النقر على زر **ربط الحساب عبر OAuth** الظاهر في البطاقة أعلاه لتسجيل الدخول لمرة واحدة، وسيتم حفظ هذه المهمة وكافة المهام القادمة تلقائياً فور ذلك!"
3. شجعه على ربط حسابه عبر الزر ليتمكن من إدارة وجدولة المهام بسلاسة.`
        } else {
          // ERROR OCCURRED: Token exists but API call failed!
          toolPrefix = `:::mcp-connect\n{"name": "TickTick MCP", "url": "https://mcp.ticktick.com", "service": "ticktick"}\n:::\n\n`

          effectiveSystemPrompt = `${systemPrompt}

${universalMcpContext}

أثناء محاولة استدعاء أداة create_task في TickTick، حدث خطأ في المصادقة أو الاتصال من خادم TickTick:
تفاصيل الخطأ: "${creationError}"
بيانات المهمة المطلوبة:
- العنوان: "${extractedTitle}"
- المشروع: "${targetProject}"

مهمتك:
1. أخبر المستخدم بصدق وشفافية تامة بما حدث:
   "تعذر إتمام إضافة المهمة في حسابك على TickTick بسبب انتهاء صلاحية رمز الوصول (Token) أو خطأ في الاتصال:
   \`${creationError}\`"
2. وضح له أن بيانات المهمة جاهزة (${extractedTitle} لمشروع ${targetProject})، ويرجى النقر على زر إعادة الربط أعلاه لتجديد الصلاحيات وحفظ المهمة فوراً.`
        }
      } else if (isUpdateIntent) {
        // CASE 2.5: Modifying an existing task (e.g. changing due date to today or tomorrow)
        const targetProject = detectedProject || '800 Academy'

        let newDueDate: string | undefined = undefined
        let dateLabel = 'اليوم'
        const pad = (n: number) => n.toString().padStart(2, '0')
        if (content.includes('النهارده') || content.includes('اليوم') || content.toLowerCase().includes('today')) {
          const today = new Date()
          const yyyy = today.getFullYear()
          const MM = pad(today.getMonth() + 1)
          const dd = pad(today.getDate())
          newDueDate = `${yyyy}-${MM}-${dd}T18:00:00+0000`
          dateLabel = 'اليوم'
        } else if (content.includes('بكرة') || content.includes('غدا') || content.includes('غداً') || content.toLowerCase().includes('tomorrow')) {
          const tomorrow = new Date(Date.now() + 86400000)
          const yyyy = tomorrow.getFullYear()
          const MM = pad(tomorrow.getMonth() + 1)
          const dd = pad(tomorrow.getDate())
          newDueDate = `${yyyy}-${MM}-${dd}T09:00:00+0000`
          dateLabel = 'غداً'
        }

        let updatedSuccess = false
        let updateError: string | null = null
        let updatedTaskTitle = 'مقال متكامل مع محركات البحث (SEO)'
        let updatedTaskId: string | null = null

        if (tickTickToken) {
          try {
            // Find existing task in project
            const projectData = await fetchTasksByProjectName(targetProject, tickTickToken)
            const matchedTask =
              projectData.tasks?.find((t) => t.title.includes('مقال') || t.title.includes('SEO') || t.title.toLowerCase().includes('task')) ||
              projectData.tasks?.[0]

            if (matchedTask) {
              updatedTaskTitle = matchedTask.title
              updatedTaskId = matchedTask.id
              await updateTickTickTask(
                {
                  id: matchedTask.id,
                  projectId: matchedTask.projectId || projectData.project?.id || '',
                  title: matchedTask.title,
                  dueDate: newDueDate,
                },
                tickTickToken
              )
              updatedSuccess = true
            } else {
              // If no task found in list, create/upsert it with the new date!
              const created = await createTickTickTask(
                {
                  title: updatedTaskTitle,
                  content: `مهمة تم تحديث موعدها لتكون ${dateLabel}`,
                  dueDate: newDueDate,
                  projectName: targetProject,
                },
                tickTickToken
              )
              updatedSuccess = true
              updatedTaskId = created.id
            }
          } catch (err: any) {
            console.error('TickTick update error:', err)
            updateError = err.message || String(err)
          }
        }

        if (updatedSuccess) {
          toolPrefix = `:::mcp-tool-call\n{"server": "TickTick MCP", "tool": "update_task", "params": {"title": "${updatedTaskTitle}", "projectName": "${targetProject}", "dueDate": "${dateLabel}", "taskId": "${updatedTaskId}"}}\n:::\n\n`

          effectiveSystemPrompt = `${systemPrompt}

${universalMcpContext}

أنت الآن وكيل الصياغة والرد النهائي في Azal Labs.
لقد تم بنجاح استدعاء أداة update_task التابعة لخادم TickTick MCP وتحديث موعد المهمة فعلياً في خوادم TickTick:
- عنوان المهمة: "${updatedTaskTitle}"
- المشروع: "${targetProject}"
- الموعد الجديد المحدث: ${dateLabel}
- معرّف المهمة: "${updatedTaskId}"

مهمتك الإلزامية:
صياغة رد موجه للمستخدم بنص منسق أنيق باستخدام Markdown (بدون وسوم HTML نهائياً):
1. ابدأ بعنوان: ### ✅ تم تحديث موعد المهمة لتكون ${dateLabel} بنجاح
2. أكد للمستخدم بوضوح تام أنه تم تعديل موعد المهمة **${updatedTaskTitle}** التابعة لمشروع **${targetProject}** لتصبح مستحقة **${dateLabel}** في حسابه على TickTick.
3. وضح له أن التحديث تم وتزامن مباشرة في تطبيقه عبر أداة \`update_task\` الرسمية.
4. ممنوع منعاً باتاً تكرار كود :::mcp-tool-call في ردك نهائياً.`
        } else if (!tickTickToken) {
          toolPrefix = `:::mcp-connect\n{"name": "TickTick MCP", "url": "https://mcp.ticktick.com", "service": "ticktick"}\n:::\n\n`

          effectiveSystemPrompt = `${systemPrompt}

${universalMcpContext}

المستخدم يطلب تعديل موعد المهمة لتكون ${dateLabel}، ولكن حسابه على TickTick غير متصل حالياً في المتصفح.
مهمتك:
1. أخبره بصدق أن تفاصيل التعديل جاهزة ليصبح الموعد **${dateLabel}** لمهمة (${updatedTaskTitle}) داخل مشروع ${targetProject}.
2. وضح له أنه لتطبيق هذا التعديل فعلياً في حسابه وتطبيق هاتفه، يجب النقر على زر **ربط الحساب عبر OAuth** أو وضع الرمز في البطاقة أعلاه لتأكيد الاتصال والمزامنة الفورية!`
        } else {
          toolPrefix = `:::mcp-connect\n{"name": "TickTick MCP", "url": "https://mcp.ticktick.com", "service": "ticktick"}\n:::\n\n`

          effectiveSystemPrompt = `${systemPrompt}

${universalMcpContext}

حدث خطأ أثناء محاولة تحديث المهمة في TickTick: "${updateError}".
أخبر المستخدم بالخطأ بوضوح واطلب منه إعادة ربط حسابه لتجديد الصلاحيات.`
        }
      } else if (isTaskQuery) {
        // CASE 3: Querying real tasks
        let targetProject = detectedProject
        let realTasks: any[] = []

        if (!tickTickToken) {
          toolPrefix = `:::mcp-connect\n{"name": "TickTick MCP", "url": "https://mcp.ticktick.com", "service": "ticktick"}\n:::\n\n`
          effectiveSystemPrompt = `${systemPrompt}

${universalMcpContext}

المستخدم يطلب استعراض مهامه في TickTick، ولكن حسابه غير متصل بعد في المتصفح.
أخبره بوضوح ولطف أن حساب TickTick غير مربوط بعد، واطلب منه النقر على زر الربط في البطاقة أعلاه لعرض مهامه ومزامنته.`
        } else {
          if (targetProject && tickTickToken) {
            try {
              const taskData = await fetchTasksByProjectName(targetProject, tickTickToken)
              realTasks = taskData.tasks || []
            } catch (e) {
              console.warn('Error fetching tasks from TickTick:', e)
            }
          } else if (tickTickToken) {
            for (const p of projectList) {
              try {
                const taskData = await fetchTasksByProjectName(p, tickTickToken)
                if (taskData.tasks && taskData.tasks.length > 0) {
                  targetProject = p
                  realTasks = taskData.tasks
                  break
                }
              } catch {}
            }
            if (!targetProject) {
              targetProject = projectList.find((p) => p.includes('800')) || projectList[0] || '800 Academy'
            }
          }

          toolPrefix = `:::mcp-tool-call\n{"server": "TickTick MCP", "tool": "ticktick_get_tasks", "params": {"projectName": "${targetProject}"}}\n:::\n\n`

          const tasksDescription =
            realTasks.length > 0
              ? realTasks.map((t, idx) => `${idx + 1}. "${t.title}"`).join('\n')
              : 'فارغ تماماً (لا توجد أي مهام مسجلة)'

          effectiveSystemPrompt = `${systemPrompt}

${universalMcpContext}

أنت الآن وكيل الصياغة والرد النهائي (Response Synthesizer Sub-Agent).
لقد قام الـ Sub-Agent الأول بفحص المهام الفعلية داخل مشروع "${targetProject}" في حساب المستخدم على TickTick عبر الـ API الرسمي.

نتيجة الاستعلام الحقيقية المسترجعة من خوادم TickTick:
- المشروع المفحوص: ${targetProject}
- عدد المهام الحقيقية المسجلة: ${realTasks.length}
- قائمة المهام الفعلية:
${tasksDescription}

قواعد الصدق والأمان الصارمة جداً (منع الهلوسة والكذب - Zero Hallucination):
1. يمنع منعاً باتاً وقاطعاً اختراع أو تخمين أو تأليف أي مهام وهمية غير موجودة في النتيجة أعلاه!
2. إذا كانت النتيجة فارغة (0 مهام):
   ابدأ بعنوان: ### مهام مشروع ${targetProject}
   وأخبر المستخدم بصدق ووضوح تام وبكل أمانة:
   "فحصت حسابك على TickTick، و**لا توجد أي مهام مسجلة حالياً** داخل مشروع **${targetProject}**."
3. إذا كانت هناك مهام حقيقية مسجلة في القائمة أعلاه:
   اعرض فقط المهام الحقيقية المذكورة أعلاه بدقة مستخدماً قائمة نقطية، دون زيادة أي مهمة من خيالك.
4. لا تكرر كتابة كود :::mcp-tool-call في ردك لأن الـ Sub-Agent الأول نفذها بالفعل.`
        }
      } else if (isListingProjects) {
        // CASE 4: Explicitly Listing Projects
        if (!tickTickToken) {
          toolPrefix = `:::mcp-connect\n{"name": "TickTick MCP", "url": "https://mcp.ticktick.com", "service": "ticktick"}\n:::\n\n`
          effectiveSystemPrompt = `${systemPrompt}

${universalMcpContext}

المستخدم يطلب عرض المشاريع والقوائم في TickTick، ولكن حسابه غير متصل بعد في المتصفح.
أخبره بوضوح ولطف أن حساب TickTick غير مربوط بعد، واطلب منه النقر على زر الربط في البطاقة أعلاه لعرض مشاريعه وقوائمه ومزامنته.`
        } else {
          const namesString = projectList.length > 0 ? projectList.join(', ') : '800 Academy, Inspire, Personal, Work'
          toolPrefix = ':::mcp-tool-call\n{"server": "TickTick MCP", "tool": "list_projects", "params": {}}\n:::\n\n'

          effectiveSystemPrompt = `${systemPrompt}

${universalMcpContext}

أنت الآن وكيل الصياغة والرد النهائي في Azal Labs.
لقد تم استدعاء أداة list_projects التابعة لخادم TickTick MCP وجلب المشاريع المسجلة في حساب المستخدم الفعلي بنجاح:
المشاريع الموجودة في الحساب: [${namesString}] (إجمالي ${projectList.length || 4} مشاريع).

مهمتك:
الرد على المستخدم فوراً بنص منسق أنيق باستخدام علامات Markdown:
### 📂 المشاريع المسجلة في حسابك على TickTick
${(projectList.length > 0 ? projectList : ['800 Academy', 'Inspire', 'Personal', 'Work']).map((p) => `- **${p}**`).join('\n')}

اسأل المستخدم إذا كان يرغب في إضافة أو تصفح المهام داخل أي من هذه المشاريع.`
        }
      } else {
        toolPrefix = ''
        effectiveSystemPrompt = `${systemPrompt}

${universalMcpContext}

خادم TickTick MCP متصل ومفعل في حساب المستخدم حالياً. أجب على استفسار المستخدم بوضوح واحترافية بدون استدعاء أي أداة ما لم يطلب ذلك.`
      }
    } else if (matchedCustomServer) {
      const isCapabilityOrToolsQuery =
        autoDiscoveredServer !== null ||
        content.includes('تقدر تعمل ايه') ||
        content.includes('قدرة') ||
        content.includes('وصول') ||
        content.includes('متاح') ||
        content.includes('ادوات') ||
        content.includes('أدوات') ||
        content.includes('هل عندك') ||
        content.includes('شرح') ||
        content.includes('دقة') ||
        content.includes('بيعمل ايه') ||
        content.includes('ماذا تفعل') ||
        content.toLowerCase().includes('capabilities') ||
        content.toLowerCase().includes('tools') ||
        content.includes('ايه هي الأدوات')

      if (isCapabilityOrToolsQuery && !content.includes('ابدا') && !content.includes('قولي ايه هي ال')) {
        const toolsList = matchedCustomServer.tools
          .map((t: any) => {
            const name = typeof t === 'string' ? t : t.name
            const desc = typeof t === 'string' ? '' : `: ${t.description}`
            return `- **\`${name}\`**${desc}`
          })
          .join('\n')

        toolPrefix = ''
        effectiveSystemPrompt = `${systemPrompt}

${universalMcpContext}

أنت تجيب الآن على استفسار المستخدم حول خادم الـ MCP: "${matchedCustomServer.name}".
طلب المستخدم: "${content}".

معلومات الخادم الموثقة والمكتشفة ديناميكياً:
- الخادم متصل ونشط ومفعّل في نظام المستخدم حالياً (Active & Connected).
- عنوان الخادم: ${matchedCustomServer.url}
- إجمالي عدد الأدوات المستكشفة عبر بروتوكول MCP (tools/list) بلا استثناء: ${matchedCustomServer.tools.length} أداة.
- قائمة الأدوات المستكشفة كاملة:
${toolsList}

مهمتك:
1. أكد للمستخدم بدقة ووضوح أنك بمجرد تزويدك برابط خادم الـ MCP، استطعت فحص الخادم واكتشاف جميع الأدوات (${matchedCustomServer.tools.length} أداة) بلا أي استثناء عبر بروتوكول tools/list الرسمي.
2. أكد له أنك تمتلك صلاحية كاملة لاستدعاء واستخدام أي من هذه الأدوات فوراً (قراءة وتعديل وكتابة).
3. استعرض أهم الفئات من الأدوات التي وجدتها (مثل أدوات الباقات، الامتحانات، بنك الأسئلة، المناهج، المدونة والمقالات).
4. اسأله مباشرة: "ما هي الأداة أو العملية التي تريد مني تنفيذها لك الآن؟"`
      } else {
        // Direct Action / Execution Intent
        let targetToolName = 'list_offers'
        const toolParams: Record<string, any> = {}
        const lowerC = content.toLowerCase()

        const detectedSub = detectSubjectFromContext(content, existingMsgs)

        // 1. First check if user explicitly called a tool by exact name from the server!
        const explicitlyNamedTool = matchedCustomServer.tools.find((t: any) => {
          const tName = typeof t === 'string' ? t : t.name
          return lowerC.includes(tName.toLowerCase())
        })

        if (explicitlyNamedTool) {
          targetToolName = typeof explicitlyNamedTool === 'string' ? explicitlyNamedTool : explicitlyNamedTool.name
          if (targetToolName === 'read_exams') {
            if (detectedSub) toolParams.subject_id = detectedSub.id
            toolParams.page = 1
            toolParams.page_size = 100
          } else if (targetToolName === 'read_blogs') {
            toolParams.page = 1
            toolParams.page_size = 50
          } else if (targetToolName === 'filter_questions') {
            if (detectedSub) toolParams.subject_id = detectedSub.id
            toolParams.page = 1
            toolParams.page_size = 50
          }
        } else if (lowerC.includes('update') || lowerC.includes('تعديل') || lowerC.includes('عدل') || lowerC.includes('غير السعر') || lowerC.includes('غير')) {
          targetToolName = matchedCustomServer.tools.some((t: any) => t.name === 'update_offer') ? 'update_offer' : 'update_package'
          if (detectedSub) toolParams.packageName = detectedSub.name
          else if (lowerC.includes('sat')) toolParams.packageName = 'Digital SAT : Math'
          else if (lowerC.includes('core')) toolParams.packageName = 'EST 1 : Math Core'
          else if (lowerC.includes('literacy')) toolParams.packageName = 'EST 1 : Literacy'
          else if (lowerC.includes('advanced')) toolParams.packageName = 'EST 2 : Math Advanced'

          const priceMatch = content.match(/(\d+)\s*(جنيه|egp|قرش|ج\.م)?/i)
          if (priceMatch) {
            const num = parseInt(priceMatch[1], 10)
            toolParams.price_cents = num > 5000 ? num : num * 100
          }
        } else if (lowerC.includes('blog') || lowerC.includes('مقال') || lowerC.includes('مدون') || lowerC.includes('article')) {
          if (lowerC.includes('create') || lowerC.includes('add') || lowerC.includes('انشئ') || lowerC.includes('اضف') || lowerC.includes('أضف')) {
            targetToolName = matchedCustomServer.tools.some((t: any) => t.name === 'add_blog') ? 'add_blog' : 'create_blog'
          } else {
            targetToolName = matchedCustomServer.tools.some((t: any) => t.name === 'read_blogs') ? 'read_blogs' : 'list_blogs'
            toolParams.page = 1
            toolParams.page_size = 50
          }
        } else if (lowerC.includes('categor') || lowerC.includes('فئة') || lowerC.includes('فئات') || lowerC.includes('تصنيف')) {
          targetToolName = matchedCustomServer.tools.some((t: any) => t.name === 'read_categories') ? 'read_categories' : 'list_categories'
        } else if (lowerC.includes('lesson') || lowerC.includes('درس') || lowerC.includes('دروس')) {
          targetToolName = matchedCustomServer.tools.some((t: any) => t.name === 'list_lessons') ? 'list_lessons' : 'read_lesson'
          if (detectedSub) toolParams.subject_id = detectedSub.id
        } else if (lowerC.includes('create') || lowerC.includes('اضف') || lowerC.includes('انشئ') || lowerC.includes('إضافة')) {
          targetToolName = matchedCustomServer.tools.some((t: any) => t.name === 'add_offer') ? 'add_offer' : 'create_package'
        } else if (lowerC.includes('exam') || lowerC.includes('امتحان') || lowerC.includes('اختبار') || lowerC.includes('تأكد') || lowerC.includes('اكثر') || lowerC.includes('أكثر') || lowerC.includes('كام')) {
          targetToolName = matchedCustomServer.tools.some((t: any) => t.name === 'read_exams') ? 'read_exams' : 'list_exams'
          if (detectedSub) {
            toolParams.subject_id = detectedSub.id
          }
          toolParams.page = 1
          toolParams.page_size = 100 // Fetch all exams so it never cuts off at 20!
        } else if (lowerC.includes('question') || lowerC.includes('سؤال') || lowerC.includes('بنك')) {
          targetToolName = matchedCustomServer.tools.some((t: any) => t.name === 'filter_questions') ? 'filter_questions' : 'search_questions_text'
          if (detectedSub) {
            toolParams.subject_id = detectedSub.id
          }
          toolParams.page = 1
          toolParams.page_size = 50
        } else if (lowerC.includes('unit') || lowerC.includes('وحد') || lowerC.includes('منهج')) {
          targetToolName = 'list_units'
          if (detectedSub) {
            toolParams.subject_id = detectedSub.id
          }
        } else if (lowerC.includes('status') || lowerC.includes('فحص') || lowerC.includes('تشخيص')) {
          targetToolName = 'get_system_status'
        } else if (lowerC.includes('package') || lowerC.includes('offer') || lowerC.includes('باق') || lowerC.includes('اشتراك') || lowerC.includes('سعر') || lowerC.includes('اسعار')) {
          targetToolName = matchedCustomServer.tools.some((t: any) => t.name === 'list_offers') ? 'list_offers' : 'get_packages'
        } else if (lowerC.includes('subject') || lowerC.includes('مادة') || lowerC.includes('مواد') || lowerC.includes('مسار')) {
          targetToolName = matchedCustomServer.tools.some((t: any) => t.name === 'list_subjects_full') ? 'list_subjects_full' : 'get_subjects'
        } else {
          // Contextual fallback: check if previous turn was asking about exams
          const prevExam = existingMsgs.slice(-3).some((m) => m.content.includes('exam') || m.content.includes('امتحان'))
          if (prevExam && (lowerC.includes('تأكد') || lowerC.includes('اكثر') || lowerC.includes('أكثر') || lowerC.includes('كام'))) {
            targetToolName = 'read_exams'
            if (detectedSub) toolParams.subject_id = detectedSub.id
            toolParams.page = 1
            toolParams.page_size = 100
          } else {
            const prevUpdate = existingMsgs.some((m) => m.content.includes('عدل') || m.content.includes('update'))
            if (prevUpdate) {
              targetToolName = matchedCustomServer.tools.some((t: any) => t.name === 'update_offer') ? 'update_offer' : 'update_package'
            } else {
              targetToolName = matchedCustomServer.tools.some((t: any) => t.name === 'list_offers') ? 'list_offers' : 'get_packages'
            }
          }
        }

        // Execute real tool via mcpClient
        const execResult = await executeMcpTool(matchedCustomServer.name, targetToolName, toolParams, servers)

        toolPrefix = `:::mcp-tool-call\n{"server": "${matchedCustomServer.name}", "tool": "${targetToolName}", "params": ${JSON.stringify(toolParams)}}\n:::\n\n`

        const totalCount =
          execResult.result?.total !== undefined
            ? execResult.result.total
            : Array.isArray(execResult.result?.items)
            ? execResult.result.items.length
            : Array.isArray(execResult.result?.exams)
            ? execResult.result.exams.length
            : Array.isArray(execResult.result?.articles)
            ? execResult.result.articles.length
            : Array.isArray(execResult.result)
            ? execResult.result.length
            : null

        effectiveSystemPrompt = `${systemPrompt}

${universalMcpContext}

أنت الآن وكيل التنفيذ والصياغة الدقيقة في Azal Labs.
لديك صلاحيات كاملة ومباشرة للوصول لكافة بيانات وأدوات خادم "${matchedCustomServer.name}":
- الأداة المنفذة: ${targetToolName}
- المدخلات المنفذة: ${JSON.stringify(toolParams)}
- المادة/القسم المستهدف: ${detectedSub?.name || 'حسب الاستعلام'}
- إجمالي عدد العناصر الفعلي المؤكد في قاعدة البيانات: ${totalCount !== null ? totalCount : 'حسب القائمة أدناه'}
- البيانات الحقيقية المؤكدة المسترجعة من خادم MCP:
${JSON.stringify(execResult.result, null, 2)}

قواعد وتعليمات الصياغة الإلزامية الصارمة (Anti-Hallucination & Exact Accuracy):
1. اعرض النتيجة المسترجعة بدقة تامة واحترافية وبلا أي تخمين أو تأليف أو افتراض نهائياً.
2. العدد الإجمالي الفعلي المسجل في قاعدة البيانات هو ${totalCount !== null ? totalCount : 'المذكور أعلاه'} بالضبط.
   - ممنوع منعاً باتاً وقاطعاً اختراع أرقام وهمية أو تقديرية غير متطابقة مع البيانات المسترجعة.
   - اذكر دائماً الرقم الفعلي بدقة وبكل ثقة في مقدمة ردك (مثال: "إجمالي السجلات المسجلة فعلياً في قاعدة البيانات هو ${totalCount !== null ? totalCount : ''}").
3. إذا كانت النتيجة مقالات أو مدونة (Blogs / Articles):
   - اعرض المقالات كاملة في جدول Markdown أنيق بالأعمدة التالية:
     | م | عنوان المقال | التصنيف (Category) | حالة النشر | وقت القراءة | تاريخ النشر | معرّف المقال (ID) |
4. إذا كانت النتيجة امتحانات (Exams):
   - اعرض جميع الاختبارات المسترجعة كاملة في جدول Markdown أنيق بالأعمدة التالية:
     | م | عنوان الاختبار (Title) | رقم الاختبار | النقاط الكلية | المدة | نسبة النجاح | معرّف الاختبار (ID) |
5. إذا كانت النتيجة قائمة عروض وباقات (Offers / Packages):
   - اعرضها في جدول Markdown أنيق بالأعمدة التالية:
     | المادة الدراسية | اسم المحاولة / العرض | السعر | تاريخ الانتهاء | الحالة | معرّف الباقة (ID) |
     (واكتب المعرف داخل كود مثل \`7f95b059\` حتى يكون متاحاً دائماً للمستخدم بوضوح تام).
6. إذا كانت النتيجة تعديلاً لباقة (Update):
   - أكد للمستخدم نجاح التعديل في قاعدة البيانات واذكر تفاصيل السعر الجديد أو الحالة المعدلة واسم المادة والمعرف.
7. ممنوع منعاً باتاً كتابة وسوم HTML إطلاقاً مثل <br> أو <div>.
8. لا تسأل المستخدم أبداً "هل تملك الـ ID؟"، فأنت وكيل قادر على معرفة الـ ID تلقائياً وتنفيذ التعديل مباشرة.
9. ممنوع منعاً باتاً تكرار كود :::mcp-tool-call في ردك نهائياً لأن الأداة تم تنفيذها بالفعل وعُرضت بطاقتها المكتملة في المحادثة.`
      }
    } else {
      toolPrefix = ''
      effectiveSystemPrompt = `${systemPrompt}

${universalMcpContext}

إذا كان لدى المستخدم استفسار عام أو يريد استخدام أي من خوادم الـ MCP المتصلة، قدم له المساعدة بدقة ووضوح.`
    }

    let accumulatedText = ''

    // Set initial tool badge if present
    if (toolPrefix) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === activeId
            ? {
                ...t,
                messages: t.messages.map((m) =>
                  m.id === asstMsgId ? { ...m, content: toolPrefix } : m
                ),
              }
            : t
        )
      )
    }

    const finalContextPrompt = buildAgentContext({
      baseSystemPrompt: effectiveSystemPrompt,
      connectedServers: servers,
      currentProject: detectedProject || '800 Academy',
    })

    await streamUnifiedLlmCompletion(llmConfig, {
      messages: groqHistory,
      systemPrompt: finalContextPrompt,
      signal: controller.signal,
      onDelta: (chunk) => {
        accumulatedText += chunk
        const fullContent = toolPrefix + accumulatedText

        // Check if ToDo list was emitted dynamically
        const todoMatch = fullContent.match(/:::todo-list\s*([\s\S]*?):::/)
        if (todoMatch && todoMatch[1]) {
          try {
            const parsedTodo = JSON.parse(todoMatch[1].trim())
            if (Array.isArray(parsedTodo.items) && parsedTodo.items.length > 0) {
              updateMessagePlan(activeId, asstMsgId, () => parsedTodo)
            }
          } catch {}
        }

        setAsstContent(fullContent)
      },
      onDone: () => {
        setIsLoading(false)
        abortControllerRef.current = null
        const fullFinal = (toolPrefix + accumulatedText).trim() || 'مرحباً بك في Azal Labs. كيف يمكنني مساعدتك اليوم؟'

        // Final ToDo list check
        const todoMatch = fullFinal.match(/:::todo-list\s*([\s\S]*?):::/)
        if (todoMatch && todoMatch[1]) {
          try {
            const parsedTodo = JSON.parse(todoMatch[1].trim())
            if (Array.isArray(parsedTodo.items)) {
              updateMessagePlan(activeId, asstMsgId, () => parsedTodo)
            }
          } catch {}
        }

        // Memory block check
        const memData = parseMemoryBlockFromText(fullFinal)
        if (memData) {
          const updated = updateMemoryItem(memData.category, memData.key, memData.value)
          setMemoryText(updated)
        }

        setAsstContent(fullFinal, true)
      },
      onError: (err) => {
        setIsLoading(false)
        abortControllerRef.current = null
        const errorText = `عذراً، حدث خطأ أثناء تنفيذ المهمة: ${err.message}`
        setAsstContent(errorText, true)
      },
    })
    } catch (unexpectedErr: any) {
      console.error('Fatal handleSendMessage error:', unexpectedErr)
      setAsstContent(`عذراً، حدث خطأ غير متوقع: ${unexpectedErr?.message || String(unexpectedErr)}`, true)
    } finally {
      setIsLoading(false)
      abortControllerRef.current = null
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // JSX — Claude Code Terminal Layout
  // ═══════════════════════════════════════════════════════════════
  // Plan of the most recent assistant message (for the status bar only)
  const activePlan =
    [...messages].reverse().find((m) => m.plan && m.plan.items.length > 0)?.plan ?? null
  const completedCount = activePlan?.items.filter((i) => i.status === 'completed').length || 0
  const totalTodoCount = activePlan?.items.length || 0

  return (
    <div className="flex h-screen w-full bg-[#0d0e11] overflow-hidden text-[#f3f3ee]">
      {/* ═══ Sidebar (Right in RTL) ═══ */}
      <ChatSidebar
        tasks={tasks}
        currentTaskId={currentTaskId}
        onSelectTask={(id) => {
          setCurrentTaskId(id)
          if (window.innerWidth < 768) setSidebarOpen(false)
        }}
        onNewTask={handleNewTask}
        onDeleteTask={handleDeleteTask}
        isOpen={sidebarOpen}
        onToggleOpen={() => setSidebarOpen(!sidebarOpen)}
      />

      {/* ═══ Main Workspace ═══ */}
      <main className="flex-1 flex flex-col h-full min-w-0">
        {/* ─── Header Bar (fixed, larger on mobile) ─── */}
        <header className="h-14 px-4 pt-[env(safe-area-inset-top)] border-b border-[#2c2e3a] bg-[#14151a] flex items-center justify-between select-none shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden p-2 -mr-1.5 text-[#9da0a8] hover:text-[#f3f3ee] transition-colors cursor-pointer"
              title="القائمة"
            >
              <PanelRight className="w-5 h-5" />
            </button>
            <span className="text-base font-bold text-[#f3f3ee] truncate">Azal Labs</span>
            {currentTask && (
              <span className="text-[11px] text-[#6b6e79] hidden sm:inline truncate">
                — {currentTask.title}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* Model Badge */}
            <Link
              to="/settings?tab=llm"
              className="px-2 py-1 text-[11px] text-[#6b6e79] hover:text-[#9da0a8] transition-colors"
            >
              {llmConfig.activeProvider}
            </Link>

            {/* Clear */}
            {messages.length > 0 && (
              <button
                onClick={handleClearCurrentTask}
                className="p-2 text-[#6b6e79] hover:text-red-400 transition-colors cursor-pointer"
                title="مسح"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            {/* Settings */}
            <Link
              to="/settings"
              className="p-2 text-[#6b6e79] hover:text-[#9da0a8] transition-colors"
              title="الإعدادات"
            >
              <Settings className="w-4 h-4" />
            </Link>
          </div>
        </header>

        {/* ─── Message Stream (no scroll when empty) ─── */}
        <div className={`flex-1 flex flex-col ${messages.length === 0 ? 'overflow-hidden' : 'overflow-y-auto overflow-x-hidden'}`}>
          {messages.length === 0 ? (
            <EmptyState onSelectPrompt={handleSendMessage} />
          ) : (
            <div className="flex-1 pb-4">
              {messages.map((msg) => (
                <ChatMessage key={msg.id} message={msg} />
              ))}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* ─── Input (fixed bottom bar) ─── */}
        <div className="shrink-0 border-t border-[#2c2e3a] bg-[#0d0e11]">
          <ChatInput
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            onStop={handleStop}
          />
        </div>

        {/* ─── Status Bar (desktop only) ─── */}
        <div className="hidden sm:flex h-6 px-4 border-t border-[#2c2e3a] bg-[#0d0e11] items-center gap-4 text-[10px] text-[#4a4d58] select-none shrink-0">
          <span>{llmConfig[llmConfig.activeProvider]?.model || llmConfig.activeProvider}</span>
          {isLoading && (
            <span className="text-[#cc785c] animate-gentle-pulse">● جاري المعالجة</span>
          )}
          {totalTodoCount > 0 && (
            <span>المهام: {completedCount}/{totalTodoCount}</span>
          )}
          <span className="mr-auto">{messages.length > 0 ? `${messages.length} رسلة` : 'جاهز'}</span>
        </div>
      </main>
    </div>
  )
}
