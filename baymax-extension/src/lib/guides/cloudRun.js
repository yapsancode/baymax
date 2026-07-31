// OFFLINE COPY of the official "Host a backend on Cloud Run" guide.
//
// The live version is served from the backend (recorded_guides, is_official) —
// this bundled copy is used ONLY when the user explicitly accepts the offline
// prompt after a failed fetch. Keep it in sync with
// baymax-backend/data/official_cloud_run_guide.json (the seed source).
//
// Every selector/name below was harvested from the REAL console DOM on
// 2026-07-06 (project gemini-ddemo, full deploy walked end-to-end):
//  - search bar is input.pcc-search-input (input[name="q"] is gone)
//  - empty projects land on /run/overview; the entry point is the
//    "Deploy container" card/button (there is no top-level "Create service")
//  - the create form's inputs have NO stable ids/names — resolution relies on
//    label[for] text ("Service name") and aria-labelledby ("Region", a
//    cfc-select combobox)
//  - "Test with a sample container" is a real <button> that fills BOTH the
//    image URL and the service name ("hello")
//  - auth radios are "Allow public access" / "Require authentication"
//  - the Cloud Run Admin API auto-enables on first create (no interstitial)
//  - submitting can fail with an actAs error on the Security tab when the form
//    preselects a user-created service account (step 8's description covers it)
//
// Step shape schema doc: see cloudSqlPostgres.js.

