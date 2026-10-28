import ReactMarkdown, { type Components } from 'react-markdown'

/**
 * Text written in markdown: source documents (READMEs, pasted pages), job descriptions and the
 * entries made from them. Raw HTML in that text is shown as text, never run. Headings are kept
 * at body size so a README does not take over a card.
 */
const components: Components = {
  p: ({ children }) => <p className="m-0 mb-2 last:mb-0">{children}</p>,
  h1: ({ children }) => <p className="m-0 mb-1 font-bold">{children}</p>,
  h2: ({ children }) => <p className="m-0 mb-1 font-bold">{children}</p>,
  h3: ({ children }) => <p className="m-0 mb-1 font-bold">{children}</p>,
  h4: ({ children }) => <p className="m-0 mb-1 font-bold">{children}</p>,
  h5: ({ children }) => <p className="m-0 mb-1 font-bold">{children}</p>,
  h6: ({ children }) => <p className="m-0 mb-1 font-bold">{children}</p>,
  ul: ({ children }) => <ul className="my-1 list-disc pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-1 list-decimal pl-5">{children}</ol>,
  li: ({ children }) => <li className="mb-0.5">{children}</li>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
      {children}
    </a>
  ),
  code: ({ children }) => <code className="font-mono text-[0.9em]">{children}</code>,
  pre: ({ children }) => <pre className="m-0 mb-2 overflow-x-auto font-mono text-[0.9em] whitespace-pre-wrap">{children}</pre>,
}

export function Markdown({ children, className = '' }: { children: string; className?: string }) {
  return (
    <div className={className}>
      <ReactMarkdown components={components}>{children}</ReactMarkdown>
    </div>
  )
}
