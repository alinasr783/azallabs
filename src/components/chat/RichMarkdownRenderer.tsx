import React from 'react'

interface RichMarkdownRendererProps {
  content: string
  className?: string
}

export const RichMarkdownRenderer: React.FC<RichMarkdownRendererProps> = ({ content, className = '' }) => {
  // 1. Inline renderer for Bold (**text** or __text__), Inline Code (`code`), Links ([text](url)), and Italic (*text*)
  const renderInline = (text: string): React.ReactNode[] => {
    if (!text) return []

    const parts: React.ReactNode[] = []
    const tokenRegex = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\[[^\]]+\]\([^)]+\)|\*[^*]+\*|_[^_]+_)/g

    let lastIdx = 0
    let match: RegExpExecArray | null

    while ((match = tokenRegex.exec(text)) !== null) {
      const matchStart = match.index
      const matchStr = match[0]

      if (matchStart > lastIdx) {
        parts.push(text.slice(lastIdx, matchStart))
      }

      if ((matchStr.startsWith('**') && matchStr.endsWith('**')) || (matchStr.startsWith('__') && matchStr.endsWith('__'))) {
        const inner = matchStr.slice(2, -2)
        parts.push(
          <strong
            key={`bold-${matchStart}`}
            className="font-bold text-[#f3f3ee] text-[13.5px] px-0.5"
          >
            {renderInline(inner)}
          </strong>
        )
      } else if (matchStr.startsWith('`') && matchStr.endsWith('`')) {
        const inner = matchStr.slice(1, -1)
        parts.push(
          <code
            key={`code-${matchStart}`}
            className="px-1.5 py-0.5 rounded bg-[#14151a] text-[#cc785c] border border-[#2c2e3a] text-xs mx-0.5 select-all font-bold"
          >
            {inner}
          </code>
        )
      } else if (matchStr.startsWith('[') && matchStr.includes('](')) {
        const label = matchStr.slice(1, matchStr.indexOf(']('))
        const url = matchStr.slice(matchStr.indexOf('](') + 2, -1)
        parts.push(
          <a
            key={`link-${matchStart}`}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#38bdf8] hover:underline font-medium transition-colors"
          >
            {label}
          </a>
        )
      } else if ((matchStr.startsWith('*') && matchStr.endsWith('*')) || (matchStr.startsWith('_') && matchStr.endsWith('_'))) {
        const inner = matchStr.slice(1, -1)
        parts.push(
          <em key={`em-${matchStart}`} className="italic text-[#9da0a8]">
            {inner}
          </em>
        )
      }

      lastIdx = matchStart + matchStr.length
    }

    if (lastIdx < text.length) {
      parts.push(text.slice(lastIdx))
    }

    return parts
  }

  // Pre-process lines
  const rawLines = content.split('\n')
  const normalizedLines: string[] = []

  for (let i = 0; i < rawLines.length; i++) {
    const curr = rawLines[i].trim()
    if (/^#{1,6}$/.test(curr) && i + 1 < rawLines.length && rawLines[i + 1].trim()) {
      normalizedLines.push(`${curr} ${rawLines[i + 1].trim()}`)
      i++
      continue
    }
    normalizedLines.push(rawLines[i])
  }

  const elements: React.ReactNode[] = []

  let inCodeBlock = false
  let codeBlockContent: string[] = []
  let codeBlockLang = ''

  let inTable = false
  let tableRows: string[][] = []

  let inList = false
  let listItems: React.ReactNode[] = []
  let isNumberedList = false

  const flushList = (key: string) => {
    if (listItems.length > 0) {
      if (isNumberedList) {
        elements.push(
          <ol key={key} className="space-y-1 my-2 list-decimal pr-5 text-xs sm:text-sm text-[#f3f3ee] leading-relaxed">
            {listItems}
          </ol>
        )
      } else {
        elements.push(
          <ul key={key} className="space-y-1 my-2 list-disc pr-5 text-xs sm:text-sm text-[#f3f3ee] leading-relaxed">
            {listItems}
          </ul>
        )
      }
      listItems = []
      inList = false
    }
  }

  const flushTable = (key: string) => {
    if (tableRows.length > 0) {
      const [header, ...body] = tableRows
      elements.push(
        <div
          key={key}
          className="w-full my-3.5 overflow-x-auto rounded-lg border border-[#2c2e3a] bg-[#14151a] shadow-inner"
          dir="rtl"
        >
          <table className="min-w-max w-full text-xs text-right border-collapse select-text">
            <thead>
              <tr className="bg-[#1a1b22] border-b border-[#2c2e3a]">
                {header.map((col, idx) => (
                  <th
                    key={idx}
                    className="px-4 py-2.5 font-semibold text-[#cc785c] tracking-wide whitespace-nowrap"
                  >
                    {renderInline(col.trim())}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#20222b]">
              {body.length > 0 ? (
                body.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-[#1a1b22]/50 transition-colors">
                    {row.map((cell, cIdx) => {
                      const trimmedCell = cell.trim()
                      const isId = /^[0-9a-f]{20,32}$/i.test(trimmedCell)
                      return (
                        <td
                          key={cIdx}
                          className="px-4 py-2.5 text-[#f3f3ee] whitespace-nowrap leading-relaxed"
                        >
                          {isId ? (
                            <code className="px-2 py-0.5 rounded bg-[#0d0e11] text-[#cc785c] font-mono text-[11px] border border-[#2c2e3a] select-all">
                              {trimmedCell}
                            </code>
                          ) : (
                            renderInline(trimmedCell)
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))
              ) : null}
            </tbody>
          </table>
        </div>
      )
      tableRows = []
      inTable = false
    }
  }

  normalizedLines.forEach((line, lineIdx) => {
    const trimmed = line.trim()

    // 1. Code Block Fence (```)
    if (trimmed.startsWith('```')) {
      if (!inCodeBlock) {
        flushList(`list-before-code-${lineIdx}`)
        flushTable(`table-before-code-${lineIdx}`)
        inCodeBlock = true
        codeBlockLang = trimmed.replace(/^```/, '').trim()
        codeBlockContent = []
      } else {
        inCodeBlock = false
        elements.push(
          <div key={`codeblock-${lineIdx}`} className="my-2.5 rounded-lg overflow-hidden border border-[#2c2e3a] bg-[#0d0e11]">
            <div className="bg-[#14151a] px-3 py-1 text-[11px] text-[#6b6e79] border-b border-[#2c2e3a] flex items-center justify-between">
              <span className="font-mono text-[#cc785c]">{codeBlockLang || 'code'}</span>
              <span>شيفرة برمجية</span>
            </div>
            <pre className="p-3 text-xs sm:text-sm overflow-x-auto text-[#f3f3ee] leading-relaxed text-right">
              <code>{codeBlockContent.join('\n')}</code>
            </pre>
          </div>
        )
      }
      return
    }

    if (inCodeBlock) {
      codeBlockContent.push(line)
      return
    }

    // 2. Horizontal Rules (---, ***, ___)
    if (/^(\*{3,}|-{3,}|_{3,})$/.test(trimmed)) {
      flushList(`list-before-hr-${lineIdx}`)
      flushTable(`table-before-hr-${lineIdx}`)
      elements.push(
        <hr key={`hr-${lineIdx}`} className="my-3 border-t border-[#2c2e3a]" />
      )
      return
    }

    // 3. Table Rows (Supports both Markdown pipe tables and tab-delimited tables)
    const isTableSeparator = /^\|?[\s-:]+\|[\s-:|]+$/.test(trimmed)
    const isPipeTableRow =
      (trimmed.startsWith('|') && trimmed.includes('|', 1)) ||
      (trimmed.includes('|') && trimmed.split('|').length >= 3)
    const isTabTableRow =
      trimmed.includes('\t') && trimmed.split('\t').filter(Boolean).length >= 2
    const isTableRow = isPipeTableRow || isTabTableRow

    if (isTableSeparator) {
      if (tableRows.length > 0) {
        inTable = true
        return
      }
    } else if (isTableRow) {
      flushList(`list-before-table-${lineIdx}`)
      let cleanRow = trimmed
      if (isPipeTableRow) {
        if (cleanRow.startsWith('|')) cleanRow = cleanRow.substring(1)
        if (cleanRow.endsWith('|')) cleanRow = cleanRow.substring(0, cleanRow.length - 1)
        const cols = cleanRow.split('|')
        tableRows.push(cols)
      } else if (isTabTableRow) {
        const cols = cleanRow.split('\t').filter(Boolean)
        tableRows.push(cols)
      }
      inTable = true
      return
    } else if (inTable) {
      flushTable(`table-${lineIdx}`)
    }

    // 4. Headings (#, ##, ###, ####, #####, ######)
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/)
    if (headingMatch) {
      flushList(`list-before-h-${lineIdx}`)
      const level = headingMatch[1].length
      const headingContent = headingMatch[2]

      if (level === 1) {
        elements.push(
          <h1 key={`h1-${lineIdx}`} className="text-lg sm:text-xl font-bold text-[#f3f3ee] mt-4 mb-2 pb-1 border-b border-[#2c2e3a]">
            {renderInline(headingContent)}
          </h1>
        )
      } else if (level === 2) {
        elements.push(
          <h2 key={`h2-${lineIdx}`} className="text-base sm:text-lg font-bold text-[#f3f3ee] mt-3.5 mb-1.5">
            {renderInline(headingContent)}
          </h2>
        )
      } else if (level === 3) {
        elements.push(
          <h3 key={`h3-${lineIdx}`} className="text-sm sm:text-base font-semibold text-[#cc785c] mt-3 mb-1">
            {renderInline(headingContent)}
          </h3>
        )
      } else {
        elements.push(
          <h4 key={`h4-${lineIdx}`} className="text-xs sm:text-sm font-semibold text-[#9da0a8] mt-2.5 mb-1">
            {renderInline(headingContent)}
          </h4>
        )
      }
      return
    }

    // 5. Blockquotes (> text) — RTL right border
    if (trimmed.startsWith('>')) {
      flushList(`list-before-quote-${lineIdx}`)
      const quoteText = trimmed.replace(/^>\s*/, '')
      elements.push(
        <blockquote
          key={`quote-${lineIdx}`}
          className="border-r-2 border-[#cc785c] pr-3 my-2 text-xs sm:text-sm text-[#9da0a8] bg-[#14151a]/40 py-1 rounded-l leading-relaxed"
        >
          {renderInline(quoteText)}
        </blockquote>
      )
      return
    }

    // 6. Unordered List Items (- item, * item, • item)
    const bulletMatch = trimmed.match(/^[-*•]\s+(.*)/)
    if (bulletMatch) {
      inList = true
      isNumberedList = false
      listItems.push(
        <li key={`li-${lineIdx}`} className="leading-relaxed">
          {renderInline(bulletMatch[1])}
        </li>
      )
      return
    }

    // 7. Numbered List Items (1. item, 2. item)
    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)/)
    if (numberedMatch) {
      inList = true
      isNumberedList = true
      listItems.push(
        <li key={`oli-${lineIdx}`} className="leading-relaxed">
          {renderInline(numberedMatch[2])}
        </li>
      )
      return
    }

    // Not a list item anymore -> flush
    if (inList) {
      flushList(`list-${lineIdx}`)
    }

    // 8. Tool or Action Definition Line
    const toolDefMatch = trimmed.match(/^([a-zA-Z0-9_\-\s/]+):\s+(.*)$/)
    if (toolDefMatch && !trimmed.startsWith('http') && toolDefMatch[1].length < 45) {
      const toolNames = toolDefMatch[1].split('/').map((t) => t.trim())
      const description = toolDefMatch[2]

      elements.push(
        <div key={`tool-def-${lineIdx}`} className="my-1 pr-1 flex items-start gap-1.5 text-xs sm:text-sm leading-relaxed">
          <div className="flex flex-wrap items-center gap-1 shrink-0 pt-0.5">
            {toolNames.map((tName, tIdx) => (
              <span
                key={tIdx}
                className="px-1.5 py-0.2 rounded bg-[#14151a] text-[#cc785c] text-[11px] border border-[#2c2e3a] select-all font-mono"
              >
                {tName}
              </span>
            ))}
          </div>
          <span className="text-[#6b6e79] font-bold select-none pt-0.5">:</span>
          <div className="text-[#f3f3ee] flex-1">
            {renderInline(description)}
          </div>
        </div>
      )
      return
    }

    // 9. Spacing
    if (!trimmed) {
      elements.push(<div key={`space-${lineIdx}`} className="h-1.5" />)
      return
    }

    // 10. Regular paragraph
    elements.push(
      <p key={`p-${lineIdx}`} className="my-1 text-xs sm:text-sm leading-relaxed text-[#f3f3ee]">
        {renderInline(line)}
      </p>
    )
  })

  flushList('list-end')
  flushTable('table-end')

  return <div className={`rich-markdown-content space-y-0.5 ${className}`}>{elements}</div>
}
