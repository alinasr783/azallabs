export interface ProjectFile {
  id: string
  name: string
  size: number
  type: string
  content?: string // Extracted text content for LLM context
  dataUrl?: string // For download or image preview
  uploadedAt: string
}

export interface Project {
  id: string
  userId: string
  name: string
  description: string
  websiteUrl?: string
  logoUrl?: string // Base64 image data or URL
  projectMemory: string // Dedicated permanent memory specific to this project
  files: ProjectFile[]
  createdAt: string
  updatedAt: string
}
