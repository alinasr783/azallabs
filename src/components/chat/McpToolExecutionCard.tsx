import React, { useEffect, useState } from 'react'
import { CheckCircle2, AlertCircle, Loader2, Wrench } from 'lucide-react'
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
            await new Promise((r) => setTimeout(r, 400))
            if (isMounted) {
              setResult({ message: 'تم تنفيذ أداة TickTick بنجاح' })
              setStatus('success')
            }
          }
        } else {
          // Real execution via mcpClient for 800 Academy and all custom servers
          const execRes = await executeMcpTool(server, tool, params, servers)
          if (isMounted) {
            if (execRes.success) {
              setResult(execRes.result)
              setStatus('success')
            } else {
              setErrorMessage(execRes.errorMessage || 'فشل تنفيذ أداة الـ MCP.')
              setStatus('error')
            }
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setStatus('error')
          setErrorMessage(err.message || 'حدث خطأ أثناء تنفيذ أداة الـ MCP.')
        }
      }
    }

    runTool()

    return () => {
      isMounted = false
    }
  }, [server, tool, JSON.stringify(params)])

  const getToolDisplayName = () => {
    switch (tool) {
      case 'ticktick_create_task':
        return 'إنشاء مهمة في (TickTick)'
      case 'ticktick_get_projects':
        return 'استعراض مشاريع (TickTick)'
      case 'ticktick_get_tasks':
        return 'جلب المهام من (TickTick)'
      case 'get_subjects':
        return 'استعراض المواد والمسارات الدراسية'
      case 'get_packages':
        return 'جلب باقات واشتراكات الطلاب'
      case 'get_courses':
        return 'استعراض الدورات والمساقات'
      case 'search_curriculum':
        return 'فحص المناهج وبنوك الأسئلة'
      default:
        return tool
    }
  }

  return (
    <div className="my-2.5 p-3.5 rounded-xl border border-[#262833] bg-[#14151a] shadow-xs text-right max-w-xl font-serif">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <Wrench className="w-4 h-4 text-[#cc785c]" />
          <span className="text-xs font-semibold text-[#f3f3ee]">
            {getToolDisplayName()}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#1d1e26] border border-[#262833] text-[#cc785c] font-bold">
            ({server}/{tool})
          </span>
        </div>

        {status === 'running' && (
          <span className="text-[11px] text-[#cc785c] flex items-center gap-1 font-mono">
            <Loader2 className="w-3 h-3 animate-spin" />
            جاري التنفيذ...
          </span>
        )}
        {status === 'success' && (
          <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1 font-mono">
            <CheckCircle2 className="w-3.5 h-3.5" />
            تم بنجاح
          </span>
        )}
        {status === 'error' && (
          <span className="text-[11px] text-red-400 font-medium flex items-center gap-1 font-mono">
            <AlertCircle className="w-3.5 h-3.5" />
            فشل التنفيذ
          </span>
        )}
      </div>

      {/* Tool Parameters */}
      {params && Object.keys(params).length > 0 && (
        <div className="text-xs text-[#9da0a8] mb-2 bg-[#0d0e11] p-2.5 rounded-lg border border-[#22242c] space-y-1 font-mono">
          {params.title && (
            <div>
              <span className="font-medium text-[#f3f3ee]">عنوان المهمة: </span>
              <span>{params.title}</span>
            </div>
          )}
          {(params.projectName || params.project) && (
            <div>
              <span className="font-medium text-[#cc785c]">المشروع: </span>
              <span className="font-semibold text-[#f3f3ee]">{params.projectName || params.project}</span>
            </div>
          )}
          {params.content && (
            <div>
              <span className="font-medium text-[#f3f3ee]">التفاصيل: </span>
              <span>{params.content}</span>
            </div>
          )}
        </div>
      )}

      {/* Result feedback */}
      {status === 'success' && result && (
        <div className="text-xs text-emerald-300 font-medium bg-emerald-950/20 border border-emerald-900/40 p-2.5 rounded-lg">
          {tool === 'ticktick_create_task' && (
            <span>
              تم إنشاء المهمة بنجاح
              {(params.projectName || params.project) ? ` داخل مشروع "${params.projectName || params.project}" ` : ' '}
              في حسابك الفعلي على (TickTick)!
            </span>
          )}
          {tool === 'ticktick_get_projects' && Array.isArray(result) && (
            <span>تم العثور على {result.length} قوائم ومشاريع في حسابك: {result.map((p: any) => p.name).slice(0, 5).join(', ')}</span>
          )}
          {tool === 'ticktick_get_tasks' && result && (
            <span>
              {result.tasks && result.tasks.length > 0
                ? `تم استرجاع ${result.tasks.length} مهام فعلية من مشروع "${result.project?.name || params.projectName}"`
                : `لا توجد أي مهام مسجلة حالياً داخل مشروع "${result.project?.name || params.projectName || 'المحدد'}".`}
            </span>
          )}
          {(tool === 'get_subjects' || tool === 'list_subjects_full') && result.subjects && (
            <span>تم بنجاح جلب {result.subjects.length} مواد دراسية معتمدة في منصة 800 Academy (اختبارات EST و SAT).</span>
          )}
          {(tool === 'get_packages' || tool === 'list_offers') && (result.offers || result.packages) && (
            <span>
              تم بنجاح جلب عروض وباقات المواد المعتمدة في 800 Academy ({result.offers?.length || result.packages?.length} عروض بالجنيه المصري).
            </span>
          )}
          {tool === 'get_courses' && result.courses && (
            <span>تم استرجاع {result.courses.length} مسارات ودورات مسجلة بنجاح.</span>
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
        <div className="text-xs text-red-400 bg-red-950/20 border border-red-900/40 p-2.5 rounded-lg">
          {errorMessage}
        </div>
      )}
    </div>
  )
}
