import React, { useEffect, useRef } from 'react'

interface IsolatedHtmlRendererProps {
  html: string
  className?: string
}

export const IsolatedHtmlRenderer: React.FC<IsolatedHtmlRendererProps> = ({ html, className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const shadowRootRef = useRef<ShadowRoot | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    // 1. إنشاء Shadow Root مرة واحدة لعزل الـ DOM والـ CSS تماماً عن الصفحة
    if (!shadowRootRef.current) {
      try {
        shadowRootRef.current = containerRef.current.attachShadow({ mode: 'open' })
      } catch {
        // Fallback إذا كان قد تم إنشاؤه مسبقاً
        shadowRootRef.current = containerRef.current.shadowRoot
      }
    }

    const shadowRoot = shadowRootRef.current
    if (!shadowRoot) return

    // فحص وضع المظهر (Dark / Light) في الموقع الرئيسي لتمريره للـ Shadow DOM
    const isDark = document.documentElement.classList.contains('dark')

    // 2. تنقية الـ HTML لمنع السكربتات الخبيثة مع الحفاظ على التنسيقات
    const cleanHtml = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/\s+on\w+="[^"]*"/gi, '')
      .replace(/\s+on\w+='[^']*'/gi, '')

    // 3. تنسيقات معزولة تماماً (Scoped CSS) لا يمكن لأي كود داخلي أو <style> أن يتسرب خارجها
    const scopedStyles = `
      :host {
        display: block;
        width: 100%;
        color: ${isDark ? '#e8eaed' : '#202124'};
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Google Sans", "Segoe UI", Roboto, sans-serif;
        font-size: 14px;
        line-height: 1.6;
        direction: rtl;
        text-align: right;
      }

      * {
        box-sizing: border-box;
      }

      p {
        margin: 0 0 8px 0;
        line-height: 1.6;
      }
      p:last-child {
        margin-bottom: 0;
      }

      h1, h2, h3, h4, h5, h6 {
        color: ${isDark ? '#8ab4f8' : '#1a73e8'};
        margin: 12px 0 6px 0;
        font-weight: 600;
        line-height: 1.3;
      }
      h1 { font-size: 1.3rem; }
      h2 { font-size: 1.15rem; }
      h3 { font-size: 1.05rem; }
      h4 { font-size: 0.95rem; }

      ul, ol {
        margin: 6px 0 10px 0;
        padding-right: 20px;
        padding-left: 0;
      }

      li {
        margin-bottom: 4px;
        line-height: 1.5;
      }

      strong, b {
        font-weight: 600;
        color: ${isDark ? '#f1f3f4' : '#1f1f1f'};
      }

      em, i {
        font-style: italic;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        margin: 10px 0;
        font-size: 13px;
        border: 1px solid ${isDark ? '#3c4043' : '#dadce0'};
        border-radius: 8px;
        overflow: hidden;
      }

      th, td {
        padding: 8px 12px;
        border: 1px solid ${isDark ? '#3c4043' : '#dadce0'};
        text-align: right;
      }

      th {
        background-color: ${isDark ? '#28292a' : '#f1f3f4'};
        font-weight: 600;
        color: ${isDark ? '#8ab4f8' : '#1a73e8'};
      }

      tr:nth-child(even) td {
        background-color: ${isDark ? '#202124' : '#f8fafd'};
      }

      blockquote {
        margin: 8px 0;
        padding: 6px 14px;
        border-right: 4px solid ${isDark ? '#8ab4f8' : '#1a73e8'};
        background-color: ${isDark ? '#28292a/50' : '#f1f3f4/60'};
        color: ${isDark ? '#9aa0a6' : '#5f6368'};
        border-radius: 0 8px 8px 0;
      }

      code {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 12px;
        background-color: ${isDark ? '#303134' : '#f1f3f4'};
        color: ${isDark ? '#f28b82' : '#d93025'};
        padding: 2px 5px;
        border-radius: 4px;
        direction: ltr;
        display: inline-block;
      }

      pre {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 12px;
        background-color: ${isDark ? '#202124' : '#f8fafd'};
        border: 1px solid ${isDark ? '#3c4043' : '#dadce0'};
        border-radius: 8px;
        padding: 10px;
        overflow-x: auto;
        margin: 8px 0;
        direction: ltr;
        text-align: left;
      }

      pre code {
        background: transparent;
        color: inherit;
        padding: 0;
        display: block;
      }

      a {
        color: ${isDark ? '#8ab4f8' : '#1a73e8'};
        text-decoration: none;
      }
      a:hover {
        text-decoration: underline;
      }
    `

    // حقن الـ Stylesheet والـ HTML داخل الـ Shadow Root فقط
    shadowRoot.innerHTML = `
      <style>${scopedStyles}</style>
      <div class="shadow-content-wrapper">${cleanHtml}</div>
    `
  }, [html])

  return <div ref={containerRef} className={`isolated-html-container ${className}`} />
}
