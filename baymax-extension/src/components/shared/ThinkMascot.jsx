import { useEffect, useRef } from 'react'
import { PARTS, svgGroup, shadowGroup, inkFilter } from './mascotPixels'

/**
 * ThinkMascot.jsx — the pixel Baymax "thinking" state, ported from the State
 * Lab. Shown while a Gemini call is in flight: the robot head-tilts side to
 * side in thought, a giant "?" bobs over its head, thought dots blink, and a
 * nervous sweat drop slides down beside its face.
 *
 *   import { ThinkMascot } from '@/components/shared'
 *   <ThinkMascot size={128} />
 *
 * Self-contained: transparent background, styles inject once, no deps. Every
 * motion is a CSS steps() keyframe so it snaps cell-by-cell like a real sprite.
 * Shared pixel geometry lives in mascotPixels.js.
 */

function buildSVG() {
  return (
    inkFilter('tm-ink') +
    shadowGroup('tm-shadow', PARTS.shadow) +
    '<g id="tm-mascot">' +
    '<g id="tm-gait">' +
    svgGroup('tm-body', PARTS.body, 'var(--m-body)') +
    svgGroup('tm-shade', PARTS.shade, 'var(--m-shade)') +
    svgGroup('tm-eyes', PARTS.eyes, 'var(--m-face)') +
    svgGroup('tm-shoulderL', PARTS.shoulderL, 'var(--m-body)') +
    svgGroup('tm-shoulderR', PARTS.shoulderR, 'var(--m-body)') +
    svgGroup('tm-armL', PARTS.armL, 'var(--m-body)') +
    svgGroup('tm-armR', PARTS.armR, 'var(--m-body)') +
    '</g>' +
    svgGroup('tm-legL', PARTS.legL, 'var(--m-body)') +
    svgGroup('tm-legR', PARTS.legR, 'var(--m-body)') +
    '</g>' +
    '<g id="tm-dots">' +
    svgGroup('tm-dot1', PARTS.dot1, 'var(--m-body)', 'tm-dot') +
    svgGroup('tm-dot2', PARTS.dot2, 'var(--m-body)', 'tm-dot') +
    '</g>' +
    svgGroup('tm-qmark', PARTS.qmark, 'var(--m-body)') +
    svgGroup('tm-sweat', PARTS.sweat, 'var(--m-sweat)')
  )
}

const CSS = `
.think-mascot{
  --m-body: hsl(0 0% 100%);
  --m-shade: hsl(190 16% 88%);
  --m-face: #00403e;
  --m-outline: hsl(190 30% 20% / .55);
  --m-shadow: hsl(180 60% 6%);
  --m-sweat: hsl(200 90% 72%);
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.think-mascot-svg{ width: auto; shape-rendering: crispEdges; overflow: visible; }
.think-mascot .m-ink{ flood-color: var(--m-outline); }
.think-mascot #tm-mascot{
  transform-box: fill-box;
  transform-origin: 50% 50%;
  filter: url(#tm-ink);
}
.think-mascot #tm-gait{ transform-box: fill-box; transform-origin: 50% 100%; }

/* the "?" and the thought dots are white too — they need the rim to survive a
   light background just as much as the body does */
.think-mascot #tm-qmark,
.think-mascot #tm-dots{ filter: url(#tm-ink); }

/* the ponder: head-tilt side to side, thinking hard */
.think-mascot #tm-mascot{ animation: tm-ponder 1.6s steps(1,end) infinite; }
.think-mascot #tm-armL,
.think-mascot #tm-armR{ transform: translateY(-2px); }

/* eyes keep blinking + glancing around while it ponders */
.think-mascot #tm-eyes{
  animation: tm-blink 4.4s steps(1,end) infinite,
             tm-lookaround 7s steps(1,end) infinite;
}

/* thought dots blink in and out */
.think-mascot .tm-dot{ opacity: 0; animation: tm-dotcycle 1.8s steps(1,end) infinite; }
.think-mascot #tm-dot2{ animation-delay: .3s; }

/* the giant "?" bobs; the sweat drop drips */
.think-mascot #tm-qmark{ animation: tm-qbounce .9s steps(1,end) infinite; }
.think-mascot #tm-sweat{ animation: tm-sweatdrip 1.4s steps(3,end) infinite; }

@keyframes tm-ponder{
  0%,100%{ transform: rotate(0deg) translateX(0); }
  25%{ transform: rotate(-4deg) translateX(-1px); }
  50%{ transform: rotate(0deg) translateX(0); }
  75%{ transform: rotate(4deg) translateX(1px); }
}
@keyframes tm-blink{ 0%, 91%, 97%, 100%{ opacity:1; } 92%, 96%{ opacity:0; } }
@keyframes tm-lookaround{
  0%, 55%, 100%{ transform: translateX(0); }
  60%, 70%{ transform: translateX(-1px); }
  76%, 88%{ transform: translateX(1px); }
}
@keyframes tm-dotcycle{ 0%,12%{ opacity:0; } 18%, 78%{ opacity:1; } 84%,100%{ opacity:0; } }
@keyframes tm-qbounce{ 0%,100%{ transform: translateY(0); } 50%{ transform: translateY(-2px); } }
@keyframes tm-sweatdrip{
  0%{ transform: translateY(0); opacity: 0; }
  15%{ opacity: 1; }
  70%{ opacity: 1; }
  100%{ transform: translateY(4px); opacity: 0; }
}

@media (prefers-reduced-motion: reduce){
  .think-mascot, .think-mascot *{ animation: none !important; }
}
`

export function ThinkMascot({ size = 128, className = '' }) {
  const svgRef = useRef(null)

  useEffect(() => {
    if (!document.getElementById('think-mascot-styles')) {
      const style = document.createElement('style')
      style.id = 'think-mascot-styles'
      style.textContent = CSS
      document.head.appendChild(style)
    }
    const svg = svgRef.current
    if (svg && !svg.dataset.built) {
      svg.innerHTML = buildSVG()
      svg.dataset.built = '1'
    }
  }, [])

  return (
    <div className={`think-mascot ${className}`}>
      <svg
        ref={svgRef}
        className="think-mascot-svg"
        viewBox="0 -7 26 30"
        style={{ height: size }}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Baymax pixel mascot thinking"
      />
    </div>
  )
}
