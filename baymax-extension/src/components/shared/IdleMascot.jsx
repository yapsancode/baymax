import { useEffect, useRef } from 'react'
import { PARTS, svgGroup, shadowGroup, inkFilter } from './mascotPixels'

/**
 * IdleMascot.jsx — the pixel Baymax "idle" state, ported from the State Lab.
 * Side panel open, nothing in flight: the robot gently bobs, its arms drift,
 * it blinks, and its eyes shift in a shifty look around the room.
 *
 *   import { IdleMascot } from '@/components/shared'
 *   <IdleMascot size={128} />
 *
 * Self-contained: transparent background, styles inject once, no deps. Shared
 * pixel geometry lives in mascotPixels.js.
 */

function buildSVG() {
  return (
    inkFilter('il-ink') +
    shadowGroup('il-shadow', PARTS.shadow) +
    '<g id="il-mascot">' +
    '<g id="il-gait">' +
    svgGroup('il-body', PARTS.body, 'var(--m-body)') +
    svgGroup('il-shade', PARTS.shade, 'var(--m-shade)') +
    svgGroup('il-eyes', PARTS.eyes, 'var(--m-face)') +
    svgGroup('il-shoulderL', PARTS.shoulderL, 'var(--m-body)') +
    svgGroup('il-shoulderR', PARTS.shoulderR, 'var(--m-body)') +
    svgGroup('il-armL', PARTS.armL, 'var(--m-body)') +
    svgGroup('il-armR', PARTS.armR, 'var(--m-body)') +
    '</g>' +
    svgGroup('il-legL', PARTS.legL, 'var(--m-body)') +
    svgGroup('il-legR', PARTS.legR, 'var(--m-body)') +
    '</g>'
  )
}

const CSS = `
.idle-mascot{
  --m-body: hsl(0 0% 100%);
  --m-shade: hsl(190 16% 88%);
  --m-face: #00403e;
  --m-outline: hsl(190 30% 20% / .55);
  --m-shadow: hsl(180 60% 6%);
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.idle-mascot-svg{ width: auto; shape-rendering: crispEdges; overflow: visible; }
.idle-mascot .m-ink{ flood-color: var(--m-outline); }
.idle-mascot #il-mascot{
  transform-box: fill-box;
  transform-origin: 50% 50%;
  filter: url(#il-ink);
}
.idle-mascot #il-gait{ transform-box: fill-box; transform-origin: 50% 100%; }

.idle-mascot #il-mascot{ animation: il-bob 1.6s steps(1,end) infinite; }
.idle-mascot #il-armL{ animation: il-armbob 1.6s steps(1,end) infinite; }
.idle-mascot #il-armR{ animation: il-armbob 1.6s steps(1,end) infinite; animation-delay: -.8s; }
.idle-mascot #il-eyes{
  animation: il-blink 4.4s steps(1,end) infinite,
             il-lookaround 7s steps(1,end) infinite;
}

@keyframes il-bob{ 0%,100%{ transform: translateY(0); } 50%{ transform: translateY(1px); } }
@keyframes il-armbob{ 0%,100%{ transform: translateY(0); } 50%{ transform: translateY(-1px); } }
@keyframes il-blink{ 0%, 91%, 97%, 100%{ opacity:1; } 92%, 96%{ opacity:0; } }
@keyframes il-lookaround{
  0%, 55%, 100%{ transform: translateX(0); }
  60%, 70%{ transform: translateX(-1px); }
  76%, 88%{ transform: translateX(1px); }
}

@media (prefers-reduced-motion: reduce){
  .idle-mascot, .idle-mascot *{ animation: none !important; }
}
`

export function IdleMascot({ size = 128, className = '' }) {
  const svgRef = useRef(null)

  useEffect(() => {
    if (!document.getElementById('idle-mascot-styles')) {
      const style = document.createElement('style')
      style.id = 'idle-mascot-styles'
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
    <div className={`idle-mascot ${className}`}>
      <svg
        ref={svgRef}
        className="idle-mascot-svg"
        viewBox="0 -7 26 30"
        style={{ height: size }}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Baymax pixel mascot idle"
      />
    </div>
  )
}
