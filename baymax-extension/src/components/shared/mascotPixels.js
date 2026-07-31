// mascotPixels.js — the shared pixel geometry for the Baymax sprite mascots
// (ThinkMascot, IdleMascot, WorkMascot, HackMascot, SuccessMascot, ErrorMascot).
// This module is NOT a component: it holds the pixel helpers, the precomputed
// part cell-maps (PARTS), and the SVG group builders each state component
// composes into its own <svg>. Coordinates live in a 26-wide viewBox
// ("0 -7 26 30"); every mascot uses the same body. The negative rows above the
// head are where the "?", the alarm bangs and the rising code bits sit.
//
// The figure is drawn as Baymax proper: a small round head, a pinched neck, a
// pear-shaped torso, and the two-dot-and-a-bar face in ink on white. Because he
// is white and the side panel's light theme is white too, every state also
// wraps the figure in inkFilter() — see the note there.

/* ---------- pixel helpers ---------- */
function mergeRuns(cells) {
  const rows = {}
  cells.forEach((c) => {
    ;(rows[c[1]] = rows[c[1]] || []).push(c[0])
  })
  const rects = []
  Object.keys(rows).forEach((y) => {
    const xs = rows[y].sort((a, b) => a - b)
    let start = xs[0]
    let prev = xs[0]
    for (let i = 1; i <= xs.length; i++) {
      const x = xs[i]
      if (x !== prev + 1) {
        rects.push({ x: start, y: +y, w: prev - start + 1 })
        start = x
      }
      prev = x
    }
  })
  return rects
}

export function rectCells(x0, y0, x1, y1) {
  const a = []
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) a.push([x, y])
  return a
}

// parse a string pixel map ('#' = filled) at an offset
export function mapCells(rows, ox, oy) {
  const a = []
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      if (row[i] === '#') a.push([ox + i, oy + j])
    }
  })
  return a
}

// A pixelated ellipse. Separate radii above and below the centre line let one
// shape be a pear (narrow shoulders, heavy belly) instead of a symmetric egg.
function ovalCells(cx, cy, rx, ryTop, ryBot, y0, y1) {
  const a = []
  for (let y = y0; y <= y1; y++) {
    const yc = y + 0.5
    const dy = (yc - cy) / (yc < cy ? ryTop : ryBot)
    if (dy < -1 || dy > 1) continue
    const span = rx * Math.sqrt(1 - dy * dy)
    for (let x = 0; x <= 25; x++) {
      if (Math.abs(x + 0.5 - cx) <= span) a.push([x, y])
    }
  }
  return a
}

// flip a cell list across the sprite's vertical centre line
const mirrorX = (cells) => cells.map((c) => [25 - c[0], c[1]])

// an <g> of merged 1-tall rect runs (1.02 tall to hide seams between rows)
export function svgGroup(id, cells, fill, cls) {
  const open = '<g id="' + id + '"' + (cls ? ' class="' + cls + '"' : '') + '>'
  return (
    open +
    mergeRuns(cells)
      .map((r) => '<rect x="' + r.x + '" y="' + r.y + '" width="' + r.w + '" height="1.02" fill="' + fill + '"/>')
      .join('') +
    '</g>'
  )
}

// the ground shadow group (crisp 1px, its own colour token)
export function shadowGroup(id, cells) {
  return (
    '<g id="' + id + '" opacity=".22">' +
    mergeRuns(cells)
      .map((r) => '<rect x="' + r.x + '" y="' + r.y + '" width="' + r.w + '" height="1" fill="var(--m-shadow)"/>')
      .join('') +
    '</g>'
  )
}

// A crisp one-cell ink rim around whatever it is applied to. Baymax is white,
// and so is the side panel in light theme — without this he vanishes into the
// background and leaves a face floating in space. feMorphology dilates the
// alpha channel and floods the result, so the rim is recomputed every frame and
// follows the bob, the backflip and the faceplant for free.
//
// Apply per component with a unique id (ids are document-global), and colour it
// from CSS: `.idle-mascot .m-ink{ flood-color: var(--m-outline); }`.
//
// The 'out' step cuts the figure back out of the dilated alpha so the rim exists
// ONLY outside the silhouette. Skip it and the rim sits under the whole figure,
// showing through anywhere the interior is not perfectly opaque — which is every
// rect seam as soon as antialiasing creeps in. The components pair this with
// `shape-rendering: crispEdges`; both are needed, and dropping either brings the
// seams back.
export function inkFilter(id) {
  return (
    '<defs><filter id="' + id + '" x="-30%" y="-30%" width="160%" height="160%">' +
    '<feMorphology operator="dilate" radius="0.7" in="SourceAlpha" result="fat"/>' +
    '<feComposite in="fat" in2="SourceAlpha" operator="out" result="ring"/>' +
    '<feFlood class="m-ink" result="ink"/>' +
    '<feComposite in="ink" in2="ring" operator="in" result="rim"/>' +
    '<feMerge><feMergeNode in="rim"/><feMergeNode in="SourceGraphic"/></feMerge>' +
    '</filter></defs>'
  )
}

// success sparkles: plus shapes
export function plus(ox, oy) {
  return [
    [ox + 1, oy],
    [ox, oy + 1],
    [ox + 1, oy + 1],
    [ox + 2, oy + 1],
    [ox + 1, oy + 2],
  ]
}

// error eyes: two 3×3 X shapes
function xShape(ox, oy) {
  return [
    [ox, oy],
    [ox + 2, oy],
    [ox + 1, oy + 1],
    [ox, oy + 2],
    [ox + 2, oy + 2],
  ]
}

