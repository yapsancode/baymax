import { useEffect, useRef } from 'react'
import { PARTS, svgGroup, shadowGroup, inkFilter } from './mascotPixels'

/**
 * WorkMascot.jsx — the pixel Baymax "working" state, ported from the State Lab.
 * Long operations (guide loading, blueprint build, self-heal): the laptop lid
 * flips open, the robot bounces as it types frantically, and code bits fly up
 * off the screen.
 *
 *   import { WorkMascot } from '@/components/shared'
 *   <WorkMascot size={128} />
 *
 * Self-contained: transparent background, styles inject once, no deps. Shared
 * pixel geometry lives in mascotPixels.js.
 */

function buildSVG() {
  return (
    inkFilter('wk-ink') +
    shadowGroup('wk-shadow', PARTS.shadow) +
    '<g id="wk-mascot">' +
    '<g id="wk-gait">' +
    svgGroup('wk-body', PARTS.body, 'var(--m-body)') +
    svgGroup('wk-shade', PARTS.shade, 'var(--m-shade)') +
    svgGroup('wk-eyes', PARTS.eyes, 'var(--m-face)') +
    svgGroup('wk-shoulderL', PARTS.shoulderL, 'var(--m-body)') +
    svgGroup('wk-shoulderR', PARTS.shoulderR, 'var(--m-body)') +
    svgGroup('wk-armL', PARTS.armL, 'var(--m-body)') +
    svgGroup('wk-armR', PARTS.armR, 'var(--m-body)') +
    '</g>' +
    svgGroup('wk-legL', PARTS.legL, 'var(--m-body)') +
    svgGroup('wk-legR', PARTS.legR, 'var(--m-body)') +
    '<g id="wk-laptop">' +
    '<g id="wk-lid">' +
    svgGroup('wk-lidpanel', PARTS.lidPanel, 'var(--m-laptop)') +
    svgGroup('wk-lidlogo', PARTS.logo, 'var(--m-screen)') +
    '</g>' +
    svgGroup('wk-lapbase', PARTS.lapBase, 'var(--m-laptop-base)') +
    '</g>' +
    svgGroup('wk-handL', PARTS.handL, 'var(--m-body)') +
    svgGroup('wk-handR', PARTS.handR, 'var(--m-body)') +
    '</g>' +
    '<g id="wk-codebits">' +
    svgGroup('wk-cbit1', PARTS.cbit1, 'var(--m-screen)', 'wk-cbit') +
    svgGroup('wk-cbit2', PARTS.cbit2, 'hsl(178 70% 75%)', 'wk-cbit') +
    svgGroup('wk-cbit3', PARTS.cbit3, 'var(--m-body)', 'wk-cbit') +
    '</g>'
  )
}

const CSS = `
.work-mascot{
  --m-body: hsl(0 0% 100%);
  --m-shade: hsl(190 16% 88%);
  --m-face: #00403e;
  --m-outline: hsl(190 30% 20% / .55);
  --m-shadow: hsl(180 60% 6%);
  --m-laptop: #032b29;
  --m-laptop-base: #0a4744;
  --m-screen: hsl(178 60% 55%);
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.work-mascot-svg{ width: auto; shape-rendering: crispEdges; overflow: visible; }
.work-mascot .m-ink{ flood-color: var(--m-outline); }
.work-mascot #wk-mascot{
  transform-box: fill-box;
  transform-origin: 50% 50%;
  filter: url(#wk-ink);
}
.work-mascot #wk-codebits{ filter: url(#wk-ink); }
.work-mascot #wk-gait{ transform-box: fill-box; transform-origin: 50% 100%; }

/* real arms give way to the typing hands + open laptop */
.work-mascot #wk-armL,
.work-mascot #wk-armR{ display: none; }
.work-mascot #wk-mascot{ animation: wk-workbounce .28s steps(1,end) infinite; }
.work-mascot #wk-lid{
  transform-box: fill-box;
  transform-origin: 50% 100%;
  animation: wk-lidopen .55s steps(4,end) both;
}
.work-mascot #wk-handL{ animation: wk-tap .12s steps(1,end) infinite; }
.work-mascot #wk-handR{ animation: wk-tap .12s steps(1,end) infinite; animation-delay: -.06s; }
.work-mascot .wk-cbit{ opacity: 0; animation: wk-coderise 1.35s steps(6,end) infinite; }
.work-mascot #wk-cbit2{ animation-delay: .45s; }
.work-mascot #wk-cbit3{ animation-delay: .9s; }
.work-mascot #wk-eyes{
  animation: wk-blink 4.4s steps(1,end) infinite,
             wk-lookaround 7s steps(1,end) infinite;
}

@keyframes wk-workbounce{ 0%,100%{ transform: translateY(0); } 50%{ transform: translateY(1px); } }
@keyframes wk-lidopen{ from{ transform: scaleY(.12); } to{ transform: scaleY(1); } }
@keyframes wk-tap{ 0%,100%{ transform: translateY(0); } 50%{ transform: translateY(1px); } }
@keyframes wk-coderise{
  0%{ transform: translateY(0); opacity: 0; }
  12%{ opacity: 1; }
  75%{ opacity: 1; }
  100%{ transform: translateY(-10px); opacity: 0; }
}
@keyframes wk-blink{ 0%, 91%, 97%, 100%{ opacity:1; } 92%, 96%{ opacity:0; } }
@keyframes wk-lookaround{
  0%, 55%, 100%{ transform: translateX(0); }
  60%, 70%{ transform: translateX(-1px); }
  76%, 88%{ transform: translateX(1px); }
}

@media (prefers-reduced-motion: reduce){
  .work-mascot, .work-mascot *{ animation: none !important; }
}
`

export function WorkMascot({ size = 128, className = '' }) {
  const svgRef = useRef(null)

  useEffect(() => {
    if (!document.getElementById('work-mascot-styles')) {
      const style = document.createElement('style')
      style.id = 'work-mascot-styles'
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
    <div className={`work-mascot ${className}`}>
      <svg
        ref={svgRef}
        className="work-mascot-svg"
        viewBox="0 -7 26 30"
        style={{ height: size }}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Baymax pixel mascot working"
      />
    </div>
  )
}