export const CLOUD_RUN_GUIDE = {
  id: 'cloud-run-service',
  title: 'Host a backend on Cloud Run',
  // Shown as a one-glance acknowledgment gate before step 1 (PrereqGate).
  prerequisites: [
    {
      key: 'projectSelected',
      label: 'A GCP project is selected',
      hint: 'Check the project picker in the console top bar.',
    },
    {
      key: 'billingEnabled',
      label: 'Billing is enabled on the project',
      hint: 'Cloud Run needs a billing account even for free-tier use.',
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
  ],
  // Shown on the completion screen — tell, don't do (guiding these is phase 2).
  nextSteps: [
    "This deployed Google's sample container — swap in your own image URL when you're ready.",
    'A real backend needs its container port and env vars set (Edit & deploy new revision).',
    'Check scaling: max instances caps your cost, min 0 means scale-to-zero.',
    "Your service URL is public — restrict access if it shouldn't be.",
  ],
  steps: [
    {
      id: 1,
      title: 'Search for Cloud Run',
      description:
        'Click the search bar at the top of the console and type "Cloud Run". You can find any GCP product this way.',
      action: 'fill',
      selector:
        'input.pcc-search-input, input[placeholder*="Search" i], input[aria-label*="search for resources" i]',
      // A wide side panel squeezes the console below its breakpoint, where the
      // top-bar search input is HIDDEN (not removed) and an "Open search" icon
      // button takes its place — so the step's own selector can't match. The
      // reveal path takes the first VISIBLE control in this list: the input
      // when the console has room, else the icon, whose click expands and
      // focuses the real input.
      revealSelector:
        'input.pcc-search-input, input[placeholder*="Search" i], input[aria-label*="search for resources" i], button[aria-label="Open search" i]',
      value: 'Cloud Run',
      // Last resort if the search bar can't be found at all: skip the search and
      // go where it was leading. advanceOnUrlPattern completes the step on arrival.
      fallbackUrl: 'https://console.cloud.google.com/run',
      fallbackHint:
        "I can't find the search bar — the Console hides it behind a 🔍 icon when its window gets narrow. Drag my edge to give the Console more room and I'll spot it, or let me take you straight to Cloud Run.",
      // Don't complete on just any pause in typing — wait until the box
      // actually contains "cloud run" (however spaced/cased). Clicking a
      // suggestion early still advances via advanceOnUrlPattern below.
      advanceOnValueMatch: true,
      advanceOnUrlPattern: '/run(?:[/?;#]|$)',
    },
    {
      id: 2,
      title: 'Open Cloud Run from the results',
      description: 'Click the "Cloud Run" result (the Product) to open the Cloud Run page.',
      action: 'click',
      // exactName rejects the docs/marketplace look-alikes (both also named or
      // titled around "Cloud Run"); avoidHref kills the marketplace entry,
      // which IS named exactly "Cloud Run".
      name: 'Cloud Run',
      exactName: true,
      href: '/run',
      avoidHref: 'marketplace',
      requireSelector: true,
      selector: 'a.pcc-search-result-primary-title, a[href*="/run?referrer=search"]',
      // The result lives in the search-suggestions dropdown, which closes the
      // moment the user clicks the side panel (page blur) — so on Show me /
      // Do it for me the target is genuinely gone. revealSelector re-focuses
      // the search box (revealValue refills it if cleared) to summon the
      // dropdown back before resolving. On a squeezed console the search box
      // itself is hidden behind the "Open search" icon, so this takes two reveal
      // rounds: click the icon (expands + focuses the input), then type into it.
      revealSelector:
        'input.pcc-search-input, input[placeholder*="Search" i], input[aria-label*="search for resources" i], button[aria-label="Open search" i]',
      revealValue: 'Cloud Run',
      fallbackUrl: 'https://console.cloud.google.com/run',
      fallbackHint:
        'I can\'t find the "Cloud Run" result — the suggestions list closes as soon as the Console loses focus, and a narrow window hides the search bar behind a 🔍 icon. Try the search again, or let me take you straight to Cloud Run.',
      advanceOnUrlPattern: '/run(?:[/?;#]|$)',
    },
    {
      id: 3,
      title: 'Deploy a container',
      description:
        'You\'re in Cloud Run now. Click "Deploy container" to create a new service from a container image.',
      action: 'click',
      // Both the /run/overview cards and the /run/services toolbar button are
      // named "Deploy container"; deploymentType=container is the precise
      // href of the container card (vs Connect repository / Write a function).
      name: 'Deploy container',
      href: '/run/create',
      avoidText: 'repositor,function',
      selector:
        'a[href*="deploymentType=container"], a[href*="/run/create"], button[aria-label*="Deploy container" i]',
      url: 'https://console.cloud.google.com/run/overview',
      // Overview/services/list only — never the create form or a detail page.
      urlPattern: '/run(?:/overview|/services)?(?:[?;#]|$)',
      advanceOnUrlPattern: '/run/create',
    },
    {
      id: 4,
      title: 'Use the sample container',
      description:
        'Click "Test with a sample container" — it fills in Google\'s demo image so you can try the flow. (Deploying your own app instead? Paste your image URL into the Container image URL field.)',
      action: 'click',
      // A real <button>; resolved by name via the intent scan — the form's
      // inputs have no stable selectors at all, which is why the guide clicks
      // this instead of filling the field directly.
      name: 'Test with a sample container',
      url: 'https://console.cloud.google.com/run/create',
      urlPattern: '/run/create',
    },
    {
      id: 5,
      title: 'Name your service',
      description:
        'The service name auto-filled as "hello" from the sample image. Keep it, or type a name you like — this becomes part of your service URL and can\'t be changed later.',
      action: 'highlight',
      // Resolved via label[for] → "Service name" (the input has no name/id
      // worth targeting).
      name: 'Service name',
      url: 'https://console.cloud.google.com/run/create',
      urlPattern: '/run/create',
    },
    {
      id: 6,
      title: 'Choose a region',
      description:
        "Pick where your service runs. The default works fine — asia-southeast1 (Singapore) is closest if you're in Southeast Asia. This also can't be changed later.",
      action: 'highlight',
      // A cfc-select combobox named via aria-labelledby → "Region" (Memory and
      // CPU are also cfc-selects; the name decides).
      role: 'combobox',
      name: 'Region',
      selector: 'cfc-select',
      url: 'https://console.cloud.google.com/run/create',
      urlPattern: '/run/create',
    },
    {
      id: 7,
      title: 'Allow public access',
      description:
        'Under Authentication, choose "Allow public access" so your service gets a URL anyone can open in a browser. (For internal APIs you\'d require authentication instead.)',
      action: 'click',
      name: 'Allow public access',
      role: 'radio',
      avoidText: 'require',
      selector: 'mat-radio-button, [role="radio"], input[type="radio"]',
      url: 'https://console.cloud.google.com/run/create',
      urlPattern: '/run/create',
    },
    {
      id: 8,
      title: 'Create the service',
      description:
        'Click "Create" to deploy. If a red error points at the Security section, open it and set Service account to "Default compute service account", then click Create again.',
      action: 'click',
      name: 'Create',
      // A bare "Create" matches too much by name; only the submit qualifies.
      requireSelector: true,
      selector: 'button[type="submit"], [data-test-id="submit-button"]',
      url: 'https://console.cloud.google.com/run/create',
      urlPattern: '/run/create',
      // Clicking is not deploying: GCP can reject the form (actAs error,
      // duplicate name) and stay here. Only navigating to the service detail
      // page (/run/detail/<region>/<name>/...) proves the deploy was accepted.
      advanceOnUrlPattern: '/run/detail',
      awaitNavigation: true,
    },
    {
      id: 9,
      title: 'Watch it go live',
      description:
        'Cloud Run is provisioning your service — wait for the green check next to the service name (under a minute). Then click the URL to see your app live!',
      action: 'highlight',
      // The service URL is the only .run.app link on the detail page.
      requireSelector: true,
      selector: 'a[href*=".run.app"]',
      url: 'https://console.cloud.google.com/run',
      urlPattern: '/run/detail',
    },
  ],
}
