import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react'
import type { Project, ProjectFile } from '../types/project'
import { useAuth } from './AuthContext'
import { supabase } from '../lib/supabase'

interface CreateProjectInput {
  name: string
  description?: string
  websiteUrl?: string
  logoUrl?: string
  projectMemory?: string
  files?: File[]
}

interface ProjectContextType {
  projects: Project[]
  activeProject: Project | null
  activeProjectId: string | null
  setActiveProjectId: (id: string | null) => void
  createProject: (input: CreateProjectInput) => Promise<Project>
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>
  deleteProject: (id: string) => Promise<void>
  uploadFilesToProject: (projectId: string, files: File[]) => Promise<void>
  deleteProjectFile: (projectId: string, fileId: string) => Promise<void>
  updateProjectMemory: (projectId: string, memoryText: string) => Promise<void>
  loading: boolean
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined)

const getStorageKey = (userId: string) => `azal_projects_${userId}`

// Helper to convert File to ProjectFile with text extraction
async function processFile(file: File): Promise<ProjectFile> {
  const fileId = 'pf_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7)
  let content = ''
  let dataUrl: string | undefined = undefined

  // Read text for documents, code, markdown, json
  const isText =
    file.type.startsWith('text/') ||
    file.name.endsWith('.txt') ||
    file.name.endsWith('.md') ||
    file.name.endsWith('.json') ||
    file.name.endsWith('.js') ||
    file.name.endsWith('.ts') ||
    file.name.endsWith('.tsx') ||
    file.name.endsWith('.jsx') ||
    file.name.endsWith('.py') ||
    file.name.endsWith('.css') ||
    file.name.endsWith('.html') ||
    file.name.endsWith('.csv')

  if (isText && file.size < 2 * 1024 * 1024) {
    try {
      content = await file.text()
    } catch {
      content = ''
    }
  }

  // Generate dataUrl for previews or downloads if reasonable size
  if (file.size < 5 * 1024 * 1024) {
    try {
      dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
    } catch {
      dataUrl = undefined
    }
  }

  return {
    id: fileId,
    name: file.name,
    size: file.size,
    type: file.type || 'application/octet-stream',
    content: content || undefined,
    dataUrl,
    uploadedAt: new Date().toISOString(),
  }
}

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) || null,
    [projects, activeProjectId]
  )

  const saveProjects = useCallback(
    (next: Project[]) => {
      setProjects(next)
      if (!user) return
      const key = getStorageKey(user.id)
      try {
        localStorage.setItem(key, JSON.stringify(next))
      } catch (err) {
        console.warn('Failed to save projects to localStorage:', err)
      }
    },
    [user]
  )

  // Load projects for authenticated user
  useEffect(() => {
    if (!user) {
      setProjects([])
      setActiveProjectId(null)
      setLoading(false)
      return
    }

    let isMounted = true
    setLoading(true)

    const load = async () => {
      const key = getStorageKey(user.id)
      let localProjects: Project[] = []
      const saved = localStorage.getItem(key)
      if (saved) {
        try {
          localProjects = JSON.parse(saved)
        } catch {
          localProjects = []
        }
      }

      // Try fetching from Supabase
      try {
        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })

        if (!error && data && data.length > 0) {
          const remoteProjects: Project[] = data.map((d: any) => ({
            id: d.id,
            userId: d.user_id,
            name: d.name,
            description: d.description || '',
            websiteUrl: d.website_url || undefined,
            logoUrl: d.logo_url || undefined,
            projectMemory: d.project_memory || '',
            files: Array.isArray(d.files) ? d.files : [],
            createdAt: d.created_at,
            updatedAt: d.updated_at,
          }))

          if (isMounted) {
            saveProjects(remoteProjects)
            setLoading(false)
            return
          }
        }
      } catch {
        // Fallback to local
      }

      if (isMounted) {
        setProjects(localProjects)
        setLoading(false)
      }
    }

    load()

    return () => {
      isMounted = false
    }
  }, [user, saveProjects])

  // Create Project
  const createProject = async ({
    name,
    description = '',
    websiteUrl,
    logoUrl,
    projectMemory = '',
    files = [],
  }: CreateProjectInput): Promise<Project> => {
    if (!user) throw new Error('يجب تسجيل الدخول أولاً لإنشاء مشروع.')

    const processedFiles: ProjectFile[] = []
    for (const f of files) {
      processedFiles.push(await processFile(f))
    }

    const newProject: Project = {
      id: 'proj_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      userId: user.id,
      name: name.trim(),
      description: description.trim(),
      websiteUrl: websiteUrl?.trim() || undefined,
      logoUrl,
      projectMemory: projectMemory.trim(),
      files: processedFiles,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const updated = [newProject, ...projects]
    saveProjects(updated)

    // Sync to Supabase in background
    try {
      await supabase.from('projects').insert({
        id: newProject.id,
        user_id: user.id,
        name: newProject.name,
        description: newProject.description,
        website_url: newProject.websiteUrl,
        logo_url: newProject.logoUrl,
        project_memory: newProject.projectMemory,
        files: newProject.files,
        created_at: newProject.createdAt,
        updated_at: newProject.updatedAt,
      })
    } catch {
      // Offline fallback
    }

    return newProject
  }

  // Update Project
  const updateProject = async (id: string, updates: Partial<Project>) => {
    const updated = projects.map((p) => {
      if (p.id === id) {
        return {
          ...p,
          ...updates,
          updatedAt: new Date().toISOString(),
        }
      }
      return p
    })
    saveProjects(updated)

    const target = updated.find((p) => p.id === id)
    if (target && user) {
      try {
        await supabase
          .from('projects')
          .update({
            name: target.name,
            description: target.description,
            website_url: target.websiteUrl,
            logo_url: target.logoUrl,
            project_memory: target.projectMemory,
            files: target.files,
            updated_at: target.updatedAt,
          })
          .eq('id', id)
      } catch {
        // Fallback
      }
    }
  }

  // Delete Project
  const deleteProject = async (id: string) => {
    const updated = projects.filter((p) => p.id !== id)
    saveProjects(updated)

    if (activeProjectId === id) {
      setActiveProjectId(null)
    }

    try {
      await supabase.from('projects').delete().eq('id', id)
    } catch {
      // Fallback
    }
  }

  // Upload Files to Project
  const uploadFilesToProject = async (projectId: string, files: File[]) => {
    const newFiles: ProjectFile[] = []
    for (const f of files) {
      newFiles.push(await processFile(f))
    }

    const updated = projects.map((p) => {
      if (p.id === projectId) {
        return {
          ...p,
          files: [...p.files, ...newFiles],
          updatedAt: new Date().toISOString(),
        }
      }
      return p
    })
    saveProjects(updated)

    const target = updated.find((p) => p.id === projectId)
    if (target) {
      try {
        await supabase
          .from('projects')
          .update({ files: target.files, updated_at: target.updatedAt })
          .eq('id', projectId)
      } catch {
        // Fallback
      }
    }
  }

  // Delete Project File
  const deleteProjectFile = async (projectId: string, fileId: string) => {
    const updated = projects.map((p) => {
      if (p.id === projectId) {
        return {
          ...p,
          files: p.files.filter((f) => f.id !== fileId),
          updatedAt: new Date().toISOString(),
        }
      }
      return p
    })
    saveProjects(updated)

    const target = updated.find((p) => p.id === projectId)
    if (target) {
      try {
        await supabase
          .from('projects')
          .update({ files: target.files, updated_at: target.updatedAt })
          .eq('id', projectId)
      } catch {
        // Fallback
      }
    }
  }

  // Update Project Memory
  const updateProjectMemory = async (projectId: string, memoryText: string) => {
    await updateProject(projectId, { projectMemory: memoryText })
  }

  return (
    <ProjectContext.Provider
      value={{
        projects,
        activeProject,
        activeProjectId,
        setActiveProjectId,
        createProject,
        updateProject,
        deleteProject,
        uploadFilesToProject,
        deleteProjectFile,
        updateProjectMemory,
        loading,
      }}
    >
      {children}
    </ProjectContext.Provider>
  )
}

export const useProjects = () => {
  const ctx = useContext(ProjectContext)
  if (!ctx) throw new Error('useProjects must be used within ProjectProvider')
  return ctx
}
