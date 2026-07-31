import { useEffect } from 'react'

/**
 * BaymaxChip.jsx — standalone animated Baymax chip.
 *
 *   import BaymaxChip from "./BaymaxChip";
 *   <BaymaxChip />
 *   <BaymaxChip size={220} label="BAYMAX" />
 *
 * Self-contained: styles inject once, no dependencies.
 */

const pins = (n) => Array.from({ length: n }).map((_, i) => <div className="bc-pin" key={i} />)

export default function BaymaxChip({ size = 160, label = 'BAYMAX', className = '' }) {
  useEffect(() => {
    if (document.getElementById('baymax-chip-styles')) return
    const style = document.createElement('style')
    style.id = 'baymax-chip-styles'
    style.textContent = CSS
    document.head.appendChild(style)
  }, [])

  return (
    <div className={`bc-chip ${className}`} style={{ width: size, height: size }}>
      <div className="bc-body">
        <div className="bc-pins top">{pins(4)}</div>
        <div className="bc-pins bottom">{pins(4)}</div>
        <div className="bc-pins left">{pins(3)}</div>
        <div className="bc-pins right">{pins(3)}</div>
        <div>
          <div className="bc-face">
            <div className="bc-eye" />
            <div className="bc-eye" />
          </div>
          {label && <div className="bc-label">{label}</div>}
        </div>
      </div>
    </div>
  )
}

const CSS = `
.bc-chip {
  --bg:#080c10; --border:#1a2535; --green:#00e5a0; --white:#fff;
  --display:'Orbitron',monospace;
  position:relative; margin:0 auto;
}
.bc-chip *,.bc-chip *::before,.bc-chip *::after{box-sizing:border-box;}
.bc-body{
  width:100%; height:100%;
  background:linear-gradient(135deg,#1a2535,#0d1117);
  border:1px solid var(--border); border-radius:12px;
  display:flex; align-items:center; justify-content:center;
  position:relative; animation:bcGlow 4s ease-in-out infinite;
}
@keyframes bcGlow{
  0%,100%{box-shadow:0 0 20px rgba(0,229,160,.1),inset 0 0 20px rgba(0,229,160,.02);}
  50%{box-shadow:0 0 60px rgba(0,229,160,.25),inset 0 0 40px rgba(0,229,160,.05);}
}
.bc-pins{position:absolute;display:flex;gap:8px;}
.bc-pins.top{top:-12px;flex-direction:row;}
.bc-pins.bottom{bottom:-12px;flex-direction:row;}
.bc-pins.left{left:-12px;flex-direction:column;}
.bc-pins.right{right:-12px;flex-direction:column;}
.bc-pin{background:#2a3a50;border-radius:1px;}
.bc-pins.top .bc-pin,.bc-pins.bottom .bc-pin{width:16px;height:12px;}
.bc-pins.left .bc-pin,.bc-pins.right .bc-pin{width:12px;height:16px;}
.bc-face{
  width:50%; height:25%; min-width:60px; min-height:30px;
  background:var(--white); border-radius:999px;
  display:flex; align-items:center; justify-content:center; gap:16px;
  position:relative; z-index:2;
}
.bc-eye{
  width:14px; height:14px; border-radius:50%;
  background:var(--bg); animation:bcBlink 6s ease-in-out infinite;
}
@keyframes bcBlink{
  0%,90%,100%{transform:scaleY(1);}
  95%{transform:scaleY(.1);}
}
.bc-label{
  font-family:var(--display); font-size:8px; color:var(--green);
  letter-spacing:2px; margin-top:6px; text-align:center;
}
`
