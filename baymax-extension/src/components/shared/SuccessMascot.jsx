import { useEffect, useRef } from 'react'
import { PARTS, svgGroup, shadowGroup, plus, buildConfetti, inkFilter } from './mascotPixels'

/**
 * SuccessMascot.jsx — the pixel Baymax "success" state, ported from the State
 * Lab. Step completed or session done: a full pixel backflip (rotating in 90°
 * snaps), sparkles popping around it, and a burst of brand-colour confetti
 * raining down.
 *
 *   import { SuccessMascot } from '@/components/shared'
 *   <SuccessMascot size={128} />
 *
 * Self-contained: transparent background, styles inject once, no deps. (The
 * Lab's green stage flash is stage chrome and is omitted here.) Shared pixel
 * geometry lives in mascotPixels.js.
 */

function buildSVG() {
  return (
    inkFilter('sc-ink') +
    shadowGroup('sc-shadow', PARTS.shadow) +
    '<g id="sc-mascot">' +
    '<g id="sc-gait">' +
    svgGroup('sc-body', PARTS.body, 'var(--m-body)') +
    svgGroup('sc-shade', PARTS.shade, 'var(--m-shade)') +
    svgGroup('sc-eyes', PARTS.eyes, 'var(--m-face)') +
    svgGroup('sc-shoulderL', PARTS.shoulderL, 'var(--m-body)') +
    svgGroup('sc-shoulderR', PARTS.shoulderR, 'var(--m-body)') +
    svgGroup('sc-armL', PARTS.armL, 'var(--m-body)') +
    svgGroup('sc-armR', PARTS.armR, 'var(--m-body)') +
    '</g>' +
    svgGroup('sc-legL', PARTS.legL, 'var(--m-body)') +
    svgGroup('sc-legR', PARTS.legR, 'var(--m-body)') +
    '</g>' +
    // kept clear of the new silhouette — the arms now reach out to x1/x24
    '<g id="sc-sparkles">' +
    svgGroup('sc-s1', plus(3, -1), 'var(--m-body)', 'sc-spark') +
    svgGroup('sc-s2', plus(20, -3), 'var(--m-body)', 'sc-spark') +
    svgGroup('sc-s3', plus(0, 6), 'var(--m-body)', 'sc-spark') +
    svgGroup('sc-s4', plus(23, 6), 'var(--m-body)', 'sc-spark') +
    '</g>' +
    '<g id="sc-confetti">' +
    buildConfetti() +
    '</g>'
  )
}

const CSS = `
.success-mascot{
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
.success-mascot-svg{ width: auto; shape-rendering: crispEdges; overflow: visible; }
.success-mascot .m-ink{ flood-color: var(--m-outline); }
.success-mascot #sc-mascot{
  transform-box: fill-box;
  transform-origin: 50% 50%;
  filter: url(#sc-ink);
}
.success-mascot #sc-sparkles{ filter: url(#sc-ink); }
.success-mascot #sc-gait{ transform-box: fill-box; transform-origin: 50% 100%; }

.success-mascot #sc-armL,
.success-mascot #sc-armR{ transform: translateY(-2px); }
.success-mascot #sc-mascot{ animation: sc-backflip 1.5s steps(1,end) infinite; }
.success-mascot #sc-shadow{
  transform-box: fill-box; transform-origin: 50% 50%;
  animation: sc-squash 1.5s steps(1,end) infinite;
}
.success-mascot .sc-spark{ opacity:0; animation: sc-pop 1.5s steps(1,end) infinite; }
.success-mascot #sc-s2{ animation-delay: .15s; }
.success-mascot #sc-s3{ animation-delay: .3s; }
.success-mascot #sc-s4{ animation-delay: .45s; }
.success-mascot #sc-confetti rect{ animation: sc-cfall 1.6s steps(9,end) infinite; }

@keyframes sc-backflip{
  0%  { transform: translateY(0)    rotate(0deg); }
  8%  { transform: translateY(-3px) rotate(0deg); }
  16% { transform: translateY(-6px) rotate(-90deg); }
  24% { transform: translateY(-8px) rotate(-180deg); }
  32% { transform: translateY(-8px) rotate(-270deg); }
  40% { transform: translateY(-5px) rotate(-360deg); }
  50% { transform: translateY(0)    rotate(-360deg); }
  56% { transform: translateY(1px)  rotate(-360deg); }
  62%,100%{ transform: translateY(0) rotate(-360deg); }
}
@keyframes sc-squash{ 0%,50%,100%{ transform: scaleX(1); } 16%,40%{ transform: scaleX(.5); } }
@keyframes sc-pop{ 0%,8%{ opacity:0; } 14%, 48%{ opacity:1; } 54%,100%{ opacity:0; } }
@keyframes sc-cfall{
  0%{ transform: translate(0,0); opacity:1; }
  85%{ opacity:1; }
  100%{ transform: translate(var(--dx,0px), 32px); opacity:0; }
}

@media (prefers-reduced-motion: reduce){
  .success-mascot, .success-mascot *{ animation: none !important; }
}
`

export function SuccessMascot({ size = 128, className = '' }) {
  const svgRef = useRef(null)

  useEffect(() => {
    if (!document.getElementById('success-mascot-styles')) {
      const style = document.createElement('style')
      style.id = 'success-mascot-styles'
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
    <div className={`success-mascot ${className}`}>
      <svg
        ref={svgRef}
        className="success-mascot-svg"
        viewBox="0 -7 26 30"
        style={{ height: size }}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Baymax pixel mascot celebrating success"
      />
    </div>
  )
}
