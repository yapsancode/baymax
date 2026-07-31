import { useEffect, useRef } from 'react'

/**
 * WanderMascot.jsx — the pixel Baymax "wander" animation, ported from the
 * State Lab. One inline-SVG pixel robot on a 20-second odyssey: patrols far
 * right, marches back, takes a think break, wanders left — then a bird flies
 * past and it gives chase across the whole stage. The bird always gets away.
 *
 *   import WanderMascot from '../components/WanderMascot'
 *   <WanderMascot size={180} />
 *
 * Self-contained: transparent background, styles inject once, no deps. Every
 * motion is a CSS steps() keyframe so it snaps cell-by-cell like a real sprite.
 */

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
function grp(id, cells, fill, cls) {
  const open = '<g id="' + id + '"' + (cls ? ' class="' + cls + '"' : '') + '>'
  return (
    open +
    mergeRuns(cells)
      .map((r) => '<rect x="' + r.x + '" y="' + r.y + '" width="' + r.w + '" height="1.02" fill="' + fill + '"/>')
      .join('') +
    '</g>'
  )
}
function rectCells(x0, y0, x1, y1) {
  const a = []
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) a.push([x, y])
  return a
}
function mapCells(rows, ox, oy) {
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
const mirrorX = (cells) => cells.map((c) => [25 - c[0], c[1]])

/* ---------- the mascot pixel map (wander parts only) ----------
   Kept in step with the extension's mascotPixels.js by hand — marketing is a
   separate build, so the two units share no code. Change one, change the other. */
function buildMascotSVG() {
  // a small round head of its own, not the top of one big blob
  const head = ovalCells(13, 4.5, 5.2, 3.6, 3.6, 1, 7)
  // the pinch between a 6-wide head base and an 8-wide shoulder — most of what
  // makes the silhouette read as Baymax
  const neck = rectCells(11, 8, 14, 8)
  // a pear, not an egg: an 8-cell shoulder swelling to a 16-cell belly
  const torso = ovalCells(13, 14.4, 8.0, 5.6, 4.8, 9, 18)
  const body = head.concat(neck, torso)

  // one cell of cool grey along the underside — the inflated-vinyl cue
  const shade = rectCells(6, 16, 7, 16).concat(
    rectCells(18, 16, 19, 16),
    rectCells(7, 17, 8, 17),
    rectCells(17, 17, 18, 17),
    rectCells(9, 18, 16, 18)
  )

  // the face: two ink dots joined by a bar, dark on white
  const eyes = rectCells(9, 3, 10, 5).concat(rectCells(15, 3, 16, 5), rectCells(11, 4, 14, 4))

  // Arms are TWO parts. The shoulder rows run into the torso to weld the arm
  // on, and must never be transformed: the arm slants outward as it descends,
  // so lifting the whole thing slides those cells past the torso's narrower
  // rows above and leaves a blocky nub sticking out. The walk bob animates only
  // the free-hanging forearm, which overlaps the shoulder enough never to tear.
  const shoulderL = [
    [6, 10], [7, 10], [8, 10], [9, 10],
    [4, 11], [5, 11], [6, 11], [7, 11], [8, 11],
    [3, 12], [4, 12], [5, 12], [6, 12], [7, 12],
    [2, 13], [3, 13],
  ]
  const armL = [
    [1, 14], [2, 14], [3, 14],
    [1, 15], [2, 15], [3, 15],
    [1, 16], [2, 16], [3, 16],
    [1, 17], [2, 17], [3, 17],
    [2, 18], [3, 18],
  ]
  const shoulderR = mirrorX(shoulderL)
  const armR = mirrorX(armL)

  // feet — split so they can march
  const legL = rectCells(9, 19, 11, 20)
  const legR = rectCells(14, 19, 16, 20)

  // think-break dot trail
  const dot1 = [[16, 1]]
  const dot2 = [[18, -1]]

  // "!" above the head at bird-spotting (positioned via walert keyframes)
  const alert = rectCells(12, -5, 13, -2).concat(rectCells(12, 0, 13, 0))

  // the bird — two wing frames, flapped by opacity toggle
  const birdU = mapCells(['#...#', '.#.#.', '..#..'], 1, 0)
  const birdD = mapCells(['..#..', '.#.#.', '#...#'], 1, 0)

  // ground shadow
  const shadow = rectCells(8, 21, 17, 21)

  // A crisp one-cell ink rim. Baymax is white, so without it he dissolves into
  // any light background; feMorphology recomputes the rim every frame, so it
  // follows the march, the chase and the faceplant for free.
  // The 'out' step cuts the figure back out of the dilated alpha so the rim
  // exists ONLY outside the silhouette. Without it the rim sits under the whole
  // figure and shows through anywhere the interior is not perfectly opaque —
  // every rect seam, as soon as antialiasing creeps in. Pairs with the svg's
  // `shape-rendering: crispEdges`; both are needed.
  const ink =
    '<defs><filter id="wm-ink" x="-30%" y="-30%" width="160%" height="160%">' +
    '<feMorphology operator="dilate" radius="0.7" in="SourceAlpha" result="fat"/>' +
    '<feComposite in="fat" in2="SourceAlpha" operator="out" result="ring"/>' +
    '<feFlood class="m-ink" result="inkc"/>' +
    '<feComposite in="inkc" in2="ring" operator="in" result="rim"/>' +
    '<feMerge><feMergeNode in="rim"/><feMergeNode in="SourceGraphic"/></feMerge>' +
    '</filter></defs>'

  return (
    ink +
    '<g id="wm-shadow" opacity=".22">' +
    mergeRuns(shadow)
      .map((r) => '<rect x="' + r.x + '" y="' + r.y + '" width="' + r.w + '" height="1" fill="var(--m-shadow)"/>')
      .join('') +
    '</g>' +
    '<g id="wm-mascot">' +
    '<g id="wm-gait">' +
    grp('wm-body', body, 'var(--m-body)') +
    grp('wm-shade', shade, 'var(--m-shade)') +
    grp('wm-eyes', eyes, 'var(--m-face)') +
    grp('wm-shoulderL', shoulderL, 'var(--m-body)') +
    grp('wm-shoulderR', shoulderR, 'var(--m-body)') +
    grp('wm-armL', armL, 'var(--m-body)') +
    grp('wm-armR', armR, 'var(--m-body)') +
    '</g>' +
    grp('wm-legL', legL, 'var(--m-body)') +
    grp('wm-legR', legR, 'var(--m-body)') +
    '</g>' +
    '<g id="wm-dots">' +
    grp('wm-dot1', dot1, 'var(--m-body)', 'wm-dot') +
    grp('wm-dot2', dot2, 'var(--m-body)', 'wm-dot') +
    '</g>' +
    grp('wm-alert', alert, 'var(--m-body)') +
    '<g id="wm-bird">' +
    grp('wm-wingU', birdU, 'var(--m-bird)') +
    grp('wm-wingD', birdD, 'var(--m-bird)') +
    '</g>'
  )
}

const CSS = `
.wander-mascot{
  --m-body: hsl(0 0% 100%);
  --m-shade: hsl(190 16% 88%);
  --m-face: #00403e;
  --m-outline: hsl(190 30% 20% / .55);
  --m-shadow: hsl(180 60% 6%);
  --m-bird: hsl(35 92% 60%);
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.wander-mascot-svg{
  width: auto;
  shape-rendering: crispEdges;
  overflow: visible;
}
.wander-mascot .m-ink{ flood-color: var(--m-outline); }
.wander-mascot #wm-mascot{
  transform-box: fill-box;
  transform-origin: 50% 100%;
  filter: url(#wm-ink);
}
.wander-mascot #wm-gait{ transform-box: fill-box; transform-origin: 50% 100%; }
/* the thought dots and the "!" are white too — same rim, same reason */
.wander-mascot #wm-dots, .wander-mascot #wm-alert{ filter: url(#wm-ink); }
.wander-mascot #wm-dots, .wander-mascot #wm-alert, .wander-mascot #wm-bird{ display: none; }

.wander-mascot #wm-eyes{
  animation: wm-blink 4.4s steps(1,end) infinite,
             wm-lookaround 7s steps(1,end) infinite;
}
@keyframes wm-blink{ 0%, 91%, 97%, 100%{ opacity:1; } 92%, 96%{ opacity:0; } }
@keyframes wm-lookaround{
  0%, 55%, 100%{ transform: translateX(0); }
  60%, 70%{ transform: translateX(-1px); }
  76%, 88%{ transform: translateX(1px); }
}

/* ---------- wander: the 20s odyssey ----------
   0-14%  march far right, hop, look around
   18-30% march back to the middle
   30-42% think break: stops, tilts, thought dots
   42-56% wander far left
   61%    a BIRD flies in — "!" shock hop
   63-78% full-tilt chase across the whole stage, leaning into the run
   78-81% trips at the finish line — faceplants forward as the bird escapes
   81-88% flat on the ground, dazed
   88-92% pushes back up onto its feet
   92-100% dejected trudge home */
.wander-mascot #wm-mascot{ animation: wm-patrol 20s steps(1,end) infinite; }
.wander-mascot #wm-shadow{ animation: wm-shpatrol 20s steps(1,end) infinite; }
.wander-mascot #wm-gait{ animation: wm-waddle .5s steps(1,end) infinite; }
.wander-mascot #wm-legL{ animation: wm-legstep .3s steps(1,end) infinite; }
.wander-mascot #wm-legR{ animation: wm-legstep .3s steps(1,end) infinite; animation-delay: -.15s; }
.wander-mascot #wm-armL{ animation: wm-armbob .5s steps(1,end) infinite; }
.wander-mascot #wm-armR{ animation: wm-armbob .5s steps(1,end) infinite; animation-delay: -.25s; }
.wander-mascot #wm-dots{ display: block; animation: wm-wdots 20s steps(1,end) infinite; }
.wander-mascot .wm-dot{ opacity: 0; animation: wm-dotcycle 1.8s steps(1,end) infinite; }
.wander-mascot #wm-dot2{ animation-delay: .3s; }
.wander-mascot #wm-alert{ display: block; animation: wm-walert 20s steps(1,end) infinite; }
.wander-mascot #wm-bird{ display: block; animation: wm-birdfly 20s steps(1,end) infinite; }
.wander-mascot #wm-wingU{ animation: wm-flap .22s steps(1,end) infinite; }
.wander-mascot #wm-wingD{ animation: wm-flap .22s steps(1,end) infinite; animation-delay: -.11s; }
@keyframes wm-armbob{ 0%,100%{ transform: translateY(0); } 50%{ transform: translateY(-1px); } }
@keyframes wm-patrol{
  0%   { transform: translateX(0); animation-timing-function: steps(11,end); }
  14%  { transform: translateX(13px); }
  16%  { transform: translate(13px,-2px); }
  17%  { transform: translate(13px,0); }
  18%  { transform: translateX(13px); animation-timing-function: steps(11,end); }
  30%  { transform: translateX(0) rotate(0deg); }
  33%  { transform: translateX(0) rotate(-4deg); }
  36%  { transform: translateX(0) rotate(4deg); }
  39%  { transform: translateX(0) rotate(-4deg); }
  42%  { transform: translateX(0) rotate(0deg); animation-timing-function: steps(11,end); }
  56%  { transform: translateX(-13px); }
  60%  { transform: translateX(-13px); }
  61%  { transform: translate(-13px,-3px); }
  63%  { transform: translate(-13px,0) rotate(8deg); animation-timing-function: steps(16,end); }
  78%   { transform: translateX(14px) rotate(8deg); animation-timing-function: cubic-bezier(.45,0,.9,.4); }
  80%   { transform: translate(15px,0) rotate(34deg); animation-timing-function: cubic-bezier(.6,0,1,.5); }
  81%   { transform: translate(16px,1px) rotate(93deg); animation-timing-function: ease-out; }
  82%   { transform: translate(16px,0) rotate(88deg); animation-timing-function: steps(1,end); }
  88%   { transform: translate(16px,0) rotate(88deg); animation-timing-function: cubic-bezier(.3,.4,.35,1); }
  90.5% { transform: translate(15px,0) rotate(36deg); animation-timing-function: ease-out; }
  92%   { transform: translateX(14px) rotate(-5deg); animation-timing-function: ease-in-out; }
  93%   { transform: translateX(14px) rotate(0deg); animation-timing-function: steps(6,end); }
  100%  { transform: translateX(0); }
}
@keyframes wm-shpatrol{
  0%   { transform: translateX(0); animation-timing-function: steps(11,end); }
  14%  { transform: translateX(13px); }
  18%  { transform: translateX(13px); animation-timing-function: steps(11,end); }
  30%  { transform: translateX(0); }
  42%  { transform: translateX(0); animation-timing-function: steps(11,end); }
  56%  { transform: translateX(-13px); }
  63%  { transform: translateX(-13px); animation-timing-function: steps(16,end); }
  78%   { transform: translateX(14px); animation-timing-function: cubic-bezier(.45,0,.9,.4); }
  80%   { transform: translateX(15px); animation-timing-function: cubic-bezier(.6,0,1,.5); }
  81%   { transform: translateX(16px); animation-timing-function: steps(1,end); }
  88%   { transform: translateX(16px); animation-timing-function: cubic-bezier(.3,.4,.35,1); }
  90.5% { transform: translateX(15px); animation-timing-function: ease-out; }
  93%   { transform: translateX(14px); animation-timing-function: steps(6,end); }
  100%  { transform: translateX(0); }
}
@keyframes wm-waddle{ 0%,100%{ transform: rotate(-3deg); } 50%{ transform: rotate(3deg); } }
@keyframes wm-legstep{ 0%,100%{ transform: translateY(0); } 50%{ transform: translateY(-1px); } }
@keyframes wm-wdots{ 0%, 29%{ opacity: 0; } 31%, 41%{ opacity: 1; } 43%, 100%{ opacity: 0; } }
@keyframes wm-dotcycle{ 0%,12%{ opacity:0; } 18%, 78%{ opacity:1; } 84%,100%{ opacity:0; } }
@keyframes wm-walert{
  0%, 60%{ opacity: 0; transform: translate(-13px,-3px); }
  61%{ opacity: 1; transform: translate(-13px,-3px); }
  63%, 64%{ opacity: 1; transform: translate(-13px,0); }
  65%, 100%{ opacity: 0; transform: translate(-13px,0); }
}
@keyframes wm-birdfly{
  0%, 60%{ opacity: 0; transform: translate(-20px,0); }
  61%{ opacity: 1; transform: translate(-20px,0); animation-timing-function: steps(22,end); }
  81%{ opacity: 1; transform: translate(34px,-6px); }
  82%, 100%{ opacity: 0; transform: translate(36px,-7px); }
}
@keyframes wm-flap{ 0%, 100%{ opacity: 1; } 50%{ opacity: 0; } }

@media (prefers-reduced-motion: reduce){
  .wander-mascot, .wander-mascot *{ animation: none !important; }
}
`

export default function WanderMascot({ size = 180, className = '' }) {
  const svgRef = useRef(null)

  useEffect(() => {
    if (!document.getElementById('wander-mascot-styles')) {
      const style = document.createElement('style')
      style.id = 'wander-mascot-styles'
      style.textContent = CSS
      document.head.appendChild(style)
    }
    const svg = svgRef.current
    if (svg && !svg.dataset.built) {
      svg.innerHTML = buildMascotSVG()
      svg.dataset.built = '1'
    }
  }, [])

  return (
    <div className={`wander-mascot ${className}`}>
      <svg
        ref={svgRef}
        className="wander-mascot-svg"
        viewBox="0 -7 26 30"
        style={{ height: size }}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Baymax pixel mascot wandering"
      />
    </div>
  )
}
