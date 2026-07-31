// Guide overlay — content script on console.cloud.google.com.
//
// Listens for 'BAYMAX_GUIDE' runtime messages from the side panel and:
//  - 'highlight': scrolls to the target, draws a pulsing outline around it, and
//                 shows the animated Baymax mascot pointing at it with a speech
//                 bubble + a "Step X of Y" sign board and a motivational cheer
//  - 'lost':      shows the mascot alone (no target) offering a clickable
//                 "Take me back" button when the user is on the wrong page
//
// The mascot is the same pixel figure the side panel uses, and it reacts:
// it hops while pointing, cheers when a new step arrives (the user just
// finished one), nudges if they sit on a step too long, tilts its head when the
// element can't be found, and droops on the wrong page. See MOOD_CSS.
//  - 'click':     highlights then clicks the target element
//  - 'fill':      highlights, focuses, and fills the target element with a value
//  - 'clear':     removes the highlight and mascot
//
// It also reports the user's actions back to the side panel so the guide can
// track progress and react:
//  - BAYMAX_GUIDE_CLICKED   — the user clicked the highlighted element
//  - BAYMAX_GUIDE_FILLED    — the user typed into the highlighted input
//  - BAYMAX_GUIDE_DISMISSED — the user closed the mascot with the × button
//  - BAYMAX_GUIDE_GO_BACK   — the user asked the mascot to take them back
//
// All injected UI lives inside a Shadow DOM on a single host element, so the
// GCP console's global CSS cannot restyle the mascot and our styles cannot
// leak into the page. The root is 'closed' in production; on localhost it is
// 'open' so dev tooling and tests can reach inside via host.shadowRoot.
//
// Plain JS (no imports) so it loads as a classic content script with no
// bundling or module resolution required.

