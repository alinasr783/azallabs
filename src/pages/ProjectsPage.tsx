import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Globe, FileText, MessageSquare, Trash2, ArrowRight, Upload, X, Loader2, FolderKanban } from 'lucide-react'
import { useProjects } from '../context/ProjectContext'

export const ProjectsPage: React.FC = () => {
  const { projects, createProject, deleteProject, loading, setActiveProjectId } = useProjects()
  const navigate = useNavigate()

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [logoPreview, setLogoPreview] = useState<string | undefined>(undefined)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setErrorMsg('يرجى اختيار صورة صالحة للوجو.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setLogoPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    const filesArray = Array.from(e.target.files)
    setSelectedFiles((prev) => [...prev, ...filesArray])
  }

  const handleRemoveSelectedFile = (idx: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    if (!name.trim()) {
      setErrorMsg('يرجى كتابة اسم المشروع.')
      return
    }

    setIsSubmitting(true)
    try {
      const created = await createProject({
        name: name.trim(),
        description: description.trim(),
        websiteUrl: websiteUrl.trim() || undefined,
        logoUrl: logoPreview,
        files: selectedFiles,
      })

      setIsCreateModalOpen(false)
      setName('')
      setDescription('')
      setWebsiteUrl('')
      setLogoPreview(undefined)
      setSelectedFiles([])

      // Navigate to project detail
      navigate(`/projects/${created.id}`)
    } catch (err: any) {
      setErrorMsg(err.message || 'فشل إنشاء المشروع.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (e: React.MouseEvent, id: string, projName: string) => {
    e.stopPropagation()
    if (window.confirm(`هل أنت متأكد من رغبتك في حذف مشروع "${projName}" وجميع بياناته؟`)) {
      await deleteProject(id)
    }
  }

  const handleStartChat = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation()
    setActiveProjectId(projectId)
    navigate(`/?projectId=${projectId}`)
  }

  return (
    <div className="min-h-screen bg-[#0d0e11] text-[#f3f3ee] flex flex-col font-sans" dir="rtl">
      {/* ─── Top Navigation Bar ─── */}
      <header className="h-14 px-4 sm:px-6 border-b border-[#2c2e3a] bg-[#14151a] flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="p-1.5 rounded-lg text-[#9da0a8] hover:text-[#f3f3ee] hover:bg-[#1f2129] transition-colors"
            title="العودة للمحادثة"
          >
            <ArrowRight className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2">
            <FolderKanban className="w-4 h-4 text-[#cc785c]" />
            <span className="text-base font-bold text-[#f3f3ee]">المشاريع</span>
          </div>
          <span className="text-xs text-[#6b6e79] hidden sm:inline">
            — إدارة وتنظيم سياق مشاريعك وذاكرتها المخصصة
          </span>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-3.5 py-1.5 rounded-lg bg-[#cc785c] hover:bg-[#be684e] text-white flex items-center gap-1.5 text-xs font-bold transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>مشروع جديد</span>
        </button>
      </header>

      {/* ─── Main Content ─── */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-[#6b6e79]">
            <span className="braille-spinner text-[#cc785c] mb-2" />
            <span className="text-xs animate-gentle-pulse">جاري تحميل المشاريع...</span>
          </div>
        ) : projects.length === 0 ? (
          /* Empty State */
          <div className="border border-[#2c2e3a] rounded-xl bg-[#14151a] p-8 text-center max-w-lg mx-auto my-12 space-y-4">
            <div className="w-12 h-12 rounded-full bg-[#cc785c]/10 border border-[#cc785c]/30 flex items-center justify-center mx-auto text-[#cc785c]">
              <FolderKanban className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-bold text-[#f3f3ee]">لا توجد مشاريع حتى الآن</h2>
              <p className="text-xs text-[#9da0a8] leading-relaxed max-w-sm mx-auto">
                أنشئ مشروعك الأول لربط الملفات، والمستندات، ورابط الموقع، وتخصيص ذاكرة مستقلة للوكيل الذكي داخل هذا المشروع.
              </p>
            </div>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-4 py-2 rounded-lg bg-[#cc785c] hover:bg-[#be684e] text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إنشاء أول مشروع</span>
            </button>
          </div>
        ) : (
          /* Projects Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.map((project) => (
              <div
                key={project.id}
                onClick={() => navigate(`/projects/${project.id}`)}
                className="group border border-[#2c2e3a] hover:border-[#cc785c]/50 rounded-xl bg-[#14151a] hover:bg-[#161820] transition-all p-5 flex flex-col justify-between cursor-pointer space-y-4 shadow-sm"
              >
                <div className="space-y-3">
                  {/* Top Row: Logo & Action */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {project.logoUrl ? (
                        <img
                          src={project.logoUrl}
                          alt={project.name}
                          className="w-10 h-10 rounded-lg object-cover border border-[#2c2e3a] shrink-0 bg-[#0d0e11]"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-[#1f2129] border border-[#2c2e3a] flex items-center justify-center text-sm font-bold text-[#cc785c] shrink-0">
                          {project.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-[#f3f3ee] truncate group-hover:text-[#cc785c] transition-colors">
                          {project.name}
                        </h3>
                        {project.websiteUrl && (
                          <a
                            href={project.websiteUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-[11px] text-[#38bdf8] hover:underline flex items-center gap-1 mt-0.5 truncate"
                          >
                            <Globe className="w-3 h-3 shrink-0" />
                            <span className="truncate">{project.websiteUrl.replace(/^https?:\/\//, '')}</span>
                          </a>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={(e) => handleDelete(e, project.id, project.name)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-[#6b6e79] hover:text-red-400 rounded hover:bg-red-950/20 transition-all cursor-pointer"
                      title="حذف المشروع"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-[#9da0a8] line-clamp-2 leading-relaxed">
                    {project.description || 'لا يوجد وصف مضاف لهذا المشروع.'}
                  </p>
                </div>

                {/* Footer Badges & Actions */}
                <div className="pt-3 border-t border-[#262833] flex items-center justify-between text-[11px] text-[#6b6e79]">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <FileText className="w-3 h-3 text-[#cc785c]" />
                      <span>{project.files?.length || 0} ملفات</span>
                    </span>
                    {project.projectMemory && (
                      <span className="text-[#34d399] font-medium">● ذاكرة نشطة</span>
                    )}
                  </div>

                  <button
                    onClick={(e) => handleStartChat(e, project.id)}
                    className="px-2.5 py-1 rounded bg-[#1f2129] hover:bg-[#cc785c] text-[#f3f3ee] hover:text-white transition-colors flex items-center gap-1 font-medium cursor-pointer text-xs"
                  >
                    <MessageSquare className="w-3 h-3" />
                    <span>محادثة</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ─── Create Project Modal ─── */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-[#14151a] border border-[#2c2e3a] rounded-xl shadow-2xl overflow-hidden my-8">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-[#2c2e3a] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderKanban className="w-4 h-4 text-[#cc785c]" />
                <span className="text-sm font-bold text-[#f3f3ee]">إنشاء مشروع جديد</span>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 text-[#6b6e79] hover:text-[#f3f3ee] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateSubmit} className="p-5 space-y-4 text-xs">
              {errorMsg && (
                <div className="p-3 rounded-lg bg-red-950/40 border border-red-800 text-red-300">
                  {errorMsg}
                </div>
              )}

              {/* Project Name */}
              <div>
                <label className="block text-[#9da0a8] mb-1 font-medium">
                  اسم المشروع <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: تطبيق طبيبي، أكاديمية 800، متجر العطور..."
                  className="w-full px-3 py-2 rounded-lg border border-[#2c2e3a] bg-[#0d0e11] text-[#f3f3ee] focus:border-[#cc785c] focus:outline-none transition-colors"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-[#9da0a8] mb-1 font-medium">وصف المشروع</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="نبذة عن فكرة المشروع والجمهور المستهدف ونوع التقنيات المستخدمة..."
                  className="w-full px-3 py-2 rounded-lg border border-[#2c2e3a] bg-[#0d0e11] text-[#f3f3ee] focus:border-[#cc785c] focus:outline-none transition-colors resize-none"
                />
              </div>

              {/* Website URL */}
              <div>
                <label className="block text-[#9da0a8] mb-1 font-medium">رابط الموقع الإلكتروني (إن وجد)</label>
                <input
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full px-3 py-2 rounded-lg border border-[#2c2e3a] bg-[#0d0e11] text-[#f3f3ee] focus:border-[#cc785c] focus:outline-none transition-colors"
                  dir="ltr"
                />
              </div>

              {/* Logo Upload */}
              <div>
                <label className="block text-[#9da0a8] mb-1 font-medium">لوجو المشروع (شعار)</label>
                <div className="flex items-center gap-3">
                  {logoPreview ? (
                    <img
                      src={logoPreview}
                      alt="Logo preview"
                      className="w-12 h-12 rounded-lg object-cover border border-[#2c2e3a] shrink-0 bg-[#0d0e11]"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-[#0d0e11] border border-[#2c2e3a] border-dashed flex items-center justify-center text-[#6b6e79] shrink-0">
                      <Upload className="w-4 h-4" />
                    </div>
                  )}

                  <label className="px-3 py-1.5 rounded-lg border border-[#2c2e3a] hover:border-[#cc785c] text-[#f3f3ee] text-xs transition-colors cursor-pointer">
                    <span>{logoPreview ? 'تغيير اللوجو' : 'رفع صورة اللوجو'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoChange}
                      className="hidden"
                    />
                  </label>

                  {logoPreview && (
                    <button
                      type="button"
                      onClick={() => setLogoPreview(undefined)}
                      className="text-red-400 hover:underline text-[11px]"
                    >
                      إزالة
                    </button>
                  )}
                </div>
              </div>

              {/* Initial Files Upload */}
              <div>
                <label className="block text-[#9da0a8] mb-1 font-medium">
                  رفع مستندات أو ملفات تخص المشروع (اختياري)
                </label>
                <label className="w-full py-4 px-3 border border-dashed border-[#2c2e3a] hover:border-[#cc785c]/60 rounded-lg bg-[#0d0e11] flex flex-col items-center justify-center gap-1.5 text-center cursor-pointer transition-colors">
                  <Upload className="w-5 h-5 text-[#6b6e79]" />
                  <span className="text-[#9da0a8]">اسحب أو اضغط لرفع ملفات (PDF, TXT, MD, Code...)</span>
                  <span className="text-[10px] text-[#6b6e79]">يتم استخراج وتحليل النصوص لتضمينها في سياق الوكيل الذكي</span>
                  <input
                    type="file"
                    multiple
                    onChange={handleFilesChange}
                    className="hidden"
                  />
                </label>

                {selectedFiles.length > 0 && (
                  <div className="mt-2 space-y-1 max-h-28 overflow-y-auto">
                    {selectedFiles.map((f, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between px-2.5 py-1 rounded bg-[#1f2129] text-[11px]"
                      >
                        <span className="truncate max-w-[260px] text-[#f3f3ee]">{f.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[#6b6e79]">{(f.size / 1024).toFixed(1)} KB</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveSelectedFile(idx)}
                            className="text-red-400 hover:text-red-300"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-[#2c2e3a] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-[#2c2e3a] hover:bg-[#1a1b22] text-[#9da0a8] text-xs transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded-lg bg-[#cc785c] hover:bg-[#be684e] text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>إنشاء المشروع</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
