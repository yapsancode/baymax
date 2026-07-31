import { useEffect, useRef } from 'react'
import { PARTS, svgGroup, shadowGroup, inkFilter } from './mascotPixels'

/**
 * ErrorMascot.jsx — the pixel Baymax "error" state, ported from the State Lab.
 * Element not found / step failed: X'd-out eyes, flashing exclamation marks, a
 * panic shake, and a dramatic faceplant… then it picks itself back up. Every
 * time.
 *
 *   import { ErrorMascot } from '@/components/shared'
 *   <ErrorMascot size={128} />
 *
 * Self-contained: transparent background, styles inject once, no deps. (The
 * Lab's alarm strobe/glow is stage chrome; the panic shake — which the Lab put
 * on the stage — is applied to this component's root instead.) Shared pixel
 * geometry lives in mascotPixels.js.
 */

function buildSVG() {
  return (
    inkFilter('er-ink') +
    shadowGroup('er-shadow', PARTS.shadow) +
    '<g id="er-mascot">' +
    '<g id="er-gait">' +
    svgGroup('er-body', PARTS.body, 'var(--m-body)') +
    svgGroup('er-shade', PARTS.shade, 'var(--m-shade)') +
    svgGroup('er-xeyes', PARTS.xeyes, 'var(--m-face)') +
    svgGroup('er-shoulderL', PARTS.shoulderL, 'var(--m-body)') +
    svgGroup('er-shoulderR', PARTS.shoulderR, 'var(--m-body)') +
    svgGroup('er-armL', PARTS.armL, 'var(--m-body)') +
    svgGroup('er-armR', PARTS.armR, 'var(--m-body)') +
    '</g>' +
    svgGroup('er-legL', PARTS.legL, 'var(--m-body)') +
    svgGroup('er-legR', PARTS.legR, 'var(--m-body)') +
    '</g>' +
    svgGroup('er-bangL', PARTS.bangL, 'var(--m-err)') +
    svgGroup('er-bangR', PARTS.bangR, 'var(--m-err)')
  )
}

const CSS = `
.error-mascot{
  --m-body: hsl(0 0% 100%);
  --m-shade: hsl(190 16% 88%);
  --m-face: #00403e;
  --m-outline: hsl(190 30% 20% / .55);
  --m-shadow: hsl(180 60% 6%);
  --m-err: hsl(0 80% 65%);
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  animation: er-shake 2.6s steps(1,end) infinite;
}
.error-mascot-svg{ width: auto; shape-rendering: crispEdges; overflow: visible; }
.error-mascot .m-ink{ flood-color: var(--m-outline); }
.error-mascot #er-gait{ transform-box: fill-box; transform-origin: 50% 100%; }

.error-mascot #er-mascot{
  transform-box: fill-box;
  transform-origin: 100% 100%;
  filter: url(#er-ink);
  animation: er-meltdown 2.6s steps(1,end) infinite;
}
.error-mascot #er-bangL{ animation: er-bangflash 2.6s steps(1,end) infinite; }
.error-mascot #er-bangR{ animation: er-bangflash 2.6s steps(1,end) infinite; animation-delay: -.08s; }

@keyframes er-meltdown{
  0%  { transform: translateX(0)    rotate(0deg); }
  2%  { transform: translateX(-2px) rotate(0deg); }
  4%  { transform: translateX(2px)  rotate(0deg); }
  6%  { transform: translateX(-2px) rotate(0deg); }
  8%  { transform: translateX(2px)  rotate(0deg); }
  10% { transform: translateX(-2px) rotate(0deg); }
  12% { transform: translateX(2px)  rotate(0deg); }
  14% { transform: translateX(-1px) rotate(0deg); }
  16% { transform: translateX(1px)  rotate(0deg); }
  18% { transform: translateX(0)    rotate(0deg); }
  22% { transform: translateX(0)    rotate(16deg); }
  26% { transform: translateX(0)    rotate(52deg); }
  30% { transform: translateX(0)    rotate(90deg); }
  56% { transform: translateX(0)    rotate(90deg); }
  62% { transform: translateX(0)    rotate(45deg); }
  68% { transform: translateX(0)    rotate(-8deg); }
  74%,100%{ transform: translateX(0) rotate(0deg); }
}
@keyframes er-bangflash{
  0%{ opacity:1; } 4%{ opacity:0; } 8%{ opacity:1; } 12%{ opacity:0; }
  16%{ opacity:1; } 20%{ opacity:0; } 24%{ opacity:1; } 28%,100%{ opacity:0; }
}
@keyframes er-shake{
  0%{ transform: translate(0,0); } 3%{ transform: translate(-3px,1px); }
  6%{ transform: translate(3px,-1px); } 9%{ transform: translate(-3px,0); }
  12%{ transform: translate(3px,1px); } 15%{ transform: translate(-2px,-1px); }
  18%,100%{ transform: translate(0,0); }
}

@media (prefers-reduced-motion: reduce){
  .error-mascot, .error-mascot *{ animation: none !important; }
}
`

export function ErrorMascot({ size = 128, className = '' }) {
  const svgRef = useRef(null)

  useEffect(() => {
    if (!document.getElementById('error-mascot-styles')) {
      const style = document.createElement('style')
      style.id = 'error-mascot-styles'
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
    <div className={`error-mascot ${className}`}>
      <svg
        ref={svgRef}
        className="error-mascot-svg"
        viewBox="0 -7 26 30"
        style={{ height: size }}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Baymax pixel mascot error"
      />
    </div>
  )
}
