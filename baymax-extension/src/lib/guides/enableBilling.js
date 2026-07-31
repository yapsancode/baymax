// Mini guided step for the PrereqGate "Enable billing" button — NOT a full
// tracked guide (no session, no Guidance screen). It reuses the same step
// shape as the real guides (see cloudRun.js) so it can be fed straight into
// navigateToUrl()/highlightStep() from lib/guide.js: navigate the console tab
// to the billing page for the current project, then best-effort highlight
// the button that links a billing account.
//
// Selector is NOT harvested from a live console session (unlike the other
// bundled guides) — it's a best guess at GCP's "Link a billing account" /
// "SET ACCOUNT" control and may need adjusting against the real DOM. That's
// fine: highlight() already fails gracefully to "not found" if it's wrong,
// and the page itself still lands the user on the right screen either way.
export const ENABLE_BILLING_STEP = {
  title: 'Link a billing account',
  description:
    'Choose a billing account from the dropdown, then click "SET ACCOUNT" to enable billing for this project.',
  action: 'highlight',
  name: 'Link a billing account',
  selector:
    'button[aria-label*="Link a billing account" i], button[aria-label*="Set account" i], a[href*="linkedaccount"]',
}

// `?project=` unset falls back to the generic billing page, where the user
// picks the project themselves.
export function enableBillingUrl(projectId) {
  return projectId
    ? `https://console.cloud.google.com/billing/linkedaccount?project=${encodeURIComponent(projectId)}`
    : 'https://console.cloud.google.com/billing'
}
