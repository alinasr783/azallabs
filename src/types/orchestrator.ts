export type StepStatus = 'pending' | 'in_progress' | 'running' | 'completed' | 'failed'

export interface TodoStep {
  id: string
  title: string
  required?: string // المطلوب بدقة
  howToExecute?: string // كيفية تنفيذ المهمة والأدوات المستخدمة
  expectedOutput?: string // المخرجات المطلوبة
  status: StepStatus
  agentRole?: string
  description?: string // وصف كامل ودقيق للمهمة
  taskType?: string // نوع المهمة (نص حر يولده الـ AI: بحث، إنشاء جدول، برمجة، نداء MCP، إلخ)
  output?: string // مخرجات الخطوة بعد التنفيذ
  toolName?: string
}

export interface MultiAgentPlan {
  id: string
  goal: string
  steps: TodoStep[]
  currentStepIndex: number
  isExecuting: boolean
  isCompleted: boolean
  evaluationReport?: string
  finalResponse?: string
  createdAt: string
  finalSummary?: string
}

// Backward compatibility alias
export type MaestroPlan = MultiAgentPlan
