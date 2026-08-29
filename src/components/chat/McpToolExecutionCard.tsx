import React, { useEffect, useState } from 'react'
import { createTickTickTask, fetchTickTickProjects, fetchTasksByProjectName, getTickTickToken } from '../../lib/ticktick'
import { executeMcpTool } from '../../lib/mcpClient'
import { useMcp } from '../../context/McpContext'

interface McpToolExecutionCardProps {
  server: string
  tool: string
  params: Record<string, any>
}

export const McpToolExecutionCard: React.FC<McpToolExecutionCardProps> = ({ server, tool, params }) => {
  const { servers } = useMcp()
  const [status, setStatus] = useState<'pending' | 'running' | 'success' | 'error'>('pending')
  const [result, setResult] = useState<any>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const runTool = async () => {
      setStatus('running')

      try {
        if (server.toLowerCase() === 'ticktick' || tool.startsWith('ticktick_')) {
          const token = getTickTickToken()
          if (!token) {
            throw new Error('حساب TickTick غير متصل حالياً. يرجى ربطه أولاً عبر صفحة الإعدادات.')
          }

          if (tool === 'ticktick_create_task') {
            const taskData = await createTickTickTask(
              {
                title: params.title || 'مهمة جديدة من Azal Labs',
                content: params.content || '',
                dueDate: params.dueDate,
                projectId: params.projectId,
                projectName: params.projectName || params.project,
              },
              token
            )
            if (isMounted) {
              setResult(taskData)
              setStatus('success')
            }
          } else if (tool === 'ticktick_get_projects') {
            const projects = await fetchTickTickProjects(token)
            if (isMounted) {
              setResult(projects)
              setStatus('success')
            }
          } else if (tool === 'ticktick_get_tasks') {
            const targetProject = params.projectName || params.project || ''
            const taskData = await fetchTasksByProjectName(targetProject, token)
            if (isMounted) {
              setResult(taskData)
              setStatus('success')
            }
          } else {
            const dynamicRes = await executeMcpTool(server, tool, params)
            if (isMounted) {
              setResult(dynamicRes.result || dynamicRes)
              setStatus('success')
            }
          }
        } else {
          const dynamicRes = await executeMcpTool(server, tool, params)
          if (isMounted) {
            setResult(dynamicRes.result || dynamicRes)
            setStatus('success')
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setErrorMessage(err.message || 'حدث خطأ غير متوقع أثناء استدعاء الأداة عبر خادم MCP.')
          setStatus('error')
        }
      }
    }

    runTool()

    return () => {
      isMounted = false
    }
  }, [server, tool, params, servers])

  const getToolDisplayName = () => {
    switch (tool) {
      case 'ticktick_create_task':
        return 'إنشاء مهمة في (TickTick)'
      case 'ticktick_get_projects':
        return 'استعراض المشاريع والقوائم'
      case 'ticktick_get_tasks':
        return 'جلب قائمة المهام الفعلية'
      case 'read_blogs':
      case 'get_blogs':
        return 'استرجاع مقالات المدونة'
      case 'add_blog':
      case 'create_blog':
        return 'نشر مقال جديد في المنصة'
      case 'read_exams':
      case 'get_exams':
        return 'استعراض الامتحانات المتاحة'
      case 'get_subjects':
      case 'list_subjects_full':
        return 'فحص المناهج وبنوك الأسئلة'
      default:
        return tool
    }
  }

  return (
    <div className="my-2 p-3 rounded-lg border border-[#2c2e3a] bg-[#14151a] text-right max-w-xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[#cc785c] text-xs">●</span>
          <span className="text-xs font-semibold text-[#f3f3ee]">
            {getToolDisplayName()}
          </span>
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#0d0e11] border border-[#2c2e3a] text-[#6b6e79] font-mono">
            {server}/{tool}
          </span>
        </div>

        {status === 'running' && (
          <span className="text-[11px] text-[#cc785c] flex items-center gap-1">
            <span className="braille-spinner" />
            <span>جاري التنفيذ...</span>
          </span>
        )}
        {status === 'success' && (
          <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
            <span>✔</span>
            <span>تم بنجاح</span>
          </span>
        )}
        {status === 'error' && (
          <span className="text-[11px] text-red-400 font-medium flex items-center gap-1">
            <span>✖</span>
            <span>فشل التنفيذ</span>
          </span>
        )}
      </div>

      {/* Tool Parameters */}
      {params && Object.keys(params).length > 0 && (
        <div className="text-xs text-[#9da0a8] mb-2 bg-[#0d0e11] p-2 rounded border border-[#2c2e3a] space-y-0.5 font-mono">
          {params.title && (
            <div>
              <span className="text-[#6b6e79]">العنوان: </span>
              <span className="text-[#f3f3ee]">{params.title}</span>
            </div>
          )}
          {(params.projectName || params.project) && (
            <div>
              <span className="text-[#cc785c]">المشروع: </span>
              <span className="text-[#f3f3ee]">{params.projectName || params.project}</span>
            </div>
          )}
          {params.content && (
            <div>
              <span className="text-[#6b6e79]">التفاصيل: </span>
              <span className="text-[#f3f3ee]">{params.content}</span>
            </div>
          )}
        </div>
      )}

      {/* Result feedback */}
      {status === 'success' && result && (
        <div className="text-xs text-emerald-300 bg-emerald-950/20 border border-emerald-900/40 p-2 rounded">
          {tool === 'ticktick_create_task' && (
            <span>
              تم إنشاء المهمة بنجاح
              {(params.projectName || params.project) ? ` داخل مشروع "${params.projectName || params.project}" ` : ' '}
              في حسابك على (TickTick).
            </span>
          )}
          {tool === 'ticktick_get_projects' && Array.isArray(result) && (
            <span>تم العثور على {result.length} قوائم ومشاريع في حسابك: {result.map((p: any) => p.name).slice(0, 5).join(', ')}</span>
          )}
          {tool === 'ticktick_get_tasks' && result && (
            <span>
              {result.tasks && result.tasks.length > 0
                ? `تم استرجاع ${result.tasks.length} مهام من مشروع "${result.project?.name || params.projectName}"`
                : `لا توجد مهام مسجلة حالياً داخل مشروع "${result.project?.name || params.projectName || 'المحدد'}".`}
            </span>
          )}
          {(tool === 'get_subjects' || tool === 'list_subjects_full') && result.subjects && (
            <span>تم جلب {result.subjects.length} مواد دراسية معتمدة في منصة 800 Academy.</span>
          )}
          {(tool === 'get_packages' || tool === 'list_offers') && (result.offers || result.packages) && (
            <span>تم جلب عروض وباقات المواد المعتمدة ({result.offers?.length || result.packages?.length} باقة).</span>
          )}
          {tool === 'get_courses' && result.courses && (
            <span>تم استرجاع {result.courses.length} دورة مسجلة بنجاح.</span>
          )}
          {tool !== 'ticktick_create_task' &&
            tool !== 'ticktick_get_projects' &&
            tool !== 'ticktick_get_tasks' &&
            tool !== 'get_subjects' &&
            tool !== 'list_subjects_full' &&
            tool !== 'get_packages' &&
            tool !== 'list_offers' &&
            tool !== 'get_courses' && (
              <span>{result.message || 'تم إتمام العملية بنجاح.'}</span>
            )}
        </div>
      )}

      {status === 'error' && (
        <div className="text-xs text-red-400 bg-red-950/20 border border-red-900/40 p-2 rounded">
          {errorMessage}
        </div>
      )}
    </div>
  )
}