/* ---------- the mascot pixel map ---------- */

// A small round head of its own, not the top of one big blob.
const head = ovalCells(13, 4.5, 5.2, 3.6, 3.6, 1, 7)

// Four cells wide, between a 6-wide head base and an 8-wide shoulder. This
// pinch is most of what makes the silhouette read as Baymax rather than a blob.
const neck = rectCells(11, 8, 14, 8)

// A pear, not an egg: an 8-cell shoulder swelling to a 16-cell belly, then
// rounding back in. The taller upper radius puts the widest point below centre.
const torso = ovalCells(13, 14.4, 8.0, 5.6, 4.8, 9, 18)

// Soft tubes, not claws. Each arm is TWO parts, and the split is load-bearing.
//
// These arms are attached to the body, unlike the old detached claw prongs, so
// the shoulder rows run ~3 cells INTO the torso to weld them on. That overlap
// is invisible at rest — same white, and it never widens the silhouette.
//
// But the shoulder must never be transformed. The arm slants outward as it
// descends, so its outer edge is only correct against its own torso row; lift
// the whole arm and those shoulder cells slide up past the torso's narrower
// rows and stick out as a blocky nub with an ink rim around it. So the welded
// shoulder stays put and only the free-hanging forearm animates. It overlaps
// the shoulder's bottom row far enough that the arm still never tears off —
// verified against the idle bob (-1px), the think/cheer pose (-2px) and the
// knuckle crack (-3px).
const shoulderL = [
  [6, 10], [7, 10], [8, 10], [9, 10],
  [4, 11], [5, 11], [6, 11], [7, 11], [8, 11],
  [3, 12], [4, 12], [5, 12], [6, 12], [7, 12],
  [2, 13], [3, 13],
]

// the free-hanging forearm + rounded mitten — the part states animate
const armL = [
  [1, 14], [2, 14], [3, 14],
  [1, 15], [2, 15], [3, 15],
  [1, 16], [2, 16], [3, 16],
  [1, 17], [2, 17], [3, 17],
  [2, 18], [3, 18],
]

export const PARTS = {
  body: head.concat(neck, torso),

  // one cell of cool grey along the torso's underside — the cue that sells
  // inflated vinyl instead of flat paper
  shade: rectCells(6, 16, 7, 16).concat(
    rectCells(18, 16, 19, 16),
    rectCells(7, 17, 8, 17),
    rectCells(17, 17, 18, 17),
    rectCells(9, 18, 16, 18)
  ),

  // the face: two ink dots joined by a bar, dark on white
  eyes: rectCells(9, 3, 10, 5).concat(rectCells(15, 3, 16, 5), rectCells(11, 4, 14, 4)),

  // error eyes: two 3×3 X shapes, same footprint as the dots
  xeyes: xShape(9, 3).concat(xShape(14, 3)),

  shoulderL,
  shoulderR: mirrorX(shoulderL),
  armL,
  armR: mirrorX(armL),

  // feet — split so they can march
  legL: rectCells(9, 19, 11, 20),
  legR: rectCells(14, 19, 16, 20),

  // thinking: dot trail + giant question mark + sweat drop
  dot1: [[16, 1]],
  dot2: [[18, -1]],
  qmark: mapCells(['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'], 17, -6),
  sweat: [
    [7, 2],
    [7, 3],
  ],

  // laptop held at belly height: lid panel + a mini copy of his own face as the
  // logo + base + typing hands
  lidPanel: rectCells(8, 12, 17, 17),
  logo: [
    [11, 14],
    [11, 15],
    [14, 14],
    [14, 15],
    [12, 14],
    [13, 14],
  ],
  lapBase: rectCells(7, 18, 18, 18),
  handL: rectCells(5, 17, 6, 17),
  handR: rectCells(19, 17, 20, 17),

  // working/hacking: code bits ejected up past the head
  cbit1: [
    [8, 0],
    [9, 0],
  ],
  cbit2: [[13, -1]],
  cbit3: [
    [17, 0],
    [17, -1],
    [18, -1],
  ],

  // error: giant flashing exclamation marks
  bangL: rectCells(2, -3, 3, 0).concat(rectCells(2, 2, 3, 2)),
  bangR: rectCells(22, -3, 23, 0).concat(rectCells(22, 2, 23, 2)),

  // ground shadow
  shadow: rectCells(8, 21, 17, 21),
}

// success confetti: 26 pixel flecks in brand colours, randomized drift/delay.
// Rendered as <rect> children of the confetti group; the component's CSS drives
// them with the shared cfall keyframe (each rect overrides duration/delay/--dx).
const CONF_COLORS = [
  'hsl(178 64% 45%)',
  'hsl(217 91% 64%)',
  'hsl(35 92% 55%)',
  'hsl(158 64% 45%)',
  'hsl(0 78% 62%)',
  'hsl(271 91% 70%)',
]
export function buildConfetti() {
  let out = ''
  for (let i = 0; i < 26; i++) {
    const cx = Math.floor(Math.random() * 26)
    const ch = Math.random() < 0.4 ? 2 : 1
    const col = CONF_COLORS[i % CONF_COLORS.length]
    const dxv = Math.floor(Math.random() * 13) - 6 + 'px'
    const dur = (1.3 + Math.random() * 0.9).toFixed(2) + 's'
    const del = (Math.random() * 1.5).toFixed(2) + 's'
    out +=
      '<rect x="' + cx + '" y="-7" width="1" height="' + ch + '" fill="' + col +
      '" style="--dx:' + dxv + '; animation-duration:' + dur + '; animation-delay:' + del + '"/>'
  }
  return out
}
