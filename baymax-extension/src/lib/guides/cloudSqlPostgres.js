// OFFLINE COPY of the official "Set up Cloud SQL for PostgreSQL" guide.
//
// The live version is served from the backend (recorded_guides, is_official) —
// this bundled copy is used ONLY when the user explicitly accepts the offline
// prompt after a failed fetch. Keep it in sync with
// baymax-backend/data/official_cloud_sql_guide.json (the seed source).
//
// Each step describes:
//  - title / description: shown in the TaskStepCard, in the mascot's speech
//    bubble on the page, and read aloud by the voice guide
//  - action: 'click' | 'fill' | 'highlight' — what "Do it for me" does
//  - selector: CSS selector(s) (comma-separated fallbacks) for the target element
//  - value: text to type in for 'fill' steps
//  - advanceOnValueMatch: (fill steps) only complete once the typed text
//    contains `value` (case/whitespace-insensitive) — for steps where the
//    value is canonical (the search query), not an example or a secret.
//    Without it, a fill step completes on any 1.1s pause in typing.
//  - url: the page this step's selector lives on — used to send the user back
//    here if they click the wrong thing and end up somewhere else
//  - urlPattern: regex (string) tested against the current tab URL to decide
//    whether the user is still "on track" for this step
//  - advanceOnUrlPattern: regex (string) — if the tab URL matches this, the
//    step is considered DONE and the guide auto-advances. This is how progress
//    is tracked even when the user clicks something equivalent we didn't watch
//    (e.g. a search suggestion), and how already-done steps are skipped when
//    the guide starts mid-journey.
//  - revealSelector / revealValue: for targets that are missing until some
//    other control brings them back — a transient panel that closed when the
//    page lost focus (the search-suggestions dropdown closes the instant the
//    user clicks the side panel), or a control the console COLLAPSED because
//    its window got too narrow (a wide side panel does this to the top-bar
//    search input, which is hidden — not removed — behind an "Open search"
//    icon). When the target can't be found, the overlay focuses the first
//    VISIBLE control in revealSelector, refills it with revealValue if it's a
//    text field that came back empty, re-fires an input event, then retries the
//    resolve — up to two rounds, since reaching a collapsed field's panel takes
//    one round to expand the field and another to type into it. List the real
//    control first and the control that summons it last: visibility, not
//    order, decides which one is used at a given width.
//  - fallbackUrl / fallbackHint: the escape hatch when the element genuinely
//    can't be found after every retry. Instead of a dead end, the card offers
//    "Take me there" — a direct jump to the page this step was leading to,
//    with fallbackHint as the explanation. The step's advanceOnUrlPattern then
//    completes it on arrival. Only worth setting on a step whose destination is
//    a known URL (the search lead-ins); it deliberately doesn't care WHY the
//    element was missing, so it also covers console redesigns and non-English
//    consoles, not just the collapse above.
//
// The first two steps work from ANY console page: they point the user at the
// top search bar, have them type "Cloud SQL", and open it from the results.
// If the user is already on a /sql/ page they auto-skip via advanceOnUrlPattern.
//
// Selectors are best-effort matches for the current GCP Console DOM and may need
// updating if Google changes the console's markup.

