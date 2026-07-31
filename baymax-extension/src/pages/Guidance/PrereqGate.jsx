// Before-you-start gate — shown for EVERY real guide start (chip, chat, or a
// Recorder trial), never skipped: App.jsx (beginGuide) always attaches a
// prerequisites list, falling back to DEFAULT_PREREQUISITES when the guide's
// own source (backend DB / AI blueprint) didn't supply one, so this screen's
// appearance never depends on what's in the database. `onReady` is also where
// the backend session (and step 1) actually gets created — see
// startGuidedSession() in App.jsx — so cancelling here (`onCancel`) never
// leaves an orphaned session behind.
//
// Console-open / language / project-selected are read straight off the page
// by the content script (checkEnvironment() in lib/guide.js) and shown with
// a real pass/fail status. Billing is NOT auto-checked — the Cloud Billing
// API needs an OAuth-authenticated call third-party extensions can't make
// without the user completing a separate Google Cloud OAuth registration,
// which is more setup than this warrants. Instead the billing item gets an
// "Enable billing" button that navigates the console tab straight to the
// billing page for the detected project and highlights the control to
// click, reusing the same navigation/highlight primitives real guides use
// (see enableBilling.js) — guided, not verified.
//
// Rendered by App.jsx BETWEEN picking a guide and mounting Guidance, so none
// of the highlight/voice effects fire while the user reads. Resumed sessions
// never pass through here — they were gated on first run.

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui'
import { WorkMascot } from '@/components/shared'
import { Check, X, CircleHelp, Loader2, ExternalLink, RefreshCw } from 'lucide-react'
import {
  openGcpConsole,
  checkEnvironment,
  navigateToUrl,
  highlightStep,
  reloadGuidedTab,
} from '@/lib/guide'
import { ENABLE_BILLING_STEP, enableBillingUrl } from '@/lib/guides/enableBilling'

// Maps a prerequisite's `key` to its live status. Only the 3 env checks are
// auto-verified; billingEnabled (and any future guide-specific item with no
// matching key) falls through to 'unverified' — deliberately NOT 'pass', so
// it never renders as a green checkmark. A tick there would read as "Baymax
// already confirmed this," which is exactly backwards: nobody checked it,
// and a user who trusts the tick might skip actually enabling billing.
function statusFor(key, env, envLoading) {
  if (envLoading) return 'checking'
  if (key === 'consoleOpen') return env?.consoleOpen ? 'pass' : 'fail'
  if (key === 'languageEnglish') return env?.languageEnglish ? 'pass' : 'fail'
  if (key === 'projectSelected') return env?.projectSelected ? 'pass' : 'fail'
  return 'unverified'
}

function StatusIcon({ status }) {
  if (status === 'checking')
    return <Loader2 size={15} className="text-muted-foreground flex-shrink-0 animate-spin" />
  if (status === 'fail') return <X size={15} className="text-danger flex-shrink-0" />
  if (status === 'pass') return <Check size={15} className="text-success flex-shrink-0" />
  // 'unverified' — items Baymax can't check itself (billing). A question
  // mark, not a tick: this is a "please go confirm" prompt, not a pass.
  return <CircleHelp size={15} className="text-muted-foreground flex-shrink-0" />
}

export default function PrereqGate({ guide, starting = false, onReady, onCancel }) {
  const items = guide?.prerequisites ?? []
  const [env, setEnv] = useState(null)
  const [envLoading, setEnvLoading] = useState(true)

  const recheck = async () => {
    setEnvLoading(true)
    setEnv(await checkEnvironment())
    setEnvLoading(false)
  }

  useEffect(() => {
    recheck()
     
  }, [])

  const handleEnableBilling = async () => {
    const url = enableBillingUrl(env?.projectId)
    await navigateToUrl(url)
    highlightStep(ENABLE_BILLING_STEP) // best-effort — fails gracefully if not found
  }

  // Chrome only injects a content script at page load — reloading the
  // EXTENSION never reaches a console tab that was already open, only
  // reloading the TAB itself does. Explicit/user-triggered on purpose: a
  // silent auto-reload could discard unrelated in-progress work in that tab.
  const handleReloadTab = async () => {
    await reloadGuidedTab()
    await new Promise((resolve) => setTimeout(resolve, 1500)) // let the page + content script settle
    recheck()
  }

  const languageUnreachable = env?.consoleOpen && !env?.contentScriptReachable

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className="flex justify-center">
          <WorkMascot size={96} />
        </div>
        <h1 className="text-display mt-4 text-center">Before we start</h1>
        <p className="text-small text-muted-foreground mt-1 text-center">
          Make sure you have these ready — Baymax handles the rest.
        </p>

        <ul className="mt-5 space-y-3">
          {items.map((p, i) => {
            const status = statusFor(p.key, env, envLoading)
            return (
              <li key={i} className="border-border bg-card rounded-xl border px-4 py-3">
                <p className="text-body text-foreground flex items-center gap-2 font-medium">
                  <StatusIcon status={status} />
                  {p.label}
                </p>
                {p.key === 'languageEnglish' && languageUnreachable ? (
                  <>
                    <p className="text-caption text-info mt-1 pl-6">
                      Baymax&apos;s page helper isn&apos;t active on this tab yet — reloading the
                      extension doesn&apos;t reach a tab that was already open.
                    </p>
                    <button
                      type="button"
                      onClick={handleReloadTab}
                      className="text-caption text-info mt-1 flex items-center gap-1 pl-6 hover:underline"
                    >
                      <RefreshCw size={12} />
                      Reload the Console tab
                    </button>
                  </>
                ) : p.hint ? (
                  <p
                    className={
                      'text-caption mt-1 pl-6 ' +
                      (status === 'fail' ? 'text-danger' : 'text-muted-foreground')
                    }
                  >
                    {p.hint}
                  </p>
                ) : null}
                {p.key === 'billingEnabled' ? (
                  <button
                    type="button"
                    onClick={handleEnableBilling}
                    className="text-caption text-info mt-1 flex items-center gap-1 pl-6 hover:underline"
                  >
                    <ExternalLink size={12} />
                    Enable billing
                  </button>
                ) : null}
              </li>
            )
          })}
        </ul>

        <button
          type="button"
          onClick={recheck}
          disabled={envLoading}
          className="text-small text-muted-foreground mt-3 flex w-full items-center justify-center gap-1.5 hover:underline disabled:opacity-60"
        >
          {envLoading ? <Loader2 size={13} className="animate-spin" /> : null}
          Recheck
        </button>

        {/* First-time users don't have the console open (or even know the
            URL) — one click opens/focuses console.cloud.google.com in this
            window and pins the guide to that tab, so nothing needs to be
            typed or found manually. */}
        <button
          type="button"
          onClick={() => openGcpConsole()}
          className="text-small text-info mt-4 flex w-full items-center justify-center gap-1.5 hover:underline"
        >
          <ExternalLink size={14} />
          Don&apos;t have it open? Open the Cloud Console
        </button>
      </div>

      <div className="border-border flex flex-col gap-2 border-t p-4">
        <Button onClick={onReady} disabled={starting}>
          {starting ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              Starting…
            </>
          ) : (
            "I'm ready — start guiding"
          )}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={starting}>
          Not now
        </Button>
      </div>
    </div>
  )
}
