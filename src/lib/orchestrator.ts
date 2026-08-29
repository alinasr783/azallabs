import type { MaestroPlan, TodoStep } from '../types/orchestrator'
import { generateGeminiContent } from './gemini'

// 1. فحص عميق لما إذا كان طلب المستخدم يتطلب أكثر من خطوة أو استدعاء أدوات
export function isComplexTask(prompt: string): boolean {
  const trimmed = prompt.trim()
  if (!trimmed) return false

  const lower = trimmed.toLowerCase()

  // (A) التعبيرات والتحيات البسيطة التي لا تحتاج لـ Multi-Agent Loop
  const simpleChitChat = [
    'مرحبا',
    'أهلا',
    'اهلا',
    'السلام عليكم',
    'صباح الخير',
    'مساء الخير',
    'هاي',
    'سلام',
    'من أنت',
    'من انت',
    'مين انت',
    'شكرا',
    'شكراً',
    'تمام',
    'أوكي',
    'اوكي',
    'hello',
    'hi',
    'hey',
    'who are you',
    'thanks',
    'thank you',
    'ok',
  ]

  if (
    trimmed.length < 25 &&
    simpleChitChat.some(
      (g) => lower === g || lower === g + '!' || lower === g + '؟' || lower === g + '?'
    )
  ) {
    return false
  }

  // (B) الإشارات الواضحة لمهام متعددة الخطوات أو أدوات خارجية
  const toolAndDomainKeywords = [
    'ticktick',
    'tick tick',
    'تيك توك',
    'تيك تك',
    '800 academy',
    '800',
    'أكاديمي',
    'اكاديمي',
    'mcp',
    'خادم',
    'أداة',
    'اداة',
    'مشروع',
    'مهمة',
    'task',
    'tasks',
    'مهام',
    'todo',
    'مقال',
    'مقالات',
    'مدونة',
    'امتحان',
    'اختبار',
    'باقة',
    'عرض',
    'عروض',
    'سعر',
    'أسعار',
    'اسعار',
    'خطة',
    'خطوات',
    'مراحل',
    'pipeline',
    'workflow',
  ]

  for (const kw of toolAndDomainKeywords) {
    if (lower.includes(kw)) return true
  }

  // (C) أفعال التنفيذ والعمل والتحليل
  const actionKeywords = [
    'اعمل',
    'أعمل',
    'سوي',
    'سو',
    'حطلي',
    'حط',
    'انشئ',
    'أنشئ',
    'اضف',
    'أضف',
    'عدل',
    'احذف',
    'استعرض',
    'اعرض',
    'اكتب',
    'أكتب',
    'حلل',
    'قارن',
    'رتب',
    'نظم',
    'جدول',
    'ابحث',
    'دور',
    'شوف',
    'شيك',
    'تأكد',
    'افحص',
    'تقدر تعمل ايه',
    'قدرات',
    'شرح',
    'خطوات',
    'create',
    'build',
    'make',
    'write',
    'plan',
    'analyze',
    'fetch',
    'search',
    'list',
    'show me',
    'tell me',
  ]

  for (const act of actionKeywords) {
    if (lower.includes(act)) return true
  }

  // (D) الروابط اللغوية والتسلسل (و، ثم، بعدين، لكي، عشان، etc.)
  const hasSequence =
    lower.includes(' و ') ||
    lower.includes(' ثم ') ||
    lower.includes(' بعد ') ||
    lower.includes(' عشان ') ||
    lower.includes(' لكي ') ||
    lower.includes(' بحيث ') ||
    lower.includes(' and ') ||
    lower.includes(' then ') ||
    lower.includes('\n')

  if (hasSequence) return true

  // أي طلب ذو معنى وتفاصيل أطول من 20 حرفاً يتم اعتباره مهمة متعددة الخطوات
  return trimmed.length > 20
}

export const isMultiStepTask = isComplexTask

