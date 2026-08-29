import React, { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import type { Message } from '../../types/chat'
import { McpConnectCard } from './McpConnectCard'
import { McpToolExecutionCard } from './McpToolExecutionCard'
import { MaestroTodoListCard } from './MaestroTodoListCard'
import { ActiveTaskCard } from './ActiveTaskCard'
import { RichMarkdownRenderer } from './RichMarkdownRenderer'
import type { MaestroPlan } from '../../types/orchestrator'

interface ChatMessageProps {
  message: Message
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const [copied, setCopied] = useState(false)
  const isUser = message.role === 'user'

  const copyToClipboard = () => {
    const plainText = message.content.replace(/<[^>]*>?/gm, '')
    navigator.clipboard.writeText(plainText || message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const renderContent = (content: string) => {
    const cleanContent = content
      .replace(/:::todo-list[\s\S]*?:::/g, '')
      .replace(/```todo-list[\s\S]*?```/g, '')
      .trim()

    const blockPattern = /(?:```|:::)(?:mcp-(?:connect|tool-call)|maestro-plan)\s*[\s\S]*?(?:```|:::)/g
    const splitParts = cleanContent.split(blockPattern)
    const matchedBlocks = cleanContent.match(blockPattern) || []

    let fallbackMcp: { name: string; url: string; service: string } | null = null
    if (matchedBlocks.length === 0 && !isUser) {
      const urlMatch = content.match(/https?:\/\/mcp\.[a-zA-Z0-9.-]+[^\s)"]*/)
      if (urlMatch) {
        const detectedUrl = urlMatch[0].replace(/[.,;:!?]+$/, '')
        const isTickTick = detectedUrl.includes('ticktick')
        fallbackMcp = {
          name: isTickTick ? 'TickTick MCP' : 'خادم MCP',
          url: detectedUrl,
          service: isTickTick ? 'ticktick' : 'custom',
        }
      }
    }

    const elements: React.ReactNode[] = []

    splitParts.forEach((part, i) => {
      if (part.trim()) {
        if (isUser) {
          elements.push(
            <div key={`text-${i}`} className="whitespace-pre-wrap leading-relaxed">
              {part}
            </div>
          )
        } else {
          elements.push(
            <RichMarkdownRenderer key={`md-${i}`} content={part} className="my-0.5" />
          )
        }
      }

      if (matchedBlocks[i]) {
        const rawBlock = matchedBlocks[i]
        const isConnect = rawBlock.includes('mcp-connect')
        const isToolCall = rawBlock.includes('mcp-tool-call')
        const isMaestroPlan = rawBlock.includes('maestro-plan')

        try {
          const jsonStr = rawBlock
            .replace(/^(?:```|:::)(?:mcp-(?:connect|tool-call)|maestro-plan)\s*/, '')
            .replace(/(?:```|:::)$/, '')
            .trim()
          const parsed = JSON.parse(jsonStr)

          if (isMaestroPlan) {
            elements.push(<MaestroTodoListCard key={`maestro-${i}`} plan={parsed as MaestroPlan} />)
          } else if (isConnect) {
            elements.push(
              <McpConnectCard key={`mcp-conn-${i}`} name={parsed.name || 'MCP Server'} url={parsed.url} service={parsed.service || 'custom'} />
            )
          } else if (isToolCall) {
            elements.push(
              <McpToolExecutionCard key={`mcp-tool-${i}`} server={parsed.server || 'ticktick'} tool={parsed.tool || 'ticktick_create_task'} params={parsed.params || {}} />
            )
          }
        } catch {
          elements.push(
            <pre key={`err-${i}`} className="p-2 text-xs bg-[#1a1b22] rounded border border-[#2c2e3a] text-[#9da0a8] overflow-x-auto">
              {rawBlock}
            </pre>
          )
        }
      }
    })

    if (fallbackMcp) {
      elements.push(
        <McpConnectCard key="fallback-mcp" name={fallbackMcp.name} url={fallbackMcp.url} service={fallbackMcp.service} />
      )
    }

    return elements
  }

  return (
    <div className="w-full py-3 px-4">
      <div className="max-w-3xl mx-auto">
        {isUser ? (
          /* ═══ User Message — Terminal prompt style ═══ */
          <div className="flex items-start gap-2">
            <span className="text-[#cc785c] text-sm font-bold select-none shrink-0 pt-0.5">❯</span>
            <div className="text-sm text-[#f3f3ee] leading-relaxed whitespace-pre-wrap">
              {message.content}
            </div>
          </div>
        ) : (
          /* ═══ Assistant Message — Clean output style ═══ */
          <div className="pr-4 min-w-0 w-full overflow-hidden">
            {message.content ? (
              <>
                <div className="text-sm text-[#e6e1cf] leading-relaxed min-w-0 w-full">
                  {renderContent(message.content)}
                </div>

                {/* Copy action */}
                <div className="mt-2 pt-2 border-t border-[#1e1f28]">
                  <button
                    onClick={copyToClipboard}
                    className="text-[11px] text-[#6b6e79] hover:text-[#9da0a8] flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? 'تم النسخ' : 'نسخ'}</span>
                  </button>
                </div>
              </>
            ) : (
              /* Thinking / Loading indicator */
              <div className="flex items-center gap-2 text-[#6b6e79] py-1 select-none">
                <span className="braille-spinner" />
                <span className="text-xs animate-gentle-pulse">جاري التحليل...</span>
              </div>
            )}

            {/* Active Task (single, orchestrator-driven, animated swap) */}
            {message.plan && <ActiveTaskCard plan={message.plan} />}
          </div>
        )}
      </div>
    </div>
  )
}
