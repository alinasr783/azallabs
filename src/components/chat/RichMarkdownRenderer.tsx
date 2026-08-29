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
    // Match: **bold**, __bold__, `code`, [link](url), *italic*, _italic_
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
            className="px-2 py-0.5 rounded-md bg-[#181920] text-[#cc785c] border border-[#2b2d3a] text-xs mx-1 select-all font-bold"
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
            className="text-[#cc785c] hover:underline font-medium hover:text-[#e58c65] transition-colors"
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

  // Pre-process and normalize lines (merge lonely heading markers like "###\nTitle", filter artifacts)
  const rawLines = content.split('\n')
  const normalizedLines: string[] = []

  for (let i = 0; i < rawLines.length; i++) {
    const curr = rawLines[i].trim()

    // If current line is only heading hashes (e.g. "###" or "##" or "####") and next line has content
    if (/^#{1,6}$/.test(curr) && i + 1 < rawLines.length && rawLines[i + 1].trim()) {
      normalizedLines.push(`${curr} ${rawLines[i + 1].trim()}`)
      i++ // skip next line
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
          <ol key={key} className="space-y-1.5 my-2.5 list-decimal pl-5 text-xs sm:text-sm text-[#f3f3ee] leading-relaxed">
            {listItems}
          </ol>
        )
      } else {
        elements.push(
          <ul key={key} className="space-y-1.5 my-2.5 list-disc pl-5 text-xs sm:text-sm text-[#f3f3ee] leading-relaxed">
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
        <div key={key} className="overflow-x-auto my-3.5 rounded-xl border border-[#2b2d3a] bg-[#14151a] shadow-md">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-[#181922] border-b border-[#2b2d3a]">
                {header.map((col, idx) => (
                  <th key={idx} className="p-3 font-semibold text-[#cc785c] tracking-wide whitespace-nowrap">
                    {renderInline(col.trim())}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#222430]">
              {body.length > 0 ? (
                body.map((row, rIdx) => (
                  <tr
                    key={rIdx}
                    className="hover:bg-[#1b1c25] transition-colors"
                  >
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="p-3 text-[#f3f3ee] leading-relaxed">
                        {renderInline(cell.trim())}
                      </td>
                    ))}
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
          <div key={`codeblock-${lineIdx}`} className="my-3 rounded-xl overflow-hidden border border-[#2b2d3a] bg-[#0f1014] shadow-sm" dir="rtl">
            {codeBlockLang && (
              <div className="bg-[#16171e] px-3.5 py-1.5 text-xs text-[#cc785c] border-b border-[#2b2d3a] flex items-center justify-between">
                <span className="font-bold">{codeBlockLang}</span>
                <span className="text-[11px] text-[#6b6e79]">شيفرة برمجية</span>
              </div>
            )}
            <pre className="p-3.5 text-sm overflow-x-auto text-[#f3f3ee] leading-relaxed text-right">
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
        <hr key={`hr-${lineIdx}`} className="my-4 border-t border-[#282a36]" />
      )
      return
    }

    // 3. Table Rows
    const isTableSeparator = /^\|?[\s-:]+\|[\s-:|]+$/.test(trimmed)
    const isTableRow =
      (trimmed.startsWith('|') && trimmed.includes('|', 1)) ||
      (trimmed.includes('|') && trimmed.split('|').length >= 3)

    if (isTableSeparator) {
      if (tableRows.length > 0) {
        inTable = true
        return
      }
    } else if (isTableRow) {
      flushList(`list-before-table-${lineIdx}`)
      let cleanRow = trimmed
      if (cleanRow.startsWith('|')) cleanRow = cleanRow.substring(1)
      if (cleanRow.endsWith('|')) cleanRow = cleanRow.substring(0, cleanRow.length - 1)

      const cols = cleanRow.split('|')
      tableRows.push(cols)
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
          <h1 key={`h1-${lineIdx}`} className="text-xl sm:text-2xl font-bold text-[#f3f3ee] mt-5 mb-2.5 tracking-tight border-b border-[#282a36] pb-1.5">
            {renderInline(headingContent)}
          </h1>
        )
      } else if (level === 2) {
        elements.push(
          <h2 key={`h2-${lineIdx}`} className="text-lg sm:text-xl font-bold text-[#f3f3ee] mt-4 mb-2 tracking-tight">
            {renderInline(headingContent)}
          </h2>
        )
      } else if (level === 3) {
        elements.push(
          <h3 key={`h3-${lineIdx}`} className="text-base sm:text-lg font-semibold text-[#f3f3ee] mt-3.5 mb-1.5 text-[#cc785c]">
            {renderInline(headingContent)}
          </h3>
        )
      } else if (level === 4) {
        elements.push(
          <h4 key={`h4-${lineIdx}`} className="text-sm sm:text-base font-semibold text-[#f3f3ee] mt-3 mb-1.5">
            {renderInline(headingContent)}
          </h4>
        )
      } else {
        elements.push(
          <h5 key={`h5-${lineIdx}`} className="text-xs sm:text-sm font-semibold text-[#9da0a8] mt-2.5 mb-1 uppercase tracking-wider">
            {renderInline(headingContent)}
          </h5>
        )
      }
      return
    }

    // 5. Blockquotes (> text)
    if (trimmed.startsWith('>')) {
      flushList(`list-before-quote-${lineIdx}`)
      const quoteText = trimmed.replace(/^>\s*/, '')
      elements.push(
        <blockquote
          key={`quote-${lineIdx}`}
          className="border-l-3 border-[#cc785c] pl-3.5 my-2.5 text-xs sm:text-sm text-[#9da0a8] bg-[#16171e]/70 p-2.5 rounded-r-xl italic leading-relaxed"
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

    // Not a list item anymore -> flush any open list
    if (inList) {
      flushList(`list-${lineIdx}`)
    }

    // 8. Tool or Action Definition Line (e.g. `search_task: Description` or `list_projects / create_project: Description`)
    const toolDefMatch = trimmed.match(/^([a-zA-Z0-9_\-\s/]+):\s+(.*)$/)
    if (toolDefMatch && !trimmed.startsWith('http') && toolDefMatch[1].length < 45) {
      const toolNames = toolDefMatch[1].split('/').map((t) => t.trim())
      const description = toolDefMatch[2]

      elements.push(
        <div key={`tool-def-${lineIdx}`} className="my-1.5 pr-2 flex items-start gap-2 text-sm sm:text-base leading-relaxed" dir="rtl">
          <div className="flex flex-wrap items-center gap-1 shrink-0 pt-0.5">
            {toolNames.map((tName, tIdx) => (
              <span
                key={tIdx}
                className="px-2 py-0.5 rounded-md bg-[#1c1d27] text-[#cc785c] text-xs border border-[#2c2e3d] font-bold select-all"
              >
                {tName}
              </span>
            ))}
          </div>
          <span className="text-[#9da0a8] font-bold select-none pt-0.5">:</span>
          <div className="text-[#f3f3ee] flex-1">
            {renderInline(description)}
          </div>
        </div>
      )
      return
    }

    // 9. Blank line / spacing
    if (!trimmed) {
      elements.push(<div key={`space-${lineIdx}`} className="h-2" />)
      return
    }

    // 10. Regular paragraph
    elements.push(
      <p key={`p-${lineIdx}`} className="my-1 text-xs sm:text-sm leading-relaxed text-[#f3f3ee]">
        {renderInline(line)}
      </p>
    )
  })

  // Final flush
  flushList('list-end')
  flushTable('table-end')

  return <div className={`rich-markdown-content space-y-1 ${className}`}>{elements}</div>
}