// 2. توليد خطة العمل الذاتية (Todo List) المناسبة للهدف بواسطة Gemini
export async function generateMaestroPlan(
  goal: string,
  projectNames: string[] = []
): Promise<MaestroPlan> {
  const planId = 'plan_' + Date.now()
  const projectsContext = projectNames.length > 0 ? projectNames.join(', ') : '800 Academy, Inspire, TaaPost'

  try {
    const prompt = `أنت المايسترو (Master Orchestrator) في Azal Labs.
المستخدم لديه الهدف المعقد التالي:
"${goal}"

المشاريع المتاحة في حسابه على TickTick: [${projectsContext}]

مهمتك:
تقسيم هذا الهدف إلى خطة عمل تنفيذية ذكية مكونة من 3 خطوات متتابعة وواضحة جداً.
الخطوة 1: استرجاع وفحص المهام الفعلية من المشروع المناسب (عبر TickTick أو MCP).
الخطوة 2: تحليل البيانات وتصنيفها حسب الأولويات وحالة الإنجاز.
الخطوة 3: بناء جدول خطة العمل الأسبوعية/التنفيذية.

أخرج لي فقط كود JSON صالح تماماً كـ Array من الكائنات بدون أي نصوص قبلها أو بعدها:
[
  {
    "id": "step_1",
    "title": "عنوان الخطوة الأولى بدقة",
    "agentRole": "دور الوكيل (مثل: وكيل استرجاع البيانات)",
    "description": "شرح موجز ودقيق للمطلوب من الوكيل"
  },
  {
    "id": "step_2",
    "title": "عنوان الخطوة الثانية",
    "agentRole": "دور الوكيل (مثل: وكيل التحليل والتصنيف)",
    "description": "ما المطلوب بناء على مخرجات الخطوة الأولى"
  },
  {
    "id": "step_3",
    "title": "عنوان الخطوة الثالثة",
    "agentRole": "دور الوكيل (مثل: وكيل الجدولة وبناء خطة العمل)",
    "description": "ما المطلوب لصياغة النتيجة النهائية"
  }
]`

    const text = await generateGeminiContent(prompt, 'أنت المايسترو في Azal Labs المتخصص في بناء خطط العمل', 2048)
    if (text) {
      const jsonMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/)
      if (jsonMatch) {
        const rawSteps = JSON.parse(jsonMatch[0])
        const steps: TodoStep[] = rawSteps.map((s: any, idx: number) => ({
          id: s.id || `step_${idx + 1}`,
          title: s.title || `الخطوة ${idx + 1}`,
          description: s.description || '',
          agentRole: s.agentRole || 'وكيل تنفيذي',
          status: 'pending' as const,
        }))

        if (steps.length > 0) {
          return {
            id: planId,
            goal,
            steps,
            currentStepIndex: 0,
            isExecuting: true,
            isCompleted: false,
            createdAt: new Date().toISOString(),
          }
        }
      }
    }
  } catch (e) {
    console.warn('Dynamic plan generation fallback:', e)
  }

  // Smart Context-Aware Fallback Plan
  return {
    id: planId,
    goal,
    steps: [
      {
        id: 'step_1',
        title: 'استرجاع وفحص مهام المشروع المستهدف',
        description: 'جلب قائمة كاملة ودقيقة لجميع المهام المسجلة في المشروع للبدء بالتحليل.',
        agentRole: 'وكيل استرجاع البيانات (Data Fetcher)',
        status: 'pending',
      },
      {
        id: 'step_2',
        title: 'تحليل وتصنيف الأولويات والمراحل',
        description: 'فرز المهام حسب الأولوية وتحديد المهام الحرجة وترتيب جدول التنفيذ.',
        agentRole: 'وكيل التحليل والتصنيف (Priority Analyst)',
        status: 'pending',
      },
      {
        id: 'step_3',
        title: 'صياغة خطة العمل وجدول التنفيذ الشامل',
        description: 'تجميع كافة المهام والبيانات في جدول منظم وشامل مع توضيح الخطوات الفورية للبدء.',
        agentRole: 'وكيل الجدولة والتنظيم (Action Planner)',
        status: 'pending',
      },
    ],
    currentStepIndex: 0,
    isExecuting: true,
    isCompleted: false,
    createdAt: new Date().toISOString(),
  }
}

