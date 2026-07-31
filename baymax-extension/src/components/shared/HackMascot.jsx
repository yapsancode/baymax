import { useEffect, useRef } from 'react'
import { PARTS, svgGroup, shadowGroup, inkFilter } from './mascotPixels'

/**
 * HackMascot.jsx — the pixel Baymax "hacking" state, ported from the State Lab.
 * Kicking off a big run, the full cinematic boot sequence: stare at the closed
 * laptop → the lid creaks… creaks… SLAMS open → a knuckle-crack arm wiggle →
 * hunched, furious typing with eyes darting across the screen.
 *
 *   import { HackMascot } from '@/components/shared'
 *   <HackMascot size={128} />
 *
 * Self-contained: transparent background, styles inject once, no deps. (The
 * Lab's ambient stage glow/screen-flash is stage chrome, not part of the
 * sprite, so it is omitted here.) Shared pixel geometry lives in mascotPixels.js.
 */

function buildSVG() {
  return (
    inkFilter('hk-ink') +
    shadowGroup('hk-shadow', PARTS.shadow) +
    '<g id="hk-mascot">' +
    '<g id="hk-gait">' +
    svgGroup('hk-body', PARTS.body, 'var(--m-body)') +
    svgGroup('hk-shade', PARTS.shade, 'var(--m-shade)') +
    svgGroup('hk-eyes', PARTS.eyes, 'var(--m-face)') +
    svgGroup('hk-shoulderL', PARTS.shoulderL, 'var(--m-body)') +
    svgGroup('hk-shoulderR', PARTS.shoulderR, 'var(--m-body)') +
    svgGroup('hk-armL', PARTS.armL, 'var(--m-body)') +
    svgGroup('hk-armR', PARTS.armR, 'var(--m-body)') +
    '</g>' +
    svgGroup('hk-legL', PARTS.legL, 'var(--m-body)') +
    svgGroup('hk-legR', PARTS.legR, 'var(--m-body)') +
    '<g id="hk-laptop">' +
    '<g id="hk-lid">' +
    svgGroup('hk-lidpanel', PARTS.lidPanel, 'var(--m-laptop)') +
    svgGroup('hk-lidlogo', PARTS.logo, 'var(--m-screen)') +
    '</g>' +
    svgGroup('hk-lapbase', PARTS.lapBase, 'var(--m-laptop-base)') +
    '</g>' +
    svgGroup('hk-handL', PARTS.handL, 'var(--m-body)') +
    svgGroup('hk-handR', PARTS.handR, 'var(--m-body)') +
    '</g>' +
    '<g id="hk-codebits">' +
    svgGroup('hk-cbit1', PARTS.cbit1, 'var(--m-screen)', 'hk-cbit') +
    svgGroup('hk-cbit2', PARTS.cbit2, 'hsl(178 70% 75%)', 'hk-cbit') +
    svgGroup('hk-cbit3', PARTS.cbit3, 'var(--m-body)', 'hk-cbit') +
    '</g>'
  )
}

