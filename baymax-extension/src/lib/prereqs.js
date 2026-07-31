// Canonical prerequisite checklist shown by PrereqGate before any guide runs
// against the GCP console. `key` maps an item to either a live check
// (consoleOpen/languageEnglish/projectSelected, via checkEnvironment() in
// guide.js) or a guided action (billingEnabled — see enableBilling.js).
// Guides that don't define their own prerequisites (dynamic/AI blueprints,
// Recorder "try it now" guides) fall back to this list so they get the same
// checklist too.
export const DEFAULT_PREREQUISITES = [
  {
    key: 'projectSelected',
    label: 'A GCP project is selected',
    hint: 'Check the project picker in the console top bar.',
  },
  {
    key: 'billingEnabled',
    label: 'Billing is enabled on the project',
    hint: 'Most GCP resources need a billing account, even for free-tier use.',
  },
  {
    key: 'consoleOpen',
    label: 'The Cloud Console is open in this window',
    hint: 'console.cloud.google.com — Baymax guides that tab.',
  },
  {
    key: 'languageEnglish',
    label: 'Console language is English',
    hint: 'Baymax finds buttons by their English names.',
  },
]
