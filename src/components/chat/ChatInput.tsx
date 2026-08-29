import React, { useState, useRef, useEffect } from 'react'
import { Square } from 'lucide-react'

interface ChatInputProps {
  onSendMessage: (message: string) => void
  isLoading: boolean
  onStop?: () => void
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, isLoading, onStop }) => {
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`
    }
  }, [input])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleSubmit = () => {
    if (!input.trim() || isLoading) return
    onSendMessage(input.trim())
    setInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleInsertShortcut = (shortcut: string) => {
    setInput((prev) => (prev ? `${prev} ${shortcut}` : shortcut))
    textareaRef.current?.focus()
  }

  return (
    <div className="w-full max-w-3xl mx-auto px-3 pb-3 pt-[env(safe-area-inset-bottom)]">
      {/* ╭─ Terminal Input Frame ─────────────────────────────────╮ */}
      <div className="relative border border-[#2c2e3a] rounded-lg bg-[#14151a] focus-within:border-[#cc785c]/60 transition-colors">
        {/* Frame Title */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#2c2e3a]/60">
          <span className="text-[11px] text-[#6b6e79] select-none">azal-labs</span>
          {isLoading && (
            <button
              type="button"
              onClick={onStop}
              className="flex items-center gap-1.5 text-[11px] text-red-400 hover:text-red-300 cursor-pointer transition-colors"
            >
              <Square className="w-2.5 h-2.5 fill-current" />
              <span>إيقاف</span>
            </button>
          )}
        </div>

        {/* Input Area */}
        <div className="flex items-end gap-2 px-3 py-2.5">
          <span className="text-[#cc785c] text-sm font-bold select-none pb-0.5 shrink-0">❯</span>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="ما الذي تريد بناءه؟"
            rows={1}
            className="flex-1 bg-transparent text-[#f3f3ee] placeholder-[#4a4d58] resize-none focus:outline-none text-sm leading-relaxed py-0.5 max-h-[160px] overflow-y-auto"
          />
        </div>
      </div>
      {/* ╰─────────────────────────────────────────────────────────╯ */}

      {/* Keyboard Hints & Shortcuts */}
      <div className="hidden sm:flex items-center justify-between px-1 pt-2 text-[11px] text-[#4a4d58] select-none">
        <div className="flex items-center gap-3">
          <span>? مساعدة</span>
          <span>/ أوامر</span>
          <span>Shift+Enter سطر جديد</span>
        </div>
        <div className="flex items-center gap-2">
          {[
            { label: '/خطة عمل', cmd: '/خطة عمل برمجية شاملة ' },
            { label: 'فحص', cmd: 'افحص راجع هذه الشيفرة بدقة: ' },
            { label: 'مهام', cmd: 'أنشئ قائمة مهام تفاعلية خطوة بخطوة لـ ' },
          ].map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => handleInsertShortcut(s.cmd)}
              className="px-1.5 py-0.5 text-[10px] text-[#6b6e79] hover:text-[#cc785c] transition-colors cursor-pointer"
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