export const CLOUD_SQL_POSTGRES_GUIDE = {
  id: 'cloud-sql-postgres',
  title: 'Set up Cloud SQL for PostgreSQL',
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
      hint: 'Cloud SQL instances bill while they run — even small ones.',
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
  // Shown on the completion screen — tell, don't do.
  nextSteps: [
    'Wait for the instance status to turn green in the Cloud SQL list (a few minutes).',
    "Keep your postgres password safe — you'll need it to connect.",
    'Create a database and user for your app (Databases / Users tabs).',
    'Stop or delete the instance when you no longer need it — it bills while running.',
  ],
  steps: [
    {
      id: 1,
      title: 'Search for Cloud SQL',
      description:
        'Click the search bar at the top of the console and type "Cloud SQL". You can find any GCP product this way.',
      action: 'fill',
      // Same harvested selector as the Cloud Run guide: the search bar is
      // input.pcc-search-input on the current console (input[name="q"] is gone).
      selector:
        'input.pcc-search-input, input[placeholder*="Search" i], input[aria-label*="search for resources" i]',
      // A wide side panel squeezes the console below its breakpoint, where the
      // search input is HIDDEN (not removed) and an "Open search" icon button
      // takes its place — so the step's own selector can't match. The reveal
      // path takes the first VISIBLE control here: the input when the console
      // has room, else the icon, whose click expands and focuses the input.
      revealSelector:
        'input.pcc-search-input, input[placeholder*="Search" i], input[aria-label*="search for resources" i], button[aria-label="Open search" i]',
      value: 'Cloud SQL',
      // Last resort if the search bar can't be found at all: skip the search and
      // go where it was leading. advanceOnUrlPattern completes the step on arrival.
      fallbackUrl: 'https://console.cloud.google.com/sql/instances',
      fallbackHint:
        "I can't find the search bar — the Console hides it behind a 🔍 icon when its window gets narrow. Drag my edge to give the Console more room and I'll spot it, or let me take you straight to Cloud SQL.",
      // Don't complete on just any pause in typing — wait until the box
      // actually contains "cloud sql" (however spaced/cased). Clicking a
      // suggestion early still advances via advanceOnUrlPattern below.
      advanceOnValueMatch: true,
      // Advance once we land on ANY Cloud SQL page (the "Get started" page or the
      // Instances list) — the search result opens the Get-started page, which has
      // a different URL than /sql/instances.
      advanceOnUrlPattern: '^(?!.*(?:instances/create|choose-instance)).*/sql(?:[/?;#]|$)',
    },
    {
      id: 2,
      title: 'Open SQL from the results',
      description: 'Click the "Cloud SQL" result (the Product) to open the Cloud SQL page.',
      action: 'click',
      // The Cloud SQL product result is an <a class="pcc-search-result-primary-title"
      // aria-label="Cloud SQL" href="/sql?referrer=search&project=…">. Note:
      //   • the href is "/sql" (NOT "/sql/instances") — it redirects there,
      //   • the label uses a non-breaking space ("Cloud SQL"), which the
      //     resolver normalises before comparing.
      // exactName rejects every look-alike — "Cloud SQL for PostgreSQL…"
      // (docs), "Generative AI RAG with Cloud SQL" (solutions), the marketplace
      // SQL Server entry, and the "More info" button — because none of them is
      // named exactly "Cloud SQL". href '/sql' is a tie-break boost toward the
      // real product link.
      name: 'Cloud SQL',
      exactName: true,
      href: '/sql',
      avoidHref: 'marketplace',
      // Only match the search-result selector — never the generic name scan.
      // "Cloud SQL" is also the left-nav branding on every Cloud SQL page, so
      // without this, pressing Back to this step from (say) the create-instance
      // page would highlight the nav instead of doing nothing. Both selectors
      // are search-result-only: the result-title class and the "referrer=search"
      // href never appear on the left-nav link or the product home link (so we
      // don't grab a look-alike when the search dropdown isn't even open).
      requireSelector: true,
      selector: 'a.pcc-search-result-primary-title, a[href*="/sql?referrer=search"]',
      // The result lives in the search-suggestions dropdown, which closes the
      // moment the user clicks the side panel (page blur) — so on Show me /
      // Do it for me the target is genuinely gone. revealSelector re-focuses
      // the search box (revealValue refills it if cleared) to summon the
      // dropdown back before resolving. Same fix as the Cloud Run guide. On a
      // squeezed console the search box itself is hidden behind the "Open
      // search" icon, so this takes two reveal rounds: click the icon (expands
      // + focuses the input), then type into it.
      revealSelector:
        'input.pcc-search-input, input[placeholder*="Search" i], input[aria-label*="search for resources" i], button[aria-label="Open search" i]',
      revealValue: 'Cloud SQL',
      fallbackUrl: 'https://console.cloud.google.com/sql/instances',
      fallbackHint:
        'I can\'t find the "Cloud SQL" result — the suggestions list closes as soon as the Console loses focus, and a narrow window hides the search bar behind a 🔍 icon. Try the search again, or let me take you straight to Cloud SQL.',
      // See step 1: any Cloud SQL landing page (Get started OR Instances).
      advanceOnUrlPattern: '^(?!.*(?:instances/create|choose-instance)).*/sql(?:[/?;#]|$)',
    },
    {
      id: 3,
      title: 'Create an instance',
      description: 'You\'re in Cloud SQL now. Click "Create instance" to start a new database.',
      action: 'click',
      // Match by name across <button> AND <a>: when the instance list is empty
      // GCP shows a link, but with existing instances it's a dropdown button.
      name: 'Create instance',
      // Prefer the DIRECT "Create instance" link (points at the engine picker).
      // The empty get-started page has BOTH a top dropdown and a bottom direct
      // link named "Create instance"; this href tips the resolver to the bottom
      // direct one, so the no-instances flow goes straight to the picker and
      // step 4 auto-skips. On the list page there's no such link, so the dropdown
      // button is picked — both flows work.
      href: '/sql/choose-instance-engine',
      selector:
        'a[href*="/sql/choose-instance-engine"], button[aria-label*="Create instance" i], a[aria-label*="Create instance" i]',
      url: 'https://console.cloud.google.com/sql/instances',
      // Any Cloud SQL LANDING page — the "Get started" page (/sql or
      // /sql/getting-started) OR the Instances list. Excludes the create form and
      // engine picker, so walking Back here from the create form still goes
      // off-track (Take me back) instead of highlighting step 10's submit button.
      urlPattern: '^(?!.*(?:instances/create|choose-instance)).*/sql(?:[/?;#]|$)',
      // Done when the engine picker OR a PostgreSQL form appears — not a MySQL one.
      advanceOnUrlPattern: '/sql/choose-instance|engine=PostgreSQL',
    },
    {
      // When the project already has instances, "Create instance" is a dropdown
      // (New instance / From existing database) rather than a direct link. This
      // step targets that menu item. When the instance list is EMPTY there's no
      // dropdown — "Create instance" navigates straight to the engine picker —
      // so advanceOnUrlPattern auto-skips this step.
      id: 4,
      title: 'Start a new instance',
      description: 'If a menu appears, choose "New instance" to create a fresh database.',
      action: 'click',
      name: 'New instance',
      role: 'menuitem',
      selector: '[role="menuitem"], [role="option"], a, button',
      url: 'https://console.cloud.google.com/sql/instances',
      // Any Cloud SQL LANDING page (Get started OR Instances) — where the "New
      // instance" menu item lives. On the picker this is off-track, but autoSkip
      // advances past it first, so it never shows Take me back there.
      urlPattern: '^(?!.*(?:instances/create|choose-instance)).*/sql(?:[/?;#]|$)',
      // Auto-skip the moment the engine picker (or a PostgreSQL form) appears,
      // i.e. the user took the direct "Create instance" button and there was no
      // "New instance" menu. `autoSkip` lets this fire even below the frontier
      // (after walking back), since being on the picker means step 4 is done.
      autoSkip: true,
      advanceOnUrlPattern: '/sql/choose-instance|engine=PostgreSQL',
    },
    {
      id: 5,
      title: 'Choose PostgreSQL',
      description: 'Select PostgreSQL as the database engine for your new instance.',
      action: 'click',
      name: 'PostgreSQL',
      text: 'PostgreSQL',
      selector: 'button[aria-label*="PostgreSQL" i], a[href*="postgres" i]',
      url: 'https://console.cloud.google.com/sql/choose-instance-engine',
      // The engine PICKER only. Dropping the old '.*create' branch is the fix for
      // "picked the wrong engine": a MySQL form no longer matches this page, so
      // choosing MySQL goes off-track → Take me back → return and pick PostgreSQL.
      urlPattern: '/sql/choose-instance',
      // Advance ONLY to a PostgreSQL create form; a MySQL form won't advance.
      advanceOnUrlPattern: 'engine=PostgreSQL',
    },
    {
      id: 6,
      title: 'Name your instance',
      description: 'Enter an instance ID, for example "baymax-postgres".',
      action: 'fill',
      name: 'Instance ID',
      selector: 'input[name="instanceId"], input#instance-id, input[formcontrolname="instanceId"]',
      value: 'baymax-postgres',
      url: 'https://console.cloud.google.com/sql/instances/create;engine=PostgreSQL',
      urlPattern: 'engine=PostgreSQL',
    },
    {
      id: 7,
      title: 'Set a password',
      description:
        "Enter a password for the default postgres user. Make sure to remember it — you'll need it to connect later.",
      action: 'highlight',
      name: 'Password',
      selector: 'input[type="password"], input[name="password"], input[formcontrolname="password"]',
      url: 'https://console.cloud.google.com/sql/instances/create;engine=PostgreSQL',
      urlPattern: 'engine=PostgreSQL',
    },
    {
      id: 8,
      title: 'Choose a region',
      description: 'Pick the region closest to you, for example asia-southeast1.',
      action: 'highlight',
      role: 'combobox',
      name: 'Region',
      selector:
        'mat-select[formcontrolname="region"], mat-select[name="region"], [data-test-id="region-select"]',
      url: 'https://console.cloud.google.com/sql/instances/create;engine=PostgreSQL',
      urlPattern: 'engine=PostgreSQL',
    },
    {
      id: 9,
      title: 'Choose the Enterprise edition',
      description:
        'Pick the "Enterprise" edition — it is cheaper than Enterprise Plus. To shrink it further, set the "Edition preset" dropdown above to "Sandbox" (the smallest, lowest-cost size for development).',
      action: 'click',
      // The cards are <mat-radio-button> elements with no aria-label; their
      // text is "Enterprise99.95%…" vs "Enterprise Plus99.99%…". Match the one
      // containing "Enterprise" but NOT "Plus" so we pick the cheaper edition.
      name: 'Enterprise',
      role: 'radio',
      avoidText: 'plus',
      selector: 'mat-radio-button, [role="radio"], input[type="radio"]',
      url: 'https://console.cloud.google.com/sql/instances/create;engine=PostgreSQL',
      urlPattern: 'engine=PostgreSQL',
    },
    {
      id: 10,
      title: 'Create the instance',
      description:
        'Click "Create instance" to start provisioning your PostgreSQL database. This can take a few minutes.',
      action: 'click',
      name: 'Create instance',
      selector: 'button[type="submit"], [data-test-id="submit-button"]',
      url: 'https://console.cloud.google.com/sql/instances/create;engine=PostgreSQL',
      urlPattern: 'engine=PostgreSQL',
      advanceOnUrlPattern: '/sql/instances(?!.*create)',
      // This step SUBMITS a form: clicking "Create instance" doesn't mean it
      // worked — GCP can reject it (duplicate instance name, a password that
      // breaks the rules) and stay on the page showing errors. So don't treat
      // the click as completion; only the navigation to the instances list
      // (advanceOnUrlPattern) proves the instance was actually created. If the
      // click doesn't navigate, the guide stays here and prompts the user to fix
      // the highlighted fields.
      awaitNavigation: true,
    },
  ],
}