;(function () {
  if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.onMessage) return

  console.log('[Baymax] guide-overlay loaded in', window === window.top ? 'top frame' : 'iframe', location.href)

  var HOST_ID = 'baymax-guide-host'
  var OVERLAY_ID = 'baymax-guide-overlay'
  var MASCOT_ID = 'baymax-guide-mascot'
  var SHADOW_MODE = location.hostname === 'localhost' ? 'open' : 'closed'

  var shadowRoot = null
  var reposition = null
  var watchedElement = null
  var watchedListener = null
  var fillElement = null
  var fillListener = null
  var fillTimer = null
  var optionListener = null
  var docFillListener = null
  var docFillTimer = null
  var fillFocusListener = null
  // The element the highlight is currently anchored to, plus the rAF handle of
  // the loop that keeps the outline glued to it when the page reflows. The
  // intent/reportKey/opts are kept so the loop can RE-RESOLVE and re-anchor when
  // the framework swaps the target node out (e.g. a validation error re-renders
  // the form field) — the automatic equivalent of pressing "Show me" again.
  var highlightTarget = null
  var repositionRaf = null
  var currentIntent = null
  var currentReportKey = ''
  var currentOpts = null

  // ---------- moods ----------
  // The cheer plays once and settles; the nudge fires periodically while the
  // user sits on a step. Both timers are cleared by clearOverlay.
  var moodTimer = null
  var nudgeTimer = null
  var CHEER_MS = 1200
  var NUDGE_AFTER_MS = 12000
  var NUDGE_HOLD_MS = 2500

  // The step number last shown. Kept in sessionStorage, not a variable, because
  // the click that advances a guide usually navigates — which reloads this
  // content script and would wipe an in-memory value at exactly the moment the
  // cheer is due. sessionStorage is per-tab and the Console is one origin.
  var STEP_KEY = 'baymax-last-step'

  function readLastStep() {
    try {
      var raw = sessionStorage.getItem(STEP_KEY)
      return raw === null ? null : +raw
    } catch {
      return null
    }
  }

  function writeLastStep(n) {
    try {
      sessionStorage.setItem(STEP_KEY, String(n))
    } catch {
      /* storage blocked on this origin */
    }
  }

  function clearMoodTimers() {
    if (moodTimer) clearTimeout(moodTimer)
    if (nudgeTimer) clearTimeout(nudgeTimer)
    moodTimer = null
    nudgeTimer = null
  }

  function setMood(mood) {
    var mascot = inRoot(MASCOT_ID)
    if (!mascot) return
    mascot.className = mascot.className.replace(/baymax-mood-\S+/, 'baymax-mood-' + mood)
  }

  // Jab a few times every so often, then settle back. A mascot that nudges
  // continuously stops reading as help and starts reading as nagging.
  function armNudge() {
    if (nudgeTimer) clearTimeout(nudgeTimer)
    nudgeTimer = setTimeout(function () {
      setMood('nudge')
      nudgeTimer = setTimeout(function () {
        setMood('guiding')
        armNudge()
      }, NUDGE_HOLD_MS)
    }, NUDGE_AFTER_MS)
  }

  function send(message) {
    try {
      chrome.runtime.sendMessage(message)
    } catch {
      /* side panel not listening */
    }
  }

  function unwatchElement() {
    if (watchedElement && watchedListener) {
      watchedElement.removeEventListener('click', watchedListener, true)
    }
    watchedElement = null
    watchedListener = null
  }

  function unwatchFill() {
    if (fillElement && fillListener) {
      fillElement.removeEventListener('input', fillListener, true)
    }
    if (fillTimer) clearTimeout(fillTimer)
    fillElement = null
    fillListener = null
    fillTimer = null
  }

  function unwatchOption() {
    if (optionListener) document.removeEventListener('click', optionListener, true)
    optionListener = null
  }

  // Notifies the side panel when the user clicks the highlighted element
  // themselves, so the guide can advance without "Do it for me". The watched
  // elements live in the page's light DOM — only our UI is in the shadow root.
  function watchElement(el, selector) {
    unwatchElement()
    watchedElement = el
    watchedListener = function () {
      send({ type: 'BAYMAX_GUIDE_CLICKED', selector: selector })
      unwatchElement()
    }
    el.addEventListener('click', watchedListener, true)
  }

  // The (normalized) text the current fill step expects before it may report
  // BAYMAX_GUIDE_FILLED, or null to accept any non-empty pause (the default —
  // most fill values are examples or secrets, so any committed text counts).
  // Set per-step by renderHighlight from the step's advanceOnValueMatch flag;
  // the search steps use it so "typed clo and paused to read the dropdown"
  // no longer completes the step.
  var fillMatchValue = null

  // Lowercase and strip ALL whitespace, so "Cloud SQL", "cloud sql" and
  // "cloudsql" all compare equal.
  function normalizeFillValue(v) {
    return String(v == null ? '' : v).toLowerCase().replace(/\s+/g, '')
  }

  // True when the typed text is enough to complete the step: no expectation
  // means anything non-empty counts; with one, the text must CONTAIN it
  // ("google cloud sql" still proves the intent). A false return means "keep
  // watching" — the user simply hasn't finished typing yet.
  function fillValueSatisfied(value) {
    if (!fillMatchValue) return true
    return normalizeFillValue(value).indexOf(fillMatchValue) !== -1
  }

  // Notifies the side panel when the user types into the highlighted input.
  // Debounced so we report once they pause, not on every keystroke — and only
  // once the typed text satisfies the step's expected value (see above).
  function watchFill(el, selector) {
    unwatchFill()
    fillElement = el
    fillListener = function () {
      if (fillTimer) clearTimeout(fillTimer)
      var value = (el.value || '').trim()
      if (!value) return
      fillTimer = setTimeout(function () {
        if (!fillValueSatisfied(value)) return // mid-typing pause — keep watching
        send({ type: 'BAYMAX_GUIDE_FILLED', selector: selector, value: value })
        unwatchFill()
      }, 1100)
    }
    el.addEventListener('input', fillListener, true)
  }

  // Dropdown/combobox selections (e.g. the region <mat-select>) commit in a CDK
  // overlay panel GCP appends to <body> — OUTSIDE the highlighted control — so
  // watchElement on the control never sees the option click. Watch the document
  // for an option click and report it as a fill, so a "highlight" dropdown step
  // advances when the user actually picks a value (not when they merely open the
  // menu — that click is ignored by the side panel's click gate).
  function watchOptionSelect(selector) {
    unwatchOption()
    optionListener = function (e) {
      if (isOwnUi(e.target)) return
      var opt = e.target.closest && e.target.closest('mat-option, [role="option"], option')
      if (!opt) return
      var optValue = (opt.textContent || '').trim()
      if (!fillValueSatisfied(optValue)) return // not the option this step is about
      send({ type: 'BAYMAX_GUIDE_FILLED', selector: selector, value: optValue })
      unwatchOption()
    }
    document.addEventListener('click', optionListener, true)
  }

  function unwatchFillDoc() {
    if (docFillListener) document.removeEventListener('input', docFillListener, true)
    if (docFillTimer) clearTimeout(docFillTimer)
    docFillListener = null
    docFillTimer = null
  }

  // Fallback fill detector for steps where the exact field is hard to pin down.
  // The console's top search box is the worst case: clicking it swaps in a fresh
  // overlay input, so watchFill stays bound to the original (now-empty) box and
  // never sees the typing — the step gets stuck. This watches typing ANYWHERE on
  // the page (outside our own UI) and, once the user pauses, reports the step's
  // fill so the guide advances even when the highlighted element wasn't the
  // precise field they typed into. Only attached for actual 'fill' steps.
  // composedPath()[0] is used so a field inside a web component's shadow tree is
  // seen as the real <input> (the bubbled event's target is otherwise retargeted
  // to the shadow host, which has no .value and would be skipped).
  function watchFillDoc(selector) {
    unwatchFillDoc()
    docFillListener = function (e) {
      var path = (e.composedPath && e.composedPath()) || []
      var el = path[0] || e.target
      if (isOwnUi(el)) return
      if (!el || !('value' in el)) return
      var type = (el.getAttribute && el.getAttribute('type') || '').toLowerCase()
      if (type === 'checkbox' || type === 'radio') return
      if (docFillTimer) clearTimeout(docFillTimer)
      docFillTimer = setTimeout(function () {
        var value = (el.value || '').trim()
        if (!value) return
        if (!fillValueSatisfied(value)) return // mid-typing pause — keep watching
        send({ type: 'BAYMAX_GUIDE_FILLED', selector: selector, value: value })
        unwatchFillDoc()
      }, 1100)
    }
    document.addEventListener('input', docFillListener, true)
  }

  function unwatchFillFocus() {
    if (fillFocusListener) document.removeEventListener('focusin', fillFocusListener, true)
    fillFocusListener = null
  }

  // Make a 'fill' step's highlight FOLLOW the field the user actually focuses.
  // The resolver picks a target once, before the user interacts — but the
  // console search box only swaps in / reveals the real input once clicked, so
  // the initial highlight ends up on a different (empty) look-alike. When the
  // user focuses a real text field we re-anchor the pulsing outline + mascot
  // onto it and bind the typing watcher there, so it both "fits" the right
  // element and advances when they type. composedPath()[0] resolves the true
  // field even when it lives inside a shadow tree.
  function watchFillFocus(selector) {
    unwatchFillFocus()
    function retarget(el) {
      if (!el || isOwnUi(el)) return
      var tag = (el.tagName || '').toLowerCase()
      var role = (el.getAttribute && el.getAttribute('role')) || ''
      var isText =
        tag === 'input' ||
        tag === 'textarea' ||
        role === 'textbox' ||
        role === 'combobox' ||
        el.isContentEditable === true
      if (!isText) return
      // Re-anchor the highlight (and the reposition loop) onto this field.
      highlightTarget = el
      positionOverlay(el)
      watchElement(el, selector)
      watchFill(el, selector)
    }
    fillFocusListener = function (e) {
      var path = (e.composedPath && e.composedPath()) || []
      retarget(path[0] || e.target)
    }
    document.addEventListener('focusin', fillFocusListener, true)
    // Handle the field already being focused when the step (re)loads.
    retarget(document.activeElement)
  }

  var OVERLAY_CSS =
    '@keyframes baymax-pulse {' +
    '0%, 100% { box-shadow: 0 0 0 4px rgba(255, 87, 34, 0.85), 0 0 18px 4px rgba(255, 87, 34, 0.45); }' +
    '50% { box-shadow: 0 0 0 4px rgba(255, 87, 34, 0.25), 0 0 6px 1px rgba(255, 87, 34, 0.1); }' +
    '}' +
    '@keyframes baymax-bob {' +
    '0%, 100% { transform: translateY(0); }' +
    '50% { transform: translateY(-7px); }' +
    '}' +
    '@keyframes baymax-pop {' +
    'from { opacity: 0; transform: scale(0.85) translateY(10px); }' +
    'to { opacity: 1; transform: scale(1) translateY(0); }' +
    '}' +
    '@keyframes baymax-wiggle {' +
    '0%, 100% { transform: rotate(-3deg); }' +
    '50% { transform: rotate(2deg); }' +
    '}' +
    '#' + OVERLAY_ID + ' {' +
    'position: fixed; pointer-events: none; z-index: 2;' +
    'border-radius: 8px; border: 2px solid rgba(255, 87, 34, 0.9);' +
    'animation: baymax-pulse 1.4s ease-in-out infinite;' +
    '}' +
    '#' + MASCOT_ID + ' {' +
    'position: fixed; pointer-events: none; z-index: 3;' +
    'display: flex; flex-direction: column; align-items: center; gap: 2px;' +
    'width: 250px; animation: baymax-pop 0.35s ease-out;' +
    'transition: opacity 0.25s ease;' +
    '}' +
    '#' + MASCOT_ID + '.baymax-offscreen { opacity: 0; visibility: hidden; }' +
    '#' + MASCOT_ID + ' .baymax-bubble {' +
    'position: relative; background: #ffffff; color: #202124;' +
    'border-radius: 14px; padding: 10px 26px 10px 13px; max-width: 250px;' +
    'box-sizing: border-box;' +
    "font: 12.5px/1.45 'Google Sans', Roboto, Arial, sans-serif;" +
    'box-shadow: 0 4px 18px rgba(0, 0, 0, 0.3);' +
    '}' +
    '#' + MASCOT_ID + ' .baymax-bubble::after {' +
    "content: ''; position: absolute; bottom: -7px; left: 50%; margin-left: -7px;" +
    'border-left: 7px solid transparent; border-right: 7px solid transparent;' +
    'border-top: 7px solid #ffffff;' +
    '}' +
    '#' + MASCOT_ID + ' .baymax-bubble-title {' +
    'font-weight: 700; font-size: 13px; margin-bottom: 2px;' +
    '}' +
    '#' + MASCOT_ID + ' .baymax-close {' +
    'position: absolute; top: 5px; right: 5px; width: 18px; height: 18px;' +
    'border: none; border-radius: 50%; background: #f1f3f4; color: #5f6368;' +
    'font: 700 11px/18px Roboto, Arial, sans-serif; text-align: center;' +
    'cursor: pointer; pointer-events: auto; padding: 0;' +
    '}' +
    '#' + MASCOT_ID + ' .baymax-close:hover { background: #e8eaed; color: #202124; }' +
    // No animation here any more — every motion lives inside the SVG so the
    // ground shadow can move independently of the figure that casts it.
    '#' + MASCOT_ID + ' .baymax-figure {' +
    'line-height: 0;' +
    'filter: drop-shadow(0 6px 14px rgba(0, 0, 0, 0.3));' +
    '}' +
    // crispEdges is not optional. Without it every rect edge antialiases, the
    // figure's interior alpha drops just below 1 where rects meet, and the ink
    // rim painted underneath bleeds through as a faint line at every boundary.
    '#' + MASCOT_ID + ' .baymax-figure svg {' +
    'shape-rendering: crispEdges; overflow: visible;' +
    '}' +
    '#' + MASCOT_ID + '.baymax-flip .baymax-figure svg { transform: scaleX(-1); }' +
    '#' + MASCOT_ID + '.baymax-lost .baymax-figure { cursor: pointer; pointer-events: auto; }' +
    '#' + MASCOT_ID + ' .baymax-board {' +
    'position: relative; margin-top: -30px; z-index: 1;' +
    'background: #fffbe9; color: #5b4a1f; border: 2px solid #e8d9a0;' +
    'border-radius: 10px; padding: 6px 12px; text-align: center;' +
    "font: 11.5px/1.35 'Google Sans', Roboto, Arial, sans-serif;" +
    'box-shadow: 0 3px 10px rgba(0, 0, 0, 0.25);' +
    // 'animation: baymax-wiggle 3.2s ease-in-out infinite;' +
    '}' +
    '#' + MASCOT_ID + ' .baymax-board-step {' +
    'font-weight: 800; font-size: 13px; letter-spacing: 0.3px; color: #3c2f10;' +
    '}' +
    '#' + MASCOT_ID + ' .baymax-back {' +
    'position: relative; margin-top: -30px; z-index: 1;' +
    'border: none; border-radius: 999px; padding: 8px 16px;' +
    'background: #ff5722; color: #ffffff; cursor: pointer; pointer-events: auto;' +
    "font: 700 12.5px/1 'Google Sans', Roboto, Arial, sans-serif;" +
    'box-shadow: 0 4px 12px rgba(255, 87, 34, 0.45);' +
    '}' +
    '#' + MASCOT_ID + ' .baymax-back:hover { background: #e64a19; }' +
    // Baymax is clickable to collapse/expand his speech. When collapsed, only
    // the speech bubble (the wording) is hidden — the "Step X of Y" sign board
    // stays so the user keeps their progress in view.
    '#' + MASCOT_ID + ' .baymax-figure { cursor: pointer; pointer-events: auto; }' +
    '#' + MASCOT_ID + '.baymax-collapsed .baymax-bubble { display: none; }'

  // The moods. Every motion is a steps() keyframe so the sprite snaps
  // cell-by-cell instead of sliding; faces and arms are drawn once and switched
  // with display, never redrawn, so changing mood costs nothing.
  //
  //   guiding  — the default. An excited hop, legs tucking up, a jab at the top
  //              of each bounce.
  //   cheer    — the user just finished a step. Eyes close, double hop, sparkles.
  //   nudge    — they have been sitting on this step a while. Three firm jabs
  //              and a lean toward the button.
  //   confused — the element could not be resolved. The pointing arm drops
  //              (nothing to point at), the head tilts, a "?" comes up.
  //   lost     — wrong page. Both arms hang, the body sinks, the eyes droop and
  //              he sighs on a slow cycle instead of bouncing.
  var MOOD_CSS =
    '#' + MASCOT_ID + ' .m-ink { flood-color: rgba(18, 52, 58, 0.55); }' +
    '#' + MASCOT_ID + ' #bm-shadow { transform-box: fill-box; transform-origin: 50% 50%; }' +
    '#' + MASCOT_ID + ' #bm-eyes-happy,' +
    '#' + MASCOT_ID + ' #bm-eyes-sad,' +
    '#' + MASCOT_ID + ' #bm-hangL,' +
    '#' + MASCOT_ID + ' #bm-props,' +
    '#' + MASCOT_ID + ' #bm-sparks { display: none; }' +

    /* ---- guiding: the excited hop ---- */
    '#' + MASCOT_ID + '.baymax-mood-guiding #bm-fig { animation: bm-hop 1.15s steps(1,end) infinite; }' +
    '#' + MASCOT_ID + '.baymax-mood-guiding #bm-shadow { animation: bm-hopshadow 1.15s steps(1,end) infinite; }' +
    '#' + MASCOT_ID + '.baymax-mood-guiding #bm-legL,' +
    '#' + MASCOT_ID + '.baymax-mood-guiding #bm-legR { animation: bm-tuck 1.15s steps(1,end) infinite; }' +
    '#' + MASCOT_ID + '.baymax-mood-guiding #bm-arm { animation: bm-jab 1.15s steps(1,end) infinite; }' +
    '#' + MASCOT_ID + '.baymax-mood-guiding #bm-eyes-normal { animation: bm-blink 4.4s steps(1,end) infinite; }' +
    '@keyframes bm-hop {' +
    '0% { transform: translateY(0); } 9% { transform: translateY(-2px); }' +
    '17% { transform: translateY(-4px); } 26% { transform: translateY(-5px); }' +
    '34% { transform: translateY(-4px); } 41% { transform: translateY(-2px); }' +
    '47% { transform: translateY(0); } 52% { transform: translateY(1px); }' +
    '58%, 100% { transform: translateY(0); }' +
    '}' +
    '@keyframes bm-hopshadow {' +
    '0%, 47%, 100% { transform: scaleX(1); opacity: .22; }' +
    '17%, 41% { transform: scaleX(.74); opacity: .14; }' +
    '26%, 34% { transform: scaleX(.6); opacity: .1; }' +
    '52% { transform: scaleX(1.12); opacity: .26; }' +
    '}' +
    '@keyframes bm-tuck {' +
    '0%, 47%, 100% { transform: translateY(0); } 17%, 41% { transform: translateY(-1px); }' +
    '}' +
    '@keyframes bm-jab { 0%, 100% { transform: translateX(0); } 20%, 38% { transform: translateX(-1px); } }' +
    '@keyframes bm-blink { 0%, 91%, 97%, 100% { opacity: 1; } 92%, 96% { opacity: 0; } }' +

    /* ---- cheer ---- */
    '#' + MASCOT_ID + '.baymax-mood-cheer #bm-eyes-normal { display: none; }' +
    '#' + MASCOT_ID + '.baymax-mood-cheer #bm-eyes-happy { display: block; }' +
    '#' + MASCOT_ID + '.baymax-mood-cheer #bm-sparks { display: block; }' +
    '#' + MASCOT_ID + '.baymax-mood-cheer #bm-fig { animation: bm-cheerhop .95s steps(1,end) infinite; }' +
    '#' + MASCOT_ID + '.baymax-mood-cheer #bm-shadow { animation: bm-cheershadow .95s steps(1,end) infinite; }' +
    '#' + MASCOT_ID + '.baymax-mood-cheer #bm-legL,' +
    '#' + MASCOT_ID + '.baymax-mood-cheer #bm-legR { animation: bm-tuck .95s steps(1,end) infinite; }' +
    '#' + MASCOT_ID + '.baymax-mood-cheer .bm-spark { opacity: 0; animation: bm-spark .95s steps(1,end) infinite; }' +
    '#' + MASCOT_ID + '.baymax-mood-cheer #bm-s2 { animation-delay: .12s; }' +
    '#' + MASCOT_ID + '.baymax-mood-cheer #bm-s3 { animation-delay: .24s; }' +
    '@keyframes bm-cheerhop {' +
    '0% { transform: translateY(0); } 10% { transform: translateY(-4px); }' +
    '18% { transform: translateY(-6px); } 28% { transform: translateY(-3px); }' +
    '34% { transform: translateY(0); } 40% { transform: translateY(-4px); }' +
    '48% { transform: translateY(-6px); } 58% { transform: translateY(-2px); }' +
    '64% { transform: translateY(0); } 69% { transform: translateY(1px); }' +
    '75%, 100% { transform: translateY(0); }' +
    '}' +
    '@keyframes bm-cheershadow {' +
    '0%, 34%, 64%, 100% { transform: scaleX(1); opacity: .22; }' +
    '18%, 48% { transform: scaleX(.58); opacity: .1; }' +
    '69% { transform: scaleX(1.14); opacity: .26; }' +
    '}' +
    '@keyframes bm-spark { 0%, 6% { opacity: 0; } 12%, 52% { opacity: 1; } 58%, 100% { opacity: 0; } }' +

    /* ---- nudge ---- */
    '#' + MASCOT_ID + '.baymax-mood-nudge #bm-arm { animation: bm-nudgejab 2s steps(1,end) infinite; }' +
    '#' + MASCOT_ID + '.baymax-mood-nudge #bm-gait { animation: bm-lean 2s steps(1,end) infinite; }' +
    '#' + MASCOT_ID + '.baymax-mood-nudge #bm-eyes-normal { animation: bm-blink 4.4s steps(1,end) infinite; }' +
    '@keyframes bm-nudgejab {' +
    '0%, 6% { transform: translateX(0); } 9%, 14% { transform: translateX(-2px); }' +
    '17%, 22% { transform: translateX(0); } 25%, 30% { transform: translateX(-2px); }' +
    '33%, 38% { transform: translateX(0); } 41%, 46% { transform: translateX(-2px); }' +
    '50%, 100% { transform: translateX(0); }' +
    '}' +
    '@keyframes bm-lean {' +
    '0%, 6% { transform: translateX(0); } 9%, 46% { transform: translateX(-1px); }' +
    '50%, 100% { transform: translateX(0); }' +
    '}' +

    /* ---- confused ---- */
    '#' + MASCOT_ID + '.baymax-mood-confused #bm-point { display: none; }' +
    '#' + MASCOT_ID + '.baymax-mood-confused #bm-hangL { display: block; }' +
    '#' + MASCOT_ID + '.baymax-mood-confused #bm-props { display: block; }' +
    '#' + MASCOT_ID + '.baymax-mood-confused #bm-head { animation: bm-tilt 2.6s steps(1,end) infinite; }' +
    '#' + MASCOT_ID + '.baymax-mood-confused #bm-fig { animation: bm-slowbob 2.6s steps(1,end) infinite; }' +
    '#' + MASCOT_ID + '.baymax-mood-confused #bm-qmark { animation: bm-qbounce 1s steps(1,end) infinite; }' +
    '#' + MASCOT_ID + '.baymax-mood-confused .bm-dot { opacity: 0; animation: bm-dotcycle 1.8s steps(1,end) infinite; }' +
    '#' + MASCOT_ID + '.baymax-mood-confused #bm-dot2 { animation-delay: .3s; }' +
    '@keyframes bm-tilt {' +
    '0%, 100% { transform: translateX(0); } 30%, 45% { transform: translateX(-1px); }' +
    '65%, 80% { transform: translateX(1px); }' +
    '}' +
    '@keyframes bm-slowbob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-1px); } }' +
    '@keyframes bm-qbounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }' +
    '@keyframes bm-dotcycle { 0%, 12% { opacity: 0; } 18%, 78% { opacity: 1; } 84%, 100% { opacity: 0; } }' +

    /* ---- lost: droop ---- */
    '#' + MASCOT_ID + '.baymax-mood-lost #bm-point { display: none; }' +
    '#' + MASCOT_ID + '.baymax-mood-lost #bm-hangL { display: block; }' +
    '#' + MASCOT_ID + '.baymax-mood-lost #bm-eyes-normal { display: none; }' +
    '#' + MASCOT_ID + '.baymax-mood-lost #bm-eyes-sad { display: block; }' +
    '#' + MASCOT_ID + '.baymax-mood-lost #bm-gait { transform: translateY(1px); }' +
    '#' + MASCOT_ID + '.baymax-mood-lost #bm-head { transform: translateY(1px); }' +
    '#' + MASCOT_ID + '.baymax-mood-lost #bm-fig { animation: bm-sigh 4s steps(1,end) infinite; }' +
    '@keyframes bm-sigh {' +
    '0%, 44% { transform: translateY(0); } 50%, 88% { transform: translateY(1px); }' +
    '94%, 100% { transform: translateY(0); }' +
    '}' +

    '@media (prefers-reduced-motion: reduce) {' +
    '#' + MASCOT_ID + ' * { animation: none !important; }' +
    '}'

  // Lazily creates the shadow host + root and injects our stylesheet into it.
  // The host is a zero-size fixed element so it never affects page layout; it
  // must NOT get transforms/filters, or position:fixed children would anchor
  // to it instead of the viewport.
  function ensureRoot() {
    if (shadowRoot && shadowRoot.host.isConnected) return shadowRoot

    var host = document.getElementById(HOST_ID)
    if (host) host.remove()

    host = document.createElement('div')
    host.id = HOST_ID
    host.style.cssText =
      'position: fixed; top: 0; left: 0; width: 0; height: 0;' +
      'z-index: 2147483647; pointer-events: none;'
    shadowRoot = host.attachShadow({ mode: SHADOW_MODE })

    var style = document.createElement('style')
    // MOOD_CSS is declared after OVERLAY_CSS, so it is joined here rather than
    // inlined above — by the time a root is needed both are assigned.
    style.textContent = OVERLAY_CSS + MOOD_CSS
    shadowRoot.appendChild(style)
    ;(document.body || document.documentElement).appendChild(host)
    return shadowRoot
  }

  function inRoot(id) {
    return shadowRoot ? shadowRoot.getElementById(id) : null
  }

  // ---------- the pixel mascot ----------
  //
  // Same geometry as the side panel's sprites (src/components/shared/
  // mascotPixels.js) and the marketing WanderMascot. Content scripts are
  // bundler-free classic scripts, so that module cannot be imported — this is
  // the THIRD hand-synced copy of the figure. Change one, change all three.
  //
  // Coordinates are the family's 26-wide grid, widened to make room for the
  // outstretched arm: viewBox "-4 -7 30 30". Flipped via .baymax-flip when he
  // stands on the element's left, so the arm still points the right way.

  function pxMerge(cells) {
    var rows = {}
    cells.forEach(function (c) {
      ;(rows[c[1]] = rows[c[1]] || []).push(c[0])
    })
    var rects = []
    Object.keys(rows).forEach(function (y) {
      var xs = rows[y].slice().sort(function (a, b) {
        return a - b
      })
      var start = xs[0]
      var prev = xs[0]
      for (var i = 1; i <= xs.length; i++) {
        var x = xs[i]
        if (x !== prev + 1) {
          rects.push({ x: start, y: +y, w: prev - start + 1 })
          start = x
        }
        prev = x
      }
    })
    return rects
  }

  function pxGroup(id, cells, fill, cls) {
    if (!cells.length) return ''
    return (
      '<g' + (id ? ' id="' + id + '"' : '') + (cls ? ' class="' + cls + '"' : '') + '>' +
      pxMerge(cells)
        .map(function (r) {
          return (
            '<rect x="' + r.x + '" y="' + r.y + '" width="' + r.w +
            '" height="1.02" fill="' + fill + '"/>'
          )
        })
        .join('') +
      '</g>'
    )
  }

  function pxRect(x0, y0, x1, y1) {
    var a = []
    for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) a.push([x, y])
    return a
  }

  function pxMap(rows, ox, oy) {
    var a = []
    rows.forEach(function (row, j) {
      for (var i = 0; i < row.length; i++) if (row[i] === '#') a.push([ox + i, oy + j])
    })
    return a
  }

  // A pixelated ellipse. Separate radii above and below the centre line let one
  // shape be a pear (narrow shoulders, heavy belly) instead of a symmetric egg.
  function pxOval(cx, cy, rx, ryTop, ryBot, y0, y1) {
    var a = []
    for (var y = y0; y <= y1; y++) {
      var yc = y + 0.5
      var dy = (yc - cy) / (yc < cy ? ryTop : ryBot)
      if (dy < -1 || dy > 1) continue
      var span = rx * Math.sqrt(1 - dy * dy)
      for (var x = -10; x <= 25; x++) if (Math.abs(x + 0.5 - cx) <= span) a.push([x, y])
    }
    return a
  }

  function pxMirror(cells) {
    return cells.map(function (c) {
      return [25 - c[0], c[1]]
    })
  }

  function pxPlus(ox, oy) {
    return [[ox + 1, oy], [ox, oy + 1], [ox + 1, oy + 1], [ox + 2, oy + 1], [ox + 1, oy + 2]]
  }

  function buildMascotSVG() {
    var head = pxOval(13, 4.5, 5.2, 3.6, 3.6, 1, 7)
    var neck = pxRect(11, 8, 14, 8)
    var torso = pxOval(13, 14.4, 8.0, 5.6, 4.8, 9, 18)
    var shade = pxRect(6, 16, 7, 16).concat(
      pxRect(18, 16, 19, 16), pxRect(7, 17, 8, 17),
      pxRect(17, 17, 18, 17), pxRect(9, 18, 16, 18)
    )

    // Three faces, drawn once and switched with display — never redrawn, so a
    // mood change costs nothing. Baymax has no mouth, so this is the whole
    // emotional range: eyes closed (content), eyes low and short (droopy).
    var eyesNormal = pxRect(9, 3, 10, 5).concat(pxRect(15, 3, 16, 5), pxRect(11, 4, 14, 4))
    var eyesHappy = pxRect(9, 4, 16, 4)
    var eyesSad = pxRect(9, 4, 10, 5).concat(pxRect(15, 4, 16, 5), pxRect(11, 5, 14, 5))

    var shoulder = [
      [6, 10], [7, 10], [8, 10], [9, 10],
      [4, 11], [5, 11], [6, 11], [7, 11], [8, 11],
      [3, 12], [4, 12], [5, 12], [6, 12], [7, 12],
      [2, 13], [3, 13],
    ]
    var forearm = [
      [1, 14], [2, 14], [3, 14], [1, 15], [2, 15], [3, 15],
      [1, 16], [2, 16], [3, 16], [1, 17], [2, 17], [3, 17], [2, 18], [3, 18],
    ]
    var hangL = shoulder.concat(forearm)
    var hangR = pxMirror(hangL)

    // The pointing arm is welded to the torso, and is split for the same reason
    // the hanging arms are: transform the whole thing and the shoulder cells
    // slide past the torso's narrower rows and stick out as a nub. The inner
    // stub never moves; only the outer part jabs. They overlap far enough that
    // it never tears off.
    var pointShoulder = shoulder.filter(function (c) {
      return c[1] < 13
    })
    var pointInner = pxRect(2, 11, 6, 13)
    // A plain straight arm three cells thick, with the middle row reaching one
    // cell further so the tip looks finished rather than sawn off.
    var pointOuter = pxRect(-1, 11, 3, 11).concat(pxRect(-2, 12, 3, 12), pxRect(-1, 13, 3, 13))

    var legL = pxRect(9, 19, 11, 20)
    var legR = pxRect(14, 19, 16, 20)
    var shadow = pxRect(8, 21, 17, 21)
    var qmark = pxMap(['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'], 17, -6)

    // A one-cell ink rim. The Console is white and so is Baymax — without this
    // he dissolves into the page he is standing on. feMorphology recomputes it
    // every frame, so it follows the hop and the jab for free.
    // The 'out' step cuts the figure back out of the dilated alpha, so the rim
    // exists ONLY outside the silhouette. Without it the rim is painted under
    // the whole figure and shows through anywhere the interior is not perfectly
    // opaque — which is every rect seam the moment antialiasing creeps in.
    var ink =
      '<defs><filter id="bm-ink" x="-30%" y="-30%" width="160%" height="160%">' +
      '<feMorphology operator="dilate" radius="0.7" in="SourceAlpha" result="fat"/>' +
      '<feComposite in="fat" in2="SourceAlpha" operator="out" result="ring"/>' +
      '<feFlood class="m-ink" result="inkc"/>' +
      '<feComposite in="inkc" in2="ring" operator="in" result="rim"/>' +
      '<feMerge><feMergeNode in="rim"/><feMergeNode in="SourceGraphic"/></feMerge>' +
      '</filter></defs>'

    return (
      '<svg viewBox="-4 -7 30 30" height="124" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Baymax">' +
      ink +
      // The ground shadow sits outside the hop and outside the ink rim so it can
      // shrink and fade on its own as he leaves the ground. It is what actually
      // sells the jump — without it he just slides up and down.
      '<g id="bm-shadow" opacity=".22">' +
      pxMerge(shadow)
        .map(function (r) {
          return (
            '<rect x="' + r.x + '" y="' + r.y + '" width="' + r.w +
            '" height="1" fill="#0d2226"/>'
          )
        })
        .join('') +
      '</g>' +
      '<g id="bm-fig" filter="url(#bm-ink)">' +
      '<g id="bm-gait">' +
      pxGroup(null, torso.concat(neck), '#ffffff') +
      pxGroup(null, shade, '#dfe7ea') +
      pxGroup('bm-hangL', hangL, '#ffffff') +
      pxGroup(null, hangR, '#ffffff') +
      '<g id="bm-point">' +
      pxGroup(null, pointShoulder, '#ffffff') +
      pxGroup(null, pointInner, '#ffffff') +
      pxGroup('bm-arm', pointOuter, '#ffffff') +
      '</g>' +
      '<g id="bm-head">' +
      pxGroup(null, head, '#ffffff') +
      pxGroup('bm-eyes-normal', eyesNormal, '#00403e') +
      pxGroup('bm-eyes-happy', eyesHappy, '#00403e') +
      pxGroup('bm-eyes-sad', eyesSad, '#00403e') +
      '</g>' +
      '</g>' +
      pxGroup('bm-legL', legL, '#ffffff') +
      pxGroup('bm-legR', legR, '#ffffff') +
      '</g>' +
      '<g id="bm-props">' +
      pxGroup('bm-qmark', qmark, '#ffffff') +
      pxGroup('bm-dot1', [[16, 1]], '#ffffff', 'bm-dot') +
      pxGroup('bm-dot2', [[18, -1]], '#ffffff', 'bm-dot') +
      '</g>' +
      '<g id="bm-sparks">' +
      pxGroup('bm-s1', pxPlus(4, -2), '#f7c948', 'bm-spark') +
      pxGroup('bm-s2', pxPlus(19, -3), '#f7c948', 'bm-spark') +
      pxGroup('bm-s3', pxPlus(21, 3), '#f7c948', 'bm-spark') +
      '</g>' +
      '</svg>'
    )
  }

  var MASCOT_SVG = buildMascotSVG()

  function clearMascot() {
    var existing = inRoot(MASCOT_ID)
    if (existing) existing.remove()
  }

  function clearOverlay() {
    var existing = inRoot(OVERLAY_ID)
    if (existing) existing.remove()
    clearMascot()
    clearMoodTimers()
    stopReposition()
    highlightTarget = null
    currentIntent = null
    currentReportKey = ''
    currentOpts = null
    fillMatchValue = null
    if (reposition) {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
      reposition = null
    }
    unwatchElement()
    unwatchFill()
    unwatchOption()
    unwatchFillDoc()
    unwatchFillFocus()
  }

  // First VISIBLE match for a comma-separated selector list, or null.
  //
  // Visibility (not list order) is what decides, because the console HIDES
  // collapsed controls rather than removing them: when its window is narrow (a
  // wide side panel does it), the top-bar search input stays in the DOM but
  // goes invisible and an "Open search" icon button takes its place. A plain
  // querySelector would return that ghost input, so a reveal path listing both
  // would grab the hidden one and never reach the icon that actually works.
  // Skipping invisible matches lets ONE selector list serve both layouts — the
  // real control where there's room for it, the icon that summons it where
  // there isn't.
  function findVisibleElement(selector) {
    if (!selector) return null
    var selectors = selector
      .split(',')
      .map(function (s) {
        return s.trim()
      })
      .filter(Boolean)
    for (var i = 0; i < selectors.length; i++) {
      try {
        var els = document.querySelectorAll(selectors[i])
        for (var j = 0; j < els.length; j++) {
          if (isVisible(els[j])) return els[j]
        }
      } catch {
        /* invalid selector fallback, try next */
      }
    }
    return null
  }

  // ── Resilient resolver ─────────────────────────────────────────────────
  // Instead of trusting one CSS selector (which breaks when GCP changes its
  // DOM, renders custom <mat-*> components, or shows a different layout when
  // the instance list is non-empty), we describe a target by intent —
  // { selector, role, name, text, href } — and SCORE every candidate on the
  // live page, picking the best VISIBLE one. Role + accessible-name win over
  // brittle selectors, and an in-viewport tie-break stops us grabbing an
  // off-screen look-alike (e.g. an existing instance link that also matches
  // a[href*="/sql/instances"]).

  var ACCEPT_THRESHOLD = 45

  // Collapse runs of whitespace (including non-breaking spaces, which GCP uses
  // in labels like "Cloud&nbsp;SQL") to single regular spaces, so name/text
  // matching isn't defeated by   vs " ".
  function norm(s) {
    return (s || '').replace(/\s+/g, ' ').trim()
  }

  function isVisible(el) {
    if (!el || !el.getBoundingClientRect) return false
    var rect = el.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return false
    var st = window.getComputedStyle(el)
    return st.visibility !== 'hidden' && st.display !== 'none' && st.opacity !== '0'
  }

  function inViewport(el) {
    var r = el.getBoundingClientRect()
    return r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth
  }

  // Stricter than inViewport: true only when the element is COMFORTABLY in view
  // — fully below the console's fixed top bar and above the bottom of the
  // viewport. inViewport() returns true even when an element's top is tucked
  // behind the header, which left targets highlighted but unreadable; this
  // decides when to scroll them into clear view instead.
  var TOP_SAFE_PX = 140 // height to clear the GCP top bar
  function isWellInView(el) {
    var r = el.getBoundingClientRect()
    // Elements taller than the usable area can't satisfy this — let the caller
    // center them rather than scrolling forever.
    if (r.height > window.innerHeight - TOP_SAFE_PX - 16) return inViewport(el)
    return r.top >= TOP_SAFE_PX && r.bottom <= window.innerHeight - 16
  }

  // ARIA role, falling back to an implicit role from the tag.
  function elementRole(el) {
    var explicit = el.getAttribute && el.getAttribute('role')
    if (explicit) return explicit
    var tag = (el.tagName || '').toLowerCase()
    if (tag === 'a' && el.getAttribute('href')) return 'link'
    if (tag === 'button') return 'button'
    if (tag === 'input') {
      var t = (el.getAttribute('type') || 'text').toLowerCase()
      if (t === 'checkbox') return 'checkbox'
      if (t === 'radio') return 'radio'
      if (t === 'submit' || t === 'button') return 'button'
      return 'textbox'
    }
    if (tag === 'textarea') return 'textbox'
    if (tag === 'select' || tag === 'mat-select') return 'combobox'
    // Angular Material custom elements GCP uses heavily.
    if (tag === 'mat-radio-button') return 'radio'
    if (tag === 'mat-checkbox') return 'checkbox'
    if (tag === 'mat-option') return 'option'
    return ''
  }

  // Best-effort accessible name (a simplified version of the ARIA name algo).
  function accessibleName(el) {
    if (!el || !el.getAttribute) return ''
    var aria = el.getAttribute('aria-label')
    if (aria) return aria.trim()
    var labelledby = el.getAttribute('aria-labelledby')
    if (labelledby) {
      var ref = document.getElementById(labelledby)
      if (ref) return (ref.textContent || '').trim()
    }
    var tag = (el.tagName || '').toUpperCase()
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'MAT-SELECT' || tag === 'SELECT') {
      var ph = el.getAttribute('placeholder')
      if (ph) return ph.trim()
      if (el.id) {
        var lbl = document.querySelector('label[for="' + (window.CSS && CSS.escape ? CSS.escape(el.id) : el.id) + '"]')
        if (lbl) return (lbl.textContent || '').trim()
      }
      var fc = el.getAttribute('formcontrolname') || el.getAttribute('name')
      if (fc) return fc
      return ''
    }
    var title = el.getAttribute('title')
    if (title) return title.trim()
    // Only treat textContent as an accessible name for elements that are
    // actually named that way — links, buttons, menu items, radios, headings.
    // A generic container (the <div> wrapping a whole dropdown, or the Summary
    // panel) must return '' so it can't out-score the precise control inside it.
    var role = (el.getAttribute('role') || '').toLowerCase()
    var lowtag = (el.tagName || '').toLowerCase()
    var NAMEABLE_TAGS = {
      a: 1,
      button: 1,
      summary: 1,
      label: 1,
      h1: 1,
      h2: 1,
      h3: 1,
      h4: 1,
      'mat-radio-button': 1,
      'mat-checkbox': 1,
      'mat-option': 1,
    }
    var NAMEABLE_ROLES = {
      button: 1,
      link: 1,
      menuitem: 1,
      option: 1,
      tab: 1,
      radio: 1,
      checkbox: 1,
      switch: 1,
    }
    if (NAMEABLE_TAGS[lowtag] || NAMEABLE_ROLES[role]) {
      return (el.textContent || '').trim().slice(0, 120)
    }
    return ''
  }

  // Gather candidates: every selector match, plus (when an intent is given)
  // all interactive-ish elements. Tagged with whether the selector matched so
  // selector hits get a baseline score.
  function candidatePool(intent) {
    var map = new Map()
    function add(el, fromSelector) {
      if (!el) return
      var prev = map.get(el)
      map.set(el, { el: el, fromSelector: fromSelector || (prev && prev.fromSelector) || false })
    }
    if (intent.selector) {
      intent.selector.split(',').forEach(function (s) {
        try {
          document.querySelectorAll(s.trim()).forEach(function (el) {
            add(el, true)
          })
        } catch {
          /* invalid selector — skip */
        }
      })
    }
    // `extraSelector` is a self-heal channel: when a step's authored selector
    // stops matching (GCP changed its DOM), the backend LLM picks a real element
    // from a page snapshot and hands its live CSS path back here. It's scored
    // like a selector hit (fromSelector) but kept separate from `selector` so the
    // step's progress is still reported under its original selector key.
    if (intent.extraSelector) {
      intent.extraSelector.split(',').forEach(function (s) {
        try {
          document.querySelectorAll(s.trim()).forEach(function (el) {
            add(el, true)
          })
        } catch {
          /* invalid selector — skip */
        }
      })
    }
    // `requireSelector` steps opt out of the generic interactive-element scan:
    // they ONLY match their own selector. Used when a step's name is a common
    // word that also appears elsewhere on the page (e.g. step 2's "Cloud SQL",
    // which is also the left-nav branding) so we don't highlight a look-alike
    // when the real target — a search result — isn't on the page.
    if (!intent.requireSelector && (intent.role || intent.name || intent.text || intent.href)) {
      // Mirror the snapshot set: include checkboxes, radios, switches and their
      // Angular Material wrappers (mat-checkbox/mat-radio-button) plus labels.
      // Without these, a recorded checkbox step whose authored selector no longer
      // matches has NO candidate to fall back to and reports "not found", even
      // though it's right there by name (e.g. "Prevent instance deletion").
      var INTERACTIVE =
        'a,button,input,textarea,select,mat-select,summary,label,' +
        'mat-checkbox,mat-radio-button,mat-option,' +
        '[role="button"],[role="link"],[role="option"],[role="combobox"],' +
        '[role="menuitem"],[role="tab"],[role="checkbox"],[role="radio"],' +
        '[role="switch"],[tabindex]'
      try {
        document.querySelectorAll(INTERACTIVE).forEach(function (el) {
          add(el, false)
        })
      } catch {
        /* ignore */
      }
    }
    return Array.from(map.values())
  }

  function scoreCandidate(entry, intent) {
    var el = entry.el
    if (!isVisible(el)) return -Infinity

    var score = 0
    if (entry.fromSelector) score += 35

    var name = norm(accessibleName(el)).toLowerCase()
    var text = norm(el.textContent || '').toLowerCase()

    // Reject look-alikes by text. Comma-separated terms — if ANY appears in the
    // element's text it's disqualified. Used to drop "Enterprise Plus" (vs
    // "Enterprise") and the documentation/marketplace rows (vs the Cloud SQL
    // product result).
    if (intent.avoidText) {
      var avoidList = intent.avoidText.toLowerCase().split(',')
      for (var ai = 0; ai < avoidList.length; ai++) {
        var avoidTerm = avoidList[ai].trim()
        if (avoidTerm && text.indexOf(avoidTerm) !== -1) return -Infinity
      }
    }

    if (intent.name) {
      // When a step names its target, the name MUST match. Otherwise we'd fall
      // back to a stray selector hit and highlight junk (e.g. before the
      // "Cloud SQL" search result has even rendered). Failing to "not-found"
      // makes the step retry until the real element appears — far better than
      // pointing at the wrong thing.
      var want = norm(intent.name).toLowerCase()
      if (intent.exactName) {
        // Require an EXACT match — rejects look-alikes such as "Cloud SQL for
        // MySQL" or "Enterprise Plus" when we asked for "Cloud SQL"/"Enterprise".
        if (name === want || text === want) score += 120
        else return -Infinity
      } else if (name === want) score += 100
      else if (name.indexOf(want) !== -1) score += 60
      else if (text.indexOf(want) !== -1) score += 35
      else return -Infinity
    }
    if (intent.text) {
      if (text.indexOf(norm(intent.text).toLowerCase()) !== -1) score += 25
    }
    if (intent.role && elementRole(el) === intent.role) score += 20
    if (intent.href) {
      var href = el.getAttribute('href') || ''
      if (href.indexOf(intent.href) !== -1) score += 25
    }
    // Steer away from look-alikes: e.g. the "Cloud SQL" Marketplace result vs
    // the actual Cloud SQL product link.
    if (intent.avoidHref) {
      var ahref = el.getAttribute('href') || ''
      if (ahref.indexOf(intent.avoidHref) !== -1) score -= 100
    }
    if (inViewport(el)) score += 15

    // The field the user is actually focused on / typing into is almost
    // certainly the right target — decisive for the console search box, which
    // has several look-alike inputs but only one focused field.
    if (el === document.activeElement) score += 30

    var r = el.getBoundingClientRect()
    var area = r.width * r.height
    if (area > 0 && area < 90000) score += 5

    // Specificity nudge: prefer the tightest element. A <div> wrapping a whole
    // dropdown has the same text as the menu item inside it but much more of
    // it, so penalising long text content steers us to the precise item.
    var text2 = (el.textContent || '').trim()
    score -= Math.min(text2.length / 25, 12)

    return score
  }

  // Some targets only exist while a transient panel is open — e.g. the
  // "Cloud Run" search result lives in the search-suggestions dropdown, which
  // closes the moment the page loses focus (i.e. the instant the user clicks
  // "Show me"/"Do it for me" in the side panel). A step can declare
  // `revealSelector`, the control that summons the panel back: focus it and
  // re-fire an input event so the suggestions re-render, then re-resolve.
  // `revealValue` refills the control if it came back empty (e.g. the console
  // cleared the search box).
  //
  // A reveal can take more than one round: on a narrow window the console's
  // search bar collapses to an "Open search" icon, so round 1 clicks the icon
  // (which expands AND focuses the real input) and only round 2 can type the
  // query into that input to summon the suggestions. Each round re-picks the
  // first VISIBLE reveal control, which is what makes one selector list work at
  // both widths.
  var REVEAL_WAIT_MS = 900
  var REVEAL_ROUNDS = 2
  function tryReveal(intent) {
    if (!intent.revealSelector) return false
    var el = findVisibleElement(intent.revealSelector)
    if (!el) return false
    el.focus()
    if (el.click) el.click()
    // Only real text controls carry the query. A <button> ALSO has a `value`
    // property, so the old `'value' in el` test caught the collapsed-search
    // icon — and calling the HTMLInputElement value setter on a button throws
    // "Illegal invocation", which would kill the whole message listener and
    // leave the side panel waiting on a reply that never comes.
    var tag = el.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA') {
      if (!el.value && intent.revealValue) {
        var proto =
          tag === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
        var desc = Object.getOwnPropertyDescriptor(proto, 'value')
        if (desc && desc.set) desc.set.call(el, intent.revealValue)
        else el.value = intent.revealValue
      }
      if (el.value) el.dispatchEvent(new Event('input', { bubbles: true }))
    }
    return true
  }

  // Reveal → wait for the render → re-resolve, up to REVEAL_ROUNDS times.
  // Calls done(el) with the resolved element, or done(null) when there's no
  // reveal control left to try. Shared by highlight(), click() and fill().
  function revealAndResolve(intent, done, round) {
    round = round || 0
    if (round >= REVEAL_ROUNDS || !tryReveal(intent)) {
      done(null)
      return
    }
    setTimeout(function () {
      var el = resolveTarget(intent)
      if (el) {
        done(el)
        return
      }
      revealAndResolve(intent, done, round + 1)
    }, REVEAL_WAIT_MS)
  }

  // Resolve an intent to the single best element, or null. Accepts a bare
  // selector string for backward compatibility with old call sites.
  function resolveTarget(intent) {
    if (typeof intent === 'string') intent = { selector: intent }
    if (!intent) return null
    var pool = candidatePool(intent)
    var best = null
    var bestScore = -Infinity
    for (var i = 0; i < pool.length; i++) {
      var s = scoreCandidate(pool[i], intent)
      if (s > bestScore) {
        bestScore = s
        best = pool[i].el
      }
    }
    return bestScore >= ACCEPT_THRESHOLD ? best : null
  }

  // ── Recorder foundation ────────────────────────────────────────────────
  // fingerprintElement captures the bundle of stable signals resolveTarget
  // reads back — role + accessible name are primary, the raw structural path
  // is a last resort. This is the "write" side; resolveTarget is the "read"
  // side. A recorded guide stores these fingerprints as step intents.

  function cssPath(el) {
    var parts = []
    var node = el
    while (node && node.nodeType === 1 && parts.length < 6) {
      var part = node.tagName.toLowerCase()
      if (node.id) {
        parts.unshift(part + '#' + node.id)
        break
      }
      var sib = node
      var n = 1
      while (sib.previousElementSibling) {
        sib = sib.previousElementSibling
        if (sib.tagName === node.tagName) n++
      }
      parts.unshift(part + ':nth-of-type(' + n + ')')
      node = node.parentElement
    }
    return parts.join(' > ')
  }

  function fingerprintElement(el) {
    return {
      role: elementRole(el),
      name: accessibleName(el),
      text: (el.textContent || '').trim().slice(0, 120),
      tag: (el.tagName || '').toLowerCase(),
      href: (el.getAttribute && el.getAttribute('href')) || null,
      formControl:
        (el.getAttribute && (el.getAttribute('formcontrolname') || el.getAttribute('name'))) || null,
      domPath: cssPath(el),
    }
  }

  function positionOverlay(el) {
    var rect = el.getBoundingClientRect()
    var overlay = inRoot(OVERLAY_ID)
    if (!overlay) {
      overlay = document.createElement('div')
      overlay.id = OVERLAY_ID
      ensureRoot().appendChild(overlay)
    }
    overlay.style.top = rect.top - 4 + 'px'
    overlay.style.left = rect.left - 4 + 'px'
    overlay.style.width = rect.width + 8 + 'px'
    overlay.style.height = rect.height + 8 + 'px'
    positionMascot(el)
  }

  // opts: { title, message, stepNumber, totalSteps, cheer, lost }
  function buildMascot(opts) {
    clearMascot()
    var root = ensureRoot()
    var mascot = document.createElement('div')
    mascot.id = MASCOT_ID
    // Mood drives the figure's animation; `lost` is separate and drives the
    // "Take me back" button, so a confused Baymax can still offer the way back.
    mascot.className =
      'baymax-mood-' + (opts.mood || 'guiding') + (opts.lost ? ' baymax-lost' : '')

    if (opts.title || opts.message) {
      var bubble = document.createElement('div')
      bubble.className = 'baymax-bubble'

      var closeBtn = document.createElement('button')
      closeBtn.className = 'baymax-close'
      closeBtn.type = 'button'
      closeBtn.title = 'Hide Baymax'
      closeBtn.textContent = '×'
      closeBtn.addEventListener('click', function () {
        clearOverlay()
        send({ type: 'BAYMAX_GUIDE_DISMISSED' })
      })
      bubble.appendChild(closeBtn)

      if (opts.title) {
        var titleEl = document.createElement('div')
        titleEl.className = 'baymax-bubble-title'
        titleEl.textContent = opts.title
        bubble.appendChild(titleEl)
      }
      if (opts.message) {
        var msgEl = document.createElement('div')
        msgEl.textContent = opts.message
        bubble.appendChild(msgEl)
      }
      mascot.appendChild(bubble)
    }

    var figure = document.createElement('div')
    figure.className = 'baymax-figure'
    figure.innerHTML = MASCOT_SVG
    mascot.appendChild(figure)

    // Outside "lost" mode, clicking Baymax collapses/expands his speech bubble
    // and sign board so he can be tucked out of the way without dismissing him.
    if (!opts.lost) {
      figure.title = 'Click to hide/show the message'
      figure.addEventListener('click', function () {
        mascot.classList.toggle('baymax-collapsed')
        // Hiding the speech bubble makes the mascot shorter, so re-anchor it to
        // the target — otherwise the figure (and its pointing arm) jumps up and
        // no longer lines up with the highlighted button.
        if (reposition) reposition()
      })
    }

    if (opts.lost) {
      // Clicking Baymax (or his button) sends the user back to the step's page.
      var goBack = function () {
        send({ type: 'BAYMAX_GUIDE_GO_BACK' })
      }
      figure.title = 'Take me back'
      figure.addEventListener('click', goBack)
      var backBtn = document.createElement('button')
      backBtn.className = 'baymax-back'
      backBtn.type = 'button'
      backBtn.textContent = '← Take me back'
      backBtn.addEventListener('click', goBack)
      mascot.appendChild(backBtn)
    } else if (opts.stepNumber && opts.totalSteps) {
      // The little sign board Baymax holds up.
      var board = document.createElement('div')
      board.className = 'baymax-board'
      var stepEl = document.createElement('div')
      stepEl.className = 'baymax-board-step'
      stepEl.textContent = 'Step ' + opts.stepNumber + ' of ' + opts.totalSteps
      board.appendChild(stepEl)
      if (opts.cheer) {
        var cheerEl = document.createElement('div')
        cheerEl.textContent = opts.cheer
        board.appendChild(cheerEl)
      }
      mascot.appendChild(board)
    }

    root.appendChild(mascot)
    return mascot
  }

  // How far above the mascot's bottom edge the pointing arm sits, used to line
  // the ARM up with the target rather than the middle of the whole stack.
  //
  // The old vector figure put its arm ~52px above the svg's bottom; the pixel
  // one puts it at ~46px (row 12 of a 30-row viewBox rendered 124px tall), so
  // this came down from 55. It is derived, not measured — if the arm points a
  // few pixels high or low on a real Console page, this is the number to nudge.
  var ARM_OFFSET = 49

  // Stands the mascot beside the target: to its right when there's room
  // (arm points left at the element), otherwise to its left (flipped).
  // When the target scrolls out of view the mascot fades out and waits —
  // it stays with its element instead of chasing the user around the page.
  function positionMascot(el) {
    var mascot = inRoot(MASCOT_ID)
    if (!mascot) return
    var rect = el.getBoundingClientRect()

    var visible =
      rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth
    mascot.classList.toggle('baymax-offscreen', !visible)
    if (!visible) return

    var width = mascot.offsetWidth || 250
    var height = mascot.offsetHeight || 200
    var margin = 16

    var left = rect.right + margin
    var flipped = false
    var below = false
    if (left + width > window.innerWidth - 8) {
      left = rect.left - width - margin
      flipped = true
    }
    if (left < 8) {
      // No room on either side — sit below the element instead.
      left = Math.min(Math.max(rect.left, 8), window.innerWidth - width - 8)
      flipped = false
      below = true
    }

    // Align the pointing arm (near the bottom of the mascot) with the
    // element's vertical center, clamped to the viewport. In the "below"
    // fallback, drop under the element so the bubble doesn't cover it.
    var top = below
      ? rect.bottom + margin
      : rect.top + rect.height / 2 - height + ARM_OFFSET
    top = Math.min(Math.max(top, 8), window.innerHeight - height - 8)

    mascot.style.left = left + 'px'
    mascot.style.top = top + 'px'
    mascot.classList.toggle('baymax-flip', flipped)
  }

  // Draw the pulsing outline + mascot on an already-resolved element and start
  // watching it. Split out from highlight() so click()/fill() can act on the
  // exact same element the resolver chose (no second resolve that might differ).
  function stopReposition() {
    if (repositionRaf) cancelAnimationFrame(repositionRaf)
    repositionRaf = null
  }

  // Re-anchor the existing outline/mascot onto a freshly resolved element
  // (reusing the current mascot — no pop animation, no flicker) and re-bind the
  // click/typing watchers to it.
  function reanchorHighlight(el) {
    highlightTarget = el
    positionOverlay(el)
    watchElement(el, currentReportKey)
    var tag = (el.tagName || '').toUpperCase()
    if ((currentOpts && currentOpts.stepAction === 'fill') || tag === 'INPUT' || tag === 'TEXTAREA') {
      watchFill(el, currentReportKey)
    }
  }

  // Keep the outline + mascot glued to the target every frame. Two failure modes
  // it heals, both seen on the create-instance form when a validation error
  // ("Another instance already uses this ID") appears:
  //   • the field MOVES (the error pushes it down) — reposition to its new box;
  //   • the field is REPLACED (the framework re-renders the form, detaching the
  //     node we were glued to) — re-resolve from the intent and re-anchor, i.e.
  //     auto-"Show me" without the user clicking anything.
  // We only restyle when the box actually changes, and only re-resolve when the
  // node vanished or on a slow tick, so the idle cost stays ~one rect read/frame.
  var RERESOLVE_MS = 1200
  function startReposition() {
    stopReposition()
    var last = ''
    var lastResolveAt = 0
    function tick() {
      repositionRaf = requestAnimationFrame(tick)
      var el = highlightTarget
      var now = Date.now()
      // Periodic re-resolve is for steps WE own the target of (highlight/click);
      // for 'fill' steps the focus-follower owns the target, so only re-resolve
      // there when the node is actually gone (don't fight the focused field).
      var periodicOk = !currentOpts || currentOpts.stepAction !== 'fill'
      var gone = !el || !el.isConnected
      // Throttle: retry quickly while the node is missing, but only sweep on the
      // slow cadence otherwise — so we never scan the DOM every frame.
      var minGap = gone ? 200 : RERESOLVE_MS
      if (currentIntent && (gone || periodicOk) && now - lastResolveAt >= minGap) {
        lastResolveAt = now
        var fresh = resolveTarget(currentIntent)
        if (fresh && fresh !== el) {
          last = '' // force a reposition onto the new node
          reanchorHighlight(fresh)
          el = fresh
        }
      }
      if (!el || !el.isConnected) return
      var r = el.getBoundingClientRect()
      if (r.width <= 0 && r.height <= 0) return // detached/hidden — keep last spot
      var key =
        Math.round(r.top) + ',' + Math.round(r.left) + ',' + Math.round(r.width) + ',' + Math.round(r.height)
      if (key === last) return
      last = key
      positionOverlay(el)
    }
    repositionRaf = requestAnimationFrame(tick)
  }

  function renderHighlight(el, reportKey, opts, intent) {
    opts = opts || {}
    clearOverlay()
    // Remember how this step was targeted so the reposition loop can re-resolve
    // and re-anchor if the framework swaps the element out. click()/fill() pass
    // no intent (they act once), so they get no periodic re-resolve.
    currentIntent = intent || null
    currentReportKey = reportKey
    currentOpts = opts
    // Steps that opted in (advanceOnValueMatch) only complete once the typed
    // text contains this value; everything else keeps the any-pause behavior.
    fillMatchValue =
      opts.stepAction === 'fill' && opts.matchValue ? normalizeFillValue(opts.matchValue) : null
    // Scroll the target to the middle unless it's already comfortably visible.
    // Using isWellInView (not just inViewport) means an element tucked behind
    // the fixed top bar gets centered so the user can actually see what's
    // highlighted, instead of staring at a highlight clipped under the header.
    if (!isWellInView(el)) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    highlightTarget = el

    // Cheer on a step we have not shown before — the user got here by finishing
    // the last one. Comparing against the stored number matters: re-highlighting
    // the SAME step (a re-anchor, or "Show me" pressed again) must not celebrate.
    // The cheer rides in on the NEXT step rather than firing on the click,
    // because the click usually navigates and would cut the animation off.
    var stepNo = typeof opts.stepNumber === 'number' ? opts.stepNumber : null
    var cheering = stepNo !== null && stepNo > 1 && stepNo !== readLastStep()
    if (stepNo !== null) writeLastStep(stepNo)

    opts.mood = cheering ? 'cheer' : 'guiding'
    buildMascot(opts)
    positionOverlay(el)

    // The cheer is a one-shot — settle into the pointing pose once it has played.
    // (clearOverlay above already dropped any timers from the previous step.)
    if (cheering) {
      moodTimer = setTimeout(function () {
        setMood('guiding')
        armNudge()
      }, CHEER_MS)
    } else {
      armNudge()
    }

    reposition = function () {
      positionOverlay(highlightTarget || el)
    }
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    startReposition()
    watchElement(el, reportKey)

    // Watch typing on inputs so fill-style steps complete when the user
    // types the value themselves.
    var tag = (el.tagName || '').toUpperCase()
    if (opts.stepAction === 'fill' || tag === 'INPUT' || tag === 'TEXTAREA') {
      watchFill(el, reportKey)
    }

    // For a 'fill' step, also (a) re-anchor the highlight onto whatever text
    // field the user focuses, and (b) watch typing across the whole page — the
    // user may type into a different field than the one we highlighted (notably
    // the console search box, which swaps in a fresh input when it expands), and
    // we still want the highlight to fit and the step to advance.
    if (opts.stepAction === 'fill') {
      watchFillFocus(reportKey)
      watchFillDoc(reportKey)
    }

    // For dropdown/combobox targets, also catch the option selection — opening
    // the menu is ignored by the side panel, but picking a value advances.
    var roleAttr = (el.getAttribute && el.getAttribute('role')) || ''
    if (tag === 'MAT-SELECT' || tag === 'SELECT' || roleAttr === 'combobox') {
      watchOptionSelect(reportKey)
    }
  }

  // Async (done-callback) so a failed resolve can try the reveal path — reopen
  // the transient panel the target lives in, wait for it to render, re-resolve.
  function highlight(intent, opts, done) {
    if (typeof intent === 'string') intent = { selector: intent }
    var el = resolveTarget(intent)
    if (el) {
      // Report progress under the original selector so the side panel's
      // `selector === step.selector` check still matches. Pass the intent so the
      // reposition loop can re-resolve if the element gets re-rendered.
      renderHighlight(el, intent.selector || intent.name || '', opts, intent)
      done({ ok: true })
      return
    }
    revealAndResolve(intent, function (fresh) {
      if (!fresh) {
        done({ ok: false, error: 'not-found' })
        return
      }
      renderHighlight(fresh, intent.selector || intent.name || '', opts, intent)
      done({ ok: true })
    })
  }

  // "Lost" mode — no target element; Baymax floats at the right edge offering
  // to take the user back to the page the current step needs.
  function showLost(opts) {
    opts = opts || {}
    // Only the top frame shows the lost mascot, so it doesn't stack up once
    // per iframe (there's no target element to scope it to a frame).
    if (window !== window.top) return { ok: false, error: 'not-top-frame' }

    clearOverlay()
    var mascot = buildMascot({
      title: opts.title || 'Hmm, wrong page?',
      message:
        opts.message ||
        "This doesn't look like the page we need. Click me and I'll take you back!",
      lost: true,
      // 'lost' droops; the side panel passes 'confused' instead when the page is
      // right and it was the ELEMENT it could not find.
      mood: opts.mood === 'confused' ? 'confused' : 'lost',
    })
    var width = mascot.offsetWidth || 250
    mascot.style.left = window.innerWidth - width - 24 + 'px'
    mascot.style.top = Math.max(window.innerHeight * 0.28, 8) + 'px'
    return { ok: true }
  }

  // Angular Material wraps checkboxes/radios in a custom <mat-checkbox> /
  // <mat-radio-button> host whose .click() does NOT toggle the control — only
  // its inner native <input> (or its <label>) does. So "Do it for me" would
  // highlight and "click" the host but never tick/untick it. Drill to the real
  // toggle target; plain elements (buttons, links, native inputs) click
  // themselves.
  function clickTarget(el) {
    if (!el) return el
    var tag = (el.tagName || '').toLowerCase()
    if (tag === 'mat-checkbox' || tag === 'mat-radio-button') {
      return el.querySelector('input') || el.querySelector('label') || el
    }
    return el
  }

  // Async: `done(result)` is called AFTER the (delayed) click actually fires,
  // so an ok response genuinely means "clicked" — the side panel keys its
  // advance timing off it.
  function click(intent, done) {
    if (typeof intent === 'string') intent = { selector: intent }
    var el = resolveTarget(intent)
    if (!el) {
      // Target missing — maybe it lives in a transient panel that closed when
      // the side panel took focus, or behind a control the console collapsed
      // because the window is narrow. Reveal it, wait, and re-resolve.
      revealAndResolve(intent, function (fresh) {
        if (!fresh) {
          done({ ok: false, error: 'not-found' })
          return
        }
        proceed(fresh)
      })
      return
    }
    proceed(el)

    function proceed(el) {
      // Pass the intent so the reposition loop keeps re-resolving during the
      // pause below — if the framework swaps the node out, highlightTarget is
      // re-anchored onto the fresh one.
      renderHighlight(el, intent.selector || intent.name || '', null, intent)
      setTimeout(function () {
        // Programmatic click — stop watching first so the side panel doesn't
        // also get a BAYMAX_GUIDE_CLICKED and advance twice.
        unwatchElement()
        // The console re-renders constantly (search results, the create form),
        // so the node resolved 600ms ago may be detached by now — and a detached
        // node swallows .click() silently. Prefer the reposition loop's
        // re-anchored target, else re-resolve from scratch.
        var target = el
        if (!target.isConnected) {
          target =
            highlightTarget && highlightTarget.isConnected
              ? highlightTarget
              : resolveTarget(intent)
        }
        clearOverlay()
        if (!target) {
          done({ ok: false, error: 'not-found' })
          return
        }
        // Respond BEFORE dispatching the click (same tick, so the panel's timing
        // is unaffected): if the click navigates this frame, the message channel
        // dies with it, the reply would be lost, and sendGuideCommand would fall
        // through and retry the click in the next frame — on a look-alike.
        done({ ok: true })
        // Highlight showed the host (the whole checkbox); click the inner control.
        clickTarget(target).click()
      }, 600)
    }
  }

  // Async (done-callback) like click(): a fill target goes missing for the same
  // reasons a click target does — most often the console collapsing its search
  // bar into an icon on a narrow window — so it gets the same reveal path
  // instead of failing on the spot.
  function fill(intent, value, done) {
    if (typeof intent === 'string') intent = { selector: intent }
    var el = resolveTarget(intent)
    if (el) {
      proceed(el)
      return
    }
    revealAndResolve(intent, function (fresh) {
      if (!fresh) {
        done({ ok: false, error: 'not-found' })
        return
      }
      proceed(fresh)
    })

    function proceed(el) {
      renderHighlight(el, intent.selector || intent.name || '')
      // Programmatic fill — stop watching so the dispatched input event doesn't
      // also report BAYMAX_GUIDE_FILLED and advance twice.
      unwatchFill()
      el.focus()
      var proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
      var desc = Object.getOwnPropertyDescriptor(proto, 'value')
      if (desc && desc.set) desc.set.call(el, value || '')
      else el.value = value || ''
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
      done({ ok: true })
    }
  }

  // Build a resolver intent from a guide message. Steps carry a CSS `selector`
  // (legacy / fallback) plus optional semantic fields the resolver prefers.
  function intentFromMsg(msg) {
    return {
      selector: msg.selector,
      extraSelector: msg.extraSelector,
      role: msg.role,
      name: msg.name,
      text: msg.text,
      href: msg.href,
      avoidHref: msg.avoidHref,
      avoidText: msg.avoidText,
      exactName: msg.exactName,
      requireSelector: msg.requireSelector,
      revealSelector: msg.revealSelector,
      revealValue: msg.revealValue,
    }
  }

  // ── Page snapshot (self-heal) ───────────────────────────────────────────
  // Returns a compact list of the page's VISIBLE interactive elements, each
  // described the way resolveTarget reads them (role + accessible name + text +
  // href) plus a real, live CSS selector. This is the "sanitize-and-snapshot"
  // step: instead of serialising the whole DOM (huge, and full of selectors the
  // model could only guess at), we send the model the elements that actually
  // exist so any selector it returns is grounded. Used only when a step fails to
  // resolve, to ask the backend which element the step now maps to.
  var SNAPSHOT_MAX = 80
  var SNAPSHOT_INTERACTIVE =
    'a,button,input,textarea,select,mat-select,summary,label,' +
    '[role="button"],[role="link"],[role="option"],[role="combobox"],' +
    '[role="menuitem"],[role="tab"],[role="radio"],[role="checkbox"],' +
    'mat-radio-button,mat-checkbox,mat-option,[tabindex]'

  function collectSnapshot() {
    var nodes
    try {
      nodes = document.querySelectorAll(SNAPSHOT_INTERACTIVE)
    } catch {
      return []
    }
    var out = []
    var seen = {}
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i]
      if (isOwnUi(el) || !isVisible(el)) continue
      var name = norm(accessibleName(el))
      var text = norm(el.textContent || '').slice(0, 80)
      var href = (el.getAttribute && el.getAttribute('href')) || ''
      // Nothing to identify it by — skip so we don't spend tokens on noise.
      if (!name && !text && !href) continue
      var sel = cssPath(el)
      if (!sel || seen[sel]) continue
      seen[sel] = true
      out.push({
        role: elementRole(el),
        name: name,
        text: text,
        href: href,
        selector: sel,
        inView: inViewport(el),
      })
    }
    // When capping, keep what the user can actually see first.
    out.sort(function (a, b) {
      return (b.inView ? 1 : 0) - (a.inView ? 1 : 0)
    })
    return out.slice(0, SNAPSHOT_MAX).map(function (e) {
      return { role: e.role, name: e.name, text: e.text, href: e.href, selector: e.selector }
    })
  }

  // ── Page context (page-aware chat) ──────────────────────────────────────
  // A LIGHT text summary of what's on screen — the page title plus its visible
  // headings and the selected tab label — so the chat model knows which Console
  // page the user is asking about ("what does this graph mean"). Deliberately
  // cheaper and more targeted than collectSnapshot: no interactive controls, no
  // selectors, just the words that name the sections of the page. The screenshot
  // (captured separately in the side panel) carries the visual detail; this is
  // the fallback grounding when the capture fails and the token-cheap hint that
  // steers the model to the right page even when it succeeds.
  var PAGE_CONTEXT_MAX = 25
  var PAGE_HEADING_SELECTOR =
    'h1,h2,h3,h4,[role="heading"],[role="tab"][aria-selected="true"]'

  function collectPageContext() {
    var headings = []
    var seen = {}
    var nodes
    try {
      nodes = document.querySelectorAll(PAGE_HEADING_SELECTOR)
    } catch {
      nodes = []
    }
    for (var i = 0; i < nodes.length && headings.length < PAGE_CONTEXT_MAX; i++) {
      var el = nodes[i]
      if (isOwnUi(el) || !isVisible(el)) continue
      var text = norm(el.textContent || '').slice(0, 120)
      if (!text) continue
      var key = text.toLowerCase()
      if (seen[key]) continue
      seen[key] = true
      headings.push(text)
    }
    return {
      ok: true,
      url: location.href,
      title: norm(document.title || '').slice(0, 200),
      top: window === window.top,
      headings: headings,
    }
  }

  // ── Recording mode ─────────────────────────────────────────────────────
  // When recording, every click/typing on the page (outside our own UI) is
  // fingerprinted and streamed to the side panel as BAYMAX_RECORD_ACTION. The
  // side panel collects these into a draft guide the user reviews and exports.
  var recording = false
  var recordClickListener = null
  var recordInputListener = null
  var recordInputTimer = null

  function isOwnUi(node) {
    return shadowRoot && shadowRoot.host && shadowRoot.host.contains(node)
  }

  // A <label> just toggles its control, so recording the bare label captures no
  // stable role (and an awkward selector). Redirect to the control it labels —
  // preferring the Material wrapper (mat-checkbox/mat-radio-button) over the
  // visually-hidden native <input> — so we fingerprint a real checkbox/radio
  // with its accessible name (e.g. "Prevent instance deletion").
  function recordTarget(el) {
    if (!el || (el.tagName || '').toLowerCase() !== 'label') return el
    var control = null
    var forId = el.getAttribute('for')
    if (forId) {
      try {
        control = document.getElementById(forId)
      } catch {
        control = null
      }
    }
    if (!control) {
      control = el.querySelector(
        'input,mat-checkbox,mat-radio-button,[role="checkbox"],[role="radio"],[role="switch"]',
      )
    }
    if (control && control.closest) {
      var wrap = control.closest('mat-checkbox,mat-radio-button')
      if (wrap) control = wrap
    }
    return control || el
  }

  // Where the element sits in the TAB's viewport, not just this frame's: the
  // console renders pages in a same-origin iframe, so a frame-local rect would
  // put the PDF marker in the wrong place on a full-tab screenshot. Walk up the
  // frameElement chain adding each iframe's offset. CSS px, top-left origin;
  // the capture itself is scaled by devicePixelRatio, so ship that too.
  function absoluteViewportRect(el) {
    var r = el.getBoundingClientRect()
    var x = r.left
    var y = r.top
    try {
      var w = window
      while (w !== w.top && w.frameElement) {
        var fr = w.frameElement.getBoundingClientRect()
        x += fr.left
        y += fr.top
        w = w.parent
      }
    } catch (err) {
      /* cross-origin ancestor — keep frame-local coords, best effort */
    }
    var dpr = window.devicePixelRatio || 1
    try {
      dpr = (window.top && window.top.devicePixelRatio) || dpr
    } catch (err) {
      /* cross-origin top — local dpr is the same in practice */
    }
    return { x: x, y: y, width: r.width, height: r.height, dpr: dpr }
  }

  function startRecording() {
    if (recording) return { ok: true }
    recording = true

    recordClickListener = function (e) {
      if (isOwnUi(e.target)) return
      var el =
        (e.target.closest &&
          e.target.closest(
            'a,button,input,textarea,select,mat-select,mat-checkbox,mat-radio-button,summary,label,' +
            '[role="button"],[role="link"],[role="option"],[role="tab"],[role="menuitem"],' +
            '[role="checkbox"],[role="radio"],[role="switch"]',
          )) ||
        e.target
      el = recordTarget(el)
      if (!el) return
      send({
        type: 'BAYMAX_RECORD_ACTION',
        recordAction: 'click',
        fingerprint: fingerprintElement(el),
        rect: absoluteViewportRect(el),
        url: location.href,
      })
    }

    recordInputListener = function (e) {
      if (isOwnUi(e.target)) return
      var el = e.target
      if (!el || !('value' in el)) return
      // Checkboxes and radios are toggled by clicking, not by filling a value.
      var inputType = (el.getAttribute && el.getAttribute('type') || '').toLowerCase()
      if (inputType === 'checkbox' || inputType === 'radio') return
      if (recordInputTimer) clearTimeout(recordInputTimer)
      recordInputTimer = setTimeout(function () {
        var value = (el.value || '').trim()
        if (!value) return
        send({
          type: 'BAYMAX_RECORD_ACTION',
          recordAction: 'fill',
          fingerprint: fingerprintElement(el),
          rect: absoluteViewportRect(el),
          // The raw value is sent so the review screen can offer it as a
          // default, but it's flagged as a parameter so secrets (passwords,
          // project ids) aren't baked into a shared guide.
          value: value,
          isParameter: true,
          url: location.href,
        })
      }, 900)
    }

    document.addEventListener('click', recordClickListener, true)
    document.addEventListener('input', recordInputListener, true)
    return { ok: true }
  }

  function stopRecording() {
    recording = false
    if (recordClickListener) document.removeEventListener('click', recordClickListener, true)
    if (recordInputListener) document.removeEventListener('input', recordInputListener, true)
    if (recordInputTimer) clearTimeout(recordInputTimer)
    recordClickListener = null
    recordInputListener = null
    recordInputTimer = null
    return { ok: true }
  }

  // Whether THIS page is rendering in English — the one PrereqGate check
  // that genuinely needs the page's DOM (document.lang reflects Google's
  // actual rendered language more reliably than the `hl` URL param, which is
  // usually absent). consoleOpen/projectId are derived by the caller
  // (checkEnvironment() in src/lib/guide.js) straight from the tab's own
  // URL — no round trip needed for those.
  function checkEnv() {
    var htmlLang = (document.documentElement.lang || '').toLowerCase()
    var hl = ''
    try {
      hl = (new URL(location.href).searchParams.get('hl') || '').toLowerCase()
    } catch {
      /* malformed URL — fall back to htmlLang only */
    }
    var languageEnglish = htmlLang.indexOf('en') === 0 || hl.indexOf('en') === 0
    return { ok: true, languageEnglish: languageEnglish }
  }

  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (!msg || msg.type !== 'BAYMAX_GUIDE') return

    var result
    if (msg.action === 'clear') {
      clearOverlay()
      result = { ok: true }
    } else if (msg.action === 'highlight') {
      // highlight() responds asynchronously (it may reveal a closed panel and
      // retry) — `return true` keeps the message channel open.
      highlight(
        intentFromMsg(msg),
        {
          title: msg.title,
          message: msg.message,
          stepAction: msg.stepAction,
          matchValue: msg.matchValue,
          stepNumber: msg.stepNumber,
          totalSteps: msg.totalSteps,
          cheer: msg.cheer,
        },
        function (res) {
          console.log('[Baymax] guide action', msg.action, msg.selector, '->', res)
          try {
            sendResponse(res)
          } catch {
            /* frame navigated away before the response could be sent */
          }
        },
      )
      return true
    } else if (msg.action === 'lost') {
      result = showLost({ title: msg.title, message: msg.message, mood: msg.mood })
    } else if (msg.action === 'click') {
      // click() responds asynchronously — after the delayed click has actually
      // been performed — so `return true` keeps the message channel open.
      click(intentFromMsg(msg), function (res) {
        console.log('[Baymax] guide action', msg.action, msg.selector, '->', res)
        try {
          sendResponse(res)
        } catch {
          /* frame navigated away before the response could be sent */
        }
      })
      return true
    } else if (msg.action === 'fill') {
      // fill() responds asynchronously (it may reveal a collapsed control and
      // re-resolve) — `return true` keeps the message channel open.
      fill(intentFromMsg(msg), msg.value, function (res) {
        console.log('[Baymax] guide action', msg.action, msg.selector, '->', res)
        try {
          sendResponse(res)
        } catch {
          /* frame navigated away before the response could be sent */
        }
      })
      return true
    } else if (msg.action === 'record-start') {
      result = startRecording()
    } else if (msg.action === 'record-stop') {
      result = stopRecording()
    } else if (msg.action === 'snapshot') {
      result = {
        ok: true,
        url: location.href,
        top: window === window.top,
        elements: collectSnapshot(),
      }
    } else if (msg.action === 'page-context') {
      result = collectPageContext()
    } else if (msg.action === 'check-env') {
      result = checkEnv()
    } else {
      return
    }

    console.log('[Baymax] guide action', msg.action, msg.selector, '->', result)
    sendResponse(result)
  })
})()
