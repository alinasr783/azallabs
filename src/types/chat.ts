import type { ClaudeTodoList } from '../components/chat/ClaudeTodoPanel'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  plan?: ClaudeTodoList | null
}

export interface TaskSession {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messages: Message[]
  plan?: ClaudeTodoList | null
  projectId?: string
}

// للتوافق العكسي
export type Conversation = TaskSession
