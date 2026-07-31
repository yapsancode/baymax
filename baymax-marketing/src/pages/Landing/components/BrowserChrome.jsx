// BrowserChrome — macOS-style mock browser window used by the pitch slides.
// Three window dots (status tokens, not raw colors) + a URL bar; `children`
// render as the page content. Purely visual — nothing inside is interactive.

import { Lock } from 'lucide-react'

export function BrowserChrome({ url, children, className = '', bodyClassName = '' }) {
  return (
    <div
      className={`border-border bg-card overflow-hidden rounded-xl border shadow-2xl ${className}`}
      aria-hidden="true"
    >
      {/* Window chrome */}
      <div className="border-border bg-muted/60 flex items-center gap-3 border-b px-4 py-2.5">
        <div className="flex gap-1.5">
          <span className="bg-danger/70 h-2.5 w-2.5 rounded-full" />
          <span className="bg-warning/70 h-2.5 w-2.5 rounded-full" />
          <span className="bg-success/70 h-2.5 w-2.5 rounded-full" />
        </div>
        <div className="bg-background flex flex-1 items-center gap-1.5 rounded-md px-3 py-1">
          <Lock size={10} className="text-muted-foreground shrink-0" />
          <span className="text-caption text-muted-foreground truncate">{url}</span>
        </div>
      </div>
      {/* Page content */}
      <div className={bodyClassName}>{children}</div>
    </div>
  )
}