const CSS = `
.hack-mascot{
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
.hack-mascot-svg{ width: auto; shape-rendering: crispEdges; overflow: visible; }
.hack-mascot .m-ink{ flood-color: var(--m-outline); }
.hack-mascot #hk-mascot{
  transform-box: fill-box;
  transform-origin: 50% 50%;
  filter: url(#hk-ink);
}
.hack-mascot #hk-gait{ transform-box: fill-box; transform-origin: 50% 100%; }

.hack-mascot #hk-lid{
  transform-box: fill-box;
  transform-origin: 50% 100%;
  animation: hk-lidslam 7s steps(1,end) infinite;
}
.hack-mascot #hk-gait{ animation: hk-hackgait 7s steps(1,end) infinite; }
.hack-mascot #hk-armL,
.hack-mascot #hk-armR{ animation: hk-armcrack 7s steps(1,end) infinite; }
.hack-mascot #hk-handL{
  animation: hk-tap .12s steps(1,end) infinite,
             hk-handgate 7s steps(1,end) infinite;
}
.hack-mascot #hk-handR{
  animation: hk-tap .12s steps(1,end) infinite,
             hk-handgate 7s steps(1,end) infinite;
  animation-delay: -.06s, 0s;
}
.hack-mascot #hk-codebits{ filter: url(#hk-ink); animation: hk-cbgate 7s steps(1,end) infinite; }
.hack-mascot .hk-cbit{ opacity: 0; animation: hk-coderise 1.35s steps(6,end) infinite; }
.hack-mascot #hk-cbit2{ animation-delay: .45s; }
.hack-mascot #hk-cbit3{ animation-delay: .9s; }
.hack-mascot #hk-eyes{ animation: hk-eyedart 7s steps(1,end) infinite; }

@keyframes hk-lidslam{
  0%, 15%{ transform: scaleY(.12); }   /* closed */
  20%{ transform: scaleY(.28); }       /* creak… */
  26%{ transform: scaleY(.28); }       /* suspense */
  32%{ transform: scaleY(.45); }       /* creeeak… */
  38%{ transform: scaleY(.45); }
  40%, 100%{ transform: scaleY(1); }   /* SLAM */
}
@keyframes hk-hackgait{
  0%{ transform: rotate(0deg); }
  6%, 38%{ transform: rotate(7deg); }    /* leaning in, staring */
  40%{ transform: rotate(-10deg); }      /* recoil at the slam */
  44%{ transform: rotate(-4deg); }
  48%, 55%{ transform: rotate(0deg); }
  58%, 100%{ transform: rotate(5deg); }  /* hunched over the keys */
}
@keyframes hk-armcrack{
  0%, 44%{ transform: translateY(0); opacity: 1; }
  46%{ transform: translateY(-3px); opacity: 1; }
  48%{ transform: translateY(-1px); opacity: 1; }
  50%{ transform: translateY(-3px); opacity: 1; }
  52%{ transform: translateY(-1px); opacity: 1; }
  54%{ transform: translateY(-3px); opacity: 1; }
  55%, 100%{ transform: translateY(0); opacity: 0; }
}
@keyframes hk-handgate{ 0%, 54%{ opacity: 0; } 55%, 100%{ opacity: 1; } }
@keyframes hk-cbgate{ 0%, 57%{ opacity: 0; } 58%, 100%{ opacity: 1; } }
@keyframes hk-tap{ 0%,100%{ transform: translateY(0); } 50%{ transform: translateY(1px); } }
@keyframes hk-coderise{
  0%{ transform: translateY(0); opacity: 0; }
  12%{ opacity: 1; }
  75%{ opacity: 1; }
  100%{ transform: translateY(-10px); opacity: 0; }
}
@keyframes hk-eyedart{
  0%{ transform: translate(0,0); }
  4%, 38%{ transform: translate(0,1px); }   /* peering down at the lid */
  40%, 46%{ transform: translate(0,-1px); } /* shock */
  48%, 55%{ transform: translate(0,0); }
  58%{ transform: translate(-1px,0); }
  62%{ transform: translate(1px,0); }
  66%{ transform: translate(-1px,0); }
  70%{ transform: translate(1px,0); }
  74%{ transform: translate(-1px,0); }
  78%{ transform: translate(1px,0); }
  82%{ transform: translate(-1px,0); }
  86%{ transform: translate(1px,0); }
  90%{ transform: translate(-1px,0); }
  94%{ transform: translate(1px,0); }
  100%{ transform: translate(0,0); }
}

@media (prefers-reduced-motion: reduce){
  .hack-mascot, .hack-mascot *{ animation: none !important; }
}
`

export function HackMascot({ size = 128, className = '' }) {
  const svgRef = useRef(null)

  useEffect(() => {
    if (!document.getElementById('hack-mascot-styles')) {
      const style = document.createElement('style')
      style.id = 'hack-mascot-styles'
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
    <div className={`hack-mascot ${className}`}>
      <svg
        ref={svgRef}
        className="hack-mascot-svg"
        viewBox="0 -7 26 30"
        style={{ height: size }}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Baymax pixel mascot hacking"
      />
    </div>
  )
}
