import React, { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Globe,
  MessageSquare,
  FileText,
  Brain,
  Settings,
  Plus,
  Trash2,
  Upload,
  Download,
  Check,
  Loader2,
  ExternalLink,
  FolderKanban,
  FileCode,
} from 'lucide-react'
import { useProjects } from '../context/ProjectContext'
import type { TaskSession } from '../types/chat'

type TabType = 'chats' | 'files' | 'memory' | 'settings'

export const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const {
    projects,
    updateProject,
    deleteProject,
    uploadFilesToProject,
    deleteProjectFile,
    updateProjectMemory,
    setActiveProjectId,
  } = useProjects()

  const project = projects.find((p) => p.id === id)

  const [activeTab, setActiveTab] = useState<TabType>('chats')

  // Project Chats from localStorage
  const [projectChats, setProjectChats] = useState<TaskSession[]>([])

  // Memory tab state
  const [editedMemory, setEditedMemory] = useState('')
  const [isSavingMemory, setIsSavingMemory] = useState(false)
  const [memorySavedSuccess, setMemorySavedSuccess] = useState(false)

  // Settings tab state
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editWebsite, setEditWebsite] = useState('')
  const [editLogo, setEditLogo] = useState<string | undefined>(undefined)
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [settingsSavedSuccess, setSettingsSavedSuccess] = useState(false)

  // Files tab state
  const [isUploadingFiles, setIsUploadingFiles] = useState(false)

  useEffect(() => {
    if (project) {
      setEditedMemory(project.projectMemory || '')
      setEditName(project.name || '')
      setEditDescription(project.description || '')
      setEditWebsite(project.websiteUrl || '')
      setEditLogo(project.logoUrl)
    }
  }, [project])

  // Load chats for this project
  useEffect(() => {
    if (!id) return
    try {
      const saved = localStorage.getItem('azal_chat_tasks')
      if (saved) {
        const allTasks: TaskSession[] = JSON.parse(saved)
        const filtered = allTasks.filter((t) => t.projectId === id)
        setProjectChats(filtered)
      }
    } catch {
      setProjectChats([])
    }
  }, [id])

  if (!project) {
    return (
      <div className="min-h-screen bg-[#0d0e11] text-[#f3f3ee] flex flex-col items-center justify-center p-4" dir="rtl">
        <div className="text-center space-y-3">
          <FolderKanban className="w-10 h-10 text-[#6b6e79] mx-auto" />
          <h2 className="text-base font-bold">المشروع غير موجود أو تم حذفه</h2>
          <Link
            to="/projects"
            className="px-4 py-1.5 rounded-lg bg-[#cc785c] text-white text-xs font-bold inline-block"
          >
            العودة لقائمة المشاريع
          </Link>
        </div>
      </div>
    )
  }

  const handleStartNewChat = () => {
    setActiveProjectId(project.id)
    navigate(`/?projectId=${project.id}&new=true`)
  }

  const handleOpenChat = (taskId: string) => {
    setActiveProjectId(project.id)
    navigate(`/?taskId=${taskId}&projectId=${project.id}`)
  }

  const handleDeleteChat = (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation()
    try {
      const saved = localStorage.getItem('azal_chat_tasks')
      if (saved) {
        const allTasks: TaskSession[] = JSON.parse(saved)
        const updated = allTasks.filter((t) => t.id !== taskId)
        localStorage.setItem('azal_chat_tasks', JSON.stringify(updated))
        setProjectChats((prev) => prev.filter((t) => t.id !== taskId))
      }
    } catch {
      // Ignore
    }
  }

  // Memory Handlers
  const handleSaveMemory = async () => {
    setIsSavingMemory(true)
    await updateProjectMemory(project.id, editedMemory)
    setIsSavingMemory(false)
    setMemorySavedSuccess(true)
    setTimeout(() => setMemorySavedSuccess(false), 2500)
  }

  const handleClearMemory = async () => {
    if (window.confirm('هل أنت متأكد من رغبتك في إفراغ ذاكرة هذا المشروع بالكامل؟')) {
      setEditedMemory('')
      await updateProjectMemory(project.id, '')
    }
  }

  // Files Handlers
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    setIsUploadingFiles(true)
    try {
      const filesArray = Array.from(e.target.files)
      await uploadFilesToProject(project.id, filesArray)
    } finally {
      setIsUploadingFiles(false)
      e.target.value = ''
    }
  }

  const handleDeleteFile = async (fileId: string, fileName: string) => {
    if (window.confirm(`هل أنت متأكد من حذف الملف "${fileName}"؟`)) {
      await deleteProjectFile(project.id, fileId)
    }
  }

  // Settings Handlers
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editName.trim()) return
    setIsSavingSettings(true)
    await updateProject(project.id, {
      name: editName.trim(),
      description: editDescription.trim(),
      websiteUrl: editWebsite.trim() || undefined,
      logoUrl: editLogo,
    })
    setIsSavingSettings(false)
    setSettingsSavedSuccess(true)
    setTimeout(() => setSettingsSavedSuccess(false), 2500)
  }

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setEditLogo(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleDeleteProject = async () => {
    if (
      window.confirm(
        `تحذير: هل أنت متأكد من رغبتك في حذف مشروع "${project.name}" نهائياً وجميع ملفاته وذاكرته؟ لا يمكن التراجع.`
      )
    ) {
      await deleteProject(project.id)
      navigate('/projects')
    }
  }

  return (
    <div className="min-h-screen bg-[#0d0e11] text-[#f3f3ee] flex flex-col font-sans" dir="rtl">
      {/* ─── Top Bar ─── */}
      <header className="h-14 px-4 sm:px-6 border-b border-[#2c2e3a] bg-[#14151a] flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-3">
          <Link
            to="/projects"
            className="p-1.5 rounded-lg text-[#9da0a8] hover:text-[#f3f3ee] hover:bg-[#1f2129] transition-colors"
            title="كل المشاريع"
          >
            <ArrowRight className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            {project.logoUrl ? (
              <img
                src={project.logoUrl}
                alt={project.name}
                className="w-6 h-6 rounded object-cover border border-[#2c2e3a] bg-[#0d0e11]"
              />
            ) : (
              <div className="w-6 h-6 rounded bg-[#1f2129] border border-[#2c2e3a] flex items-center justify-center text-[10px] font-bold text-[#cc785c]">
                {project.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <span className="text-base font-bold text-[#f3f3ee]">{project.name}</span>
          </div>
        </div>

        <button
          onClick={handleStartNewChat}
          className="px-3.5 py-1.5 rounded-lg bg-[#cc785c] hover:bg-[#be684e] text-white flex items-center gap-1.5 text-xs font-bold transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>محادثة جديدة</span>
        </button>
      </header>

      {/* ─── Project Header Card ─── */}
      <div className="border-b border-[#2c2e3a] bg-[#14151a]/50">
        <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {project.logoUrl ? (
                <img
                  src={project.logoUrl}
                  alt={project.name}
                  className="w-14 h-14 rounded-xl object-cover border border-[#2c2e3a] shrink-0 bg-[#0d0e11]"
                />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-[#1f2129] border border-[#2c2e3a] flex items-center justify-center text-lg font-bold text-[#cc785c] shrink-0">
                  {project.name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold text-[#f3f3ee]">{project.name}</h1>
                  {project.websiteUrl && (
                    <a
                      href={project.websiteUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2 py-0.5 rounded-full border border-[#2c2e3a] hover:border-[#cc785c] text-[11px] text-[#38bdf8] flex items-center gap-1 transition-colors"
                    >
                      <Globe className="w-3 h-3" />
                      <span>{project.websiteUrl.replace(/^https?:\/\//, '')}</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
                <p className="text-xs text-[#9da0a8] max-w-2xl leading-relaxed">
                  {project.description || 'لا يوجد وصف مضاف لهذا المشروع.'}
                </p>
              </div>
            </div>
          </div>

          {/* ─── Navigation Tabs ─── */}
          <div className="flex items-center gap-2 pt-2 border-t border-[#262833] text-xs">
            <button
              onClick={() => setActiveTab('chats')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium transition-colors cursor-pointer ${
                activeTab === 'chats'
                  ? 'bg-[#1f2129] text-[#cc785c] border border-[#2c2e3a]'
                  : 'text-[#9da0a8] hover:text-[#f3f3ee]'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>المحادثات ({projectChats.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('files')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium transition-colors cursor-pointer ${
                activeTab === 'files'
                  ? 'bg-[#1f2129] text-[#cc785c] border border-[#2c2e3a]'
                  : 'text-[#9da0a8] hover:text-[#f3f3ee]'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>ملفات المشروع ({project.files?.length || 0})</span>
            </button>

            <button
              onClick={() => setActiveTab('memory')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium transition-colors cursor-pointer ${
                activeTab === 'memory'
                  ? 'bg-[#1f2129] text-[#cc785c] border border-[#2c2e3a]'
                  : 'text-[#9da0a8] hover:text-[#f3f3ee]'
              }`}
            >
              <Brain className="w-3.5 h-3.5" />
              <span>ذاكرة المشروع (Project Memory)</span>
              {project.projectMemory && <span className="w-1.5 h-1.5 rounded-full bg-[#34d399]" />}
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium transition-colors cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-[#1f2129] text-[#cc785c] border border-[#2c2e3a]'
                  : 'text-[#9da0a8] hover:text-[#f3f3ee]'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>الإعدادات</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── Tab Contents ─── */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6">
        {/* ═══ TAB 1: CHATS ═══ */}
        {activeTab === 'chats' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-[#f3f3ee]">محادثات وجلسات المشروع</h2>
                <p className="text-xs text-[#6b6e79]">
                  تستفيد جميع هذه المحادثات تلقائياً من ذاكرة المشروع وملفاته وموجهه المخصص.
                </p>
              </div>
              <button
                onClick={handleStartNewChat}
                className="px-3 py-1.5 rounded-lg bg-[#cc785c] hover:bg-[#be684e] text-white text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>محادثة جديدة</span>
              </button>
            </div>

            {projectChats.length === 0 ? (
              <div className="border border-[#2c2e3a] rounded-xl bg-[#14151a] p-8 text-center space-y-3">
                <MessageSquare className="w-8 h-8 text-[#4a4d58] mx-auto" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-[#f3f3ee]">لا توجد محادثات مسجلة لهذا المشروع بعد</p>
                  <p className="text-xs text-[#9da0a8]">
                    ابدأ محادثة أولى لتجربة ذكاء الوكيل مع سياق هذا المشروع وملفاته وذاكرته الخاصة.
                  </p>
                </div>
                <button
                  onClick={handleStartNewChat}
                  className="px-4 py-1.5 rounded-lg bg-[#cc785c] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>بدء المحادثة الأولى</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {projectChats.map((chat) => (
                  <div
                    key={chat.id}
                    onClick={() => handleOpenChat(chat.id)}
                    className="group border border-[#2c2e3a] hover:border-[#cc785c]/40 rounded-xl bg-[#14151a] hover:bg-[#161820] p-3.5 flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-[#1f2129] text-[#cc785c]">
                        <MessageSquare className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-xs font-bold text-[#f3f3ee] truncate group-hover:text-[#cc785c] transition-colors">
                          {chat.title || 'مهمة عمل جديدة'}
                        </h3>
                        <span className="text-[11px] text-[#6b6e79]">
                          {chat.messages?.length || 0} رسالة • {new Date(chat.createdAt).toLocaleDateString('ar-EG')}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={(e) => handleDeleteChat(e, chat.id)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-[#6b6e79] hover:text-red-400 rounded transition-all cursor-pointer"
                      title="حذف المحادثة"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ TAB 2: FILES ═══ */}
        {activeTab === 'files' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-[#f3f3ee]">ملفات ومستندات المشروع</h2>
                <p className="text-xs text-[#6b6e79]">
                  يتم استخراج النصوص والمحتوى من هذه الملفات لتزويد الوكيل الذكي بالمعرفة الكاملة عن المشروع.
                </p>
              </div>

              <label className="px-3 py-1.5 rounded-lg bg-[#cc785c] hover:bg-[#be684e] text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer">
                {isUploadingFiles ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                <span>رفع ملفات</span>
                <input
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  disabled={isUploadingFiles}
                  className="hidden"
                />
              </label>
            </div>

            {/* Dropzone / Upload area */}
            <label className="w-full py-6 px-4 border border-dashed border-[#2c2e3a] hover:border-[#cc785c]/60 rounded-xl bg-[#14151a] flex flex-col items-center justify-center gap-2 text-center cursor-pointer transition-colors">
              <Upload className="w-6 h-6 text-[#6b6e79]" />
              <span className="text-xs text-[#f3f3ee] font-medium">اسحب أو انقر لرفع ملفات أو أكواد</span>
              <span className="text-[11px] text-[#6b6e79]">
                يدعم ملفات النصوص والبرمجة والمستندات (PDF, MD, TXT, JSON, TSX, PY, CSS, HTML...)
              </span>
              <input
                type="file"
                multiple
                onChange={handleFileUpload}
                disabled={isUploadingFiles}
                className="hidden"
              />
            </label>

            {/* Files List */}
            {project.files && project.files.length > 0 ? (
              <div className="space-y-2">
                {project.files.map((file) => (
                  <div
                    key={file.id}
                    className="border border-[#2c2e3a] rounded-xl bg-[#14151a] p-3 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-[#1f2129] text-[#cc785c]">
                        <FileCode className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[#f3f3ee] truncate">{file.name}</div>
                        <div className="text-[11px] text-[#6b6e79] flex items-center gap-2">
                          <span>{(file.size / 1024).toFixed(1)} KB</span>
                          <span>•</span>
                          <span>{file.content ? 'تم استخراج النص' : 'ملف ثنائي'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {file.dataUrl && (
                        <a
                          href={file.dataUrl}
                          download={file.name}
                          className="p-1.5 text-[#6b6e79] hover:text-[#f3f3ee] transition-colors"
                          title="تحميل الملف"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button
                        onClick={() => handleDeleteFile(file.id, file.name)}
                        className="p-1.5 text-[#6b6e79] hover:text-red-400 transition-colors cursor-pointer"
                        title="حذف الملف"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-[#6b6e79]">
                لا توجد ملفات مرفوعة لهذا المشروع حتى الآن.
              </div>
            )}
          </div>
        )}

        {/* ═══ TAB 3: PROJECT MEMORY ═══ */}
        {activeTab === 'memory' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-[#f3f3ee]">ذاكرة المشروع (Project Memory)</h2>
                <p className="text-xs text-[#6b6e79]">
                  ذاكرة دائمة مخصصة حصراً لهذا المشروع؛ يحتفظ بها الوكيل الذكي عبر جميع محادثات وجلسات هذا المشروع.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClearMemory}
                  className="px-3 py-1.5 rounded-lg border border-red-900/40 hover:bg-red-950/30 text-xs font-medium text-red-400 transition-colors cursor-pointer"
                >
                  إفراغ الذاكرة
                </button>

                <button
                  type="button"
                  onClick={handleSaveMemory}
                  disabled={isSavingMemory}
                  className="px-4 py-1.5 rounded-lg bg-[#cc785c] hover:bg-[#be684e] text-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSavingMemory ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>حفظ الذاكرة</span>
                </button>
              </div>
            </div>

            {memorySavedSuccess && (
              <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800 text-xs text-emerald-300 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>تم حفظ وتحديث ذاكرة هذا المشروع بنجاح!</span>
              </div>
            )}

            <div className="p-4 rounded-xl border border-[#2c2e3a] bg-[#14151a]">
              <textarea
                value={editedMemory}
                onChange={(e) => setEditedMemory(e.target.value)}
                rows={16}
                className="w-full bg-transparent font-mono text-xs text-[#f3f3ee] resize-y outline-none leading-relaxed"
                placeholder="اكتب هنا أي تفاصيل أو قواعد أو قرارات تصميمية خاصة بهذا المشروع فقط (مثل التقنيات المستخدمة، ألوان التصميم، هيكلية قاعدة البيانات، إلخ)..."
              />
            </div>

            <div className="p-4 rounded-xl bg-[#14151a] border border-[#2c2e3a] text-xs text-[#9da0a8] space-y-1">
              <span className="font-semibold text-[#f3f3ee]">💡 كيف تعمل ذاكرة المشروع؟</span>
              <p>
                كلما تحدثت مع الوكيل الذكي داخل هذا المشروع، يقوم النظام تلقائياً بتضمين هذا النص كمعرفة مسبقة، مما يجعله يفهم المشروع تماماً دون الحاجة لتكرار الشرح في كل محادثة جديدة.
              </p>
            </div>
          </div>
        )}

        {/* ═══ TAB 4: SETTINGS ═══ */}
        {activeTab === 'settings' && (
          <div className="space-y-6 max-w-2xl">
            <div>
              <h2 className="text-sm font-bold text-[#f3f3ee]">إعدادات المشروع</h2>
              <p className="text-xs text-[#6b6e79]">تعديل الاسم والوصف ورابط الموقع وشعار المشروع.</p>
            </div>

            {settingsSavedSuccess && (
              <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800 text-xs text-emerald-300 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>تم حفظ الإعدادات بنجاح!</span>
              </div>
            )}

            <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#9da0a8] mb-1 font-medium">اسم المشروع</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#2c2e3a] bg-[#14151a] text-[#f3f3ee] focus:border-[#cc785c] focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-[#9da0a8] mb-1 font-medium">وصف المشروع</label>
                <textarea
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#2c2e3a] bg-[#14151a] text-[#f3f3ee] focus:border-[#cc785c] focus:outline-none transition-colors resize-none"
                />
              </div>

              <div>
                <label className="block text-[#9da0a8] mb-1 font-medium">رابط الموقع الإلكتروني</label>
                <input
                  type="url"
                  value={editWebsite}
                  onChange={(e) => setEditWebsite(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full px-3 py-2 rounded-lg border border-[#2c2e3a] bg-[#14151a] text-[#f3f3ee] focus:border-[#cc785c] focus:outline-none transition-colors"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-[#9da0a8] mb-1 font-medium">شعار المشروع (Logo)</label>
                <div className="flex items-center gap-3">
                  {editLogo ? (
                    <img
                      src={editLogo}
                      alt="Logo"
                      className="w-12 h-12 rounded-lg object-cover border border-[#2c2e3a] bg-[#0d0e11]"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-[#14151a] border border-[#2c2e3a] border-dashed flex items-center justify-center text-[#6b6e79]">
                      <Upload className="w-4 h-4" />
                    </div>
                  )}

                  <label className="px-3 py-1.5 rounded-lg border border-[#2c2e3a] hover:border-[#cc785c] text-[#f3f3ee] text-xs transition-colors cursor-pointer">
                    <span>{editLogo ? 'تغيير الشعار' : 'رفع شعار'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoChange}
                      className="hidden"
                    />
                  </label>

                  {editLogo && (
                    <button
                      type="button"
                      onClick={() => setEditLogo(undefined)}
                      className="text-red-400 hover:underline text-[11px]"
                    >
                      إزالة
                    </button>
                  )}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSavingSettings}
                  className="px-4 py-2 rounded-lg bg-[#cc785c] hover:bg-[#be684e] text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSavingSettings && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>حفظ التعديلات</span>
                </button>
              </div>
            </form>

            {/* Danger Zone */}
            <div className="pt-6 border-t border-red-950/40 space-y-3">
              <h3 className="text-xs font-bold text-red-400">منطقة الخطر</h3>
              <p className="text-xs text-[#6b6e79]">
                حذف هذا المشروع سيؤدي إلى إزالة كافة ملفاته وبيانات ذاكرته نهائياً.
              </p>
              <button
                type="button"
                onClick={handleDeleteProject}
                className="px-4 py-2 rounded-lg border border-red-900/60 bg-red-950/20 hover:bg-red-950/40 text-red-400 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>حذف هذا المشروع نهائياً</span>
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