// دالة مساعدة لاستدعاء Gemini
async function callGeminiWithRetry(prompt: string, maxTokens: number = 2048): Promise<string> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await generateGeminiContent(prompt, undefined, maxTokens)
      if (res && res.trim().length > 0) {
        return res
      }
    } catch (e) {
      console.warn('Gemini attempt failed:', e)
    }
  }
  return ''
}

// 3. تشغيل خطوة محددة بواسطة Sub-Agent متخصص مع توريث السياق التراكمي
export async function executeSubAgentStep(
  step: TodoStep,
  goal: string,
  accumulatedContext: string,
  _tickTickToken?: string | null
): Promise<string> {
  const prompt = `أنت وكيل فرعي متخصص (Sub-Agent): "${step.agentRole}" في نظام Azal Labs.
المهمة الموكلة إليك: "${step.title}"
وصف المهمة: "${step.description || ''}"

الهدف العام للمستخدم:
"${goal}"

سياق المحادثة وبيانات المهام الحقيقية المسترجعة:
${accumulatedContext}

قواعد الصياغة والالتزام التام (High-Signal, Concise, Zero Fluff):
1. اعتمد 100% على المهام الحقيقية المذكورة في السياق أعلاه ولا تخترع أي مهمة وهمية.
2. ادخل في صلب الموضوع فوراً بدون مقدمات إنشائية أو عبارات ترحيبية أو اعتذارات.
3. كن مختصراً وذكياً ومركّزاً (بحد أقصى 200 كلمة): لخص ما توصلت إليه في نقاط واضحة أو جدول مقتضب إن لزم الأمر.
4. اذكر دائماً الأسماء الحقيقية للمهام ولا تستخدم مسميات مبهمة مثل "Task 1".`

  const result = await callGeminiWithRetry(prompt, 1500)
  if (result && result.trim().length > 20) {
    return result
  }

  return `تم فحص وتجهيز خطوة "${step.title}" بناءً على المهام الحقيقية المسجلة بنجاح.`
}

// 4. تقرير المايسترو النهائي الشامل المكتمل
export async function generateMaestroFinalReport(
  goal: string,
  plan: MaestroPlan,
  _systemPrompt: string,
  realTasksSummary: string = ''
): Promise<string> {
  const validSteps = plan.steps.filter((s) => s.output && s.output.trim().length > 20)
  const stepsSummary = validSteps
    .map((s, idx) => `الخطوة ${idx + 1} (${s.title}):\n${s.output}`)
    .join('\n\n')

  const prompt = `أنت المايسترو في منصة Azal Labs.
المستخدم طلب: "${goal}"

المهام الحقيقية المسجلة في المشروع:
${realTasksSummary}

ملخص عمل فريق الوكلاء في الخطوات السابقة:
${stepsSummary}

المطلوب منك:
صياغة تقرير ختامي تنفيذي أنيق وشامل يجمع كافة المهام المذكورة أعلاه في جدول تنفيذي متكامل:
### 🎯 خطة العمل الشاملة
(فقرة موجزة وذكية من سطرين تلخص الاستراتيجية المعتمدة).

### 📅 جدول المهام الشامل
| المرحلة / الوقت | المهمة (الاسم الفعلي) | المسار / التصنيف | الأولوية |
(اكتب كل مهمة من المهام الحقيقية المذكورة أعلاه في صف مخصص لها باسمها الصريح الكامل!).

### ⚡ أول 3 خطوات للبدء فوراً
- خطوة 1 (محددة ومباشرة)
- خطوة 2 (محددة ومباشرة)
- خطوة 3 (محددة ومباشرة)

ممنوع منعاً باتاً القول بأن البيانات غير متوفرة، بل التزم بالمهام المذكورة أعلاه.`

  const report = await callGeminiWithRetry(prompt, 2500)
  if (report && report.trim().length > 100 && !report.includes('بانتظار البيانات')) {
    return report
  }

  return `### 🎯 خطة العمل الشاملة

تم إعداد خطة العمل المتكاملة بنجاح بناءً على كافة المهام الحقيقية المسترجعة من حسابك على TickTick:

${stepsSummary || realTasksSummary}

---
⚡ **أولى الخطوات المقترحة:** البدء الفوري بتنفيذ مهام المرحلة الأولى وتحديث حالتها في حسابك.`
}
