import { cn } from '@/lib/utils'

const POSE_LABELS = {
  cheering: 'Baymax cheering',
  neutral: 'Baymax',
  waving: 'Baymax waving',
}

export function BaymaxCharacter({ pose = 'neutral', size = 156, className }) {
  const height = Math.round(size * 1.05)

  return (
    <svg
      className={cn('bx-figure', `bx-pose-${pose}`, className)}
      viewBox="0 0 200 210"
      width={size}
      height={height}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={POSE_LABELS[pose] ?? POSE_LABELS.neutral}
    >
      {pose === 'cheering' && (
        <>
          <g className="bx-arm bx-arm-left">
            <ellipse cx="55" cy="88" rx="12" ry="34" fill="#ffffff" stroke="#cfd8e3" strokeWidth="2" transform="rotate(25 55 88)" />
            <circle cx="38" cy="42" r="9" fill="#ffffff" stroke="#cfd8e3" strokeWidth="2" />
          </g>
          <g className="bx-arm bx-arm-right">
            <ellipse cx="145" cy="88" rx="12" ry="34" fill="#ffffff" stroke="#cfd8e3" strokeWidth="2" transform="rotate(-25 145 88)" />
            <circle cx="162" cy="42" r="9" fill="#ffffff" stroke="#cfd8e3" strokeWidth="2" />
          </g>
        </>
      )}

      {pose === 'waving' && (
        <>
          <g className="bx-arm bx-arm-left">
            <ellipse cx="50" cy="94" rx="13" ry="32" fill="#ffffff" stroke="#cfd8e3" strokeWidth="2" transform="rotate(-24 50 94)" />
            <circle cx="37" cy="65" r="11" fill="#ffffff" stroke="#cfd8e3" strokeWidth="2" />
          </g>
          <g className="bx-arm bx-arm-right">
            <ellipse cx="148" cy="137" rx="11" ry="31" fill="#ffffff" stroke="#cfd8e3" strokeWidth="2" transform="rotate(-9 148 137)" />
            <circle cx="152" cy="166" r="9" fill="#ffffff" stroke="#cfd8e3" strokeWidth="2" />
          </g>
        </>
      )}

      {pose === 'neutral' && (
        <>
          <g className="bx-arm bx-arm-left">
            <ellipse cx="51" cy="137" rx="11" ry="31" fill="#ffffff" stroke="#cfd8e3" strokeWidth="2" transform="rotate(9 51 137)" />
            <circle cx="47" cy="166" r="9" fill="#ffffff" stroke="#cfd8e3" strokeWidth="2" />
          </g>
          <g className="bx-arm bx-arm-right">
            <ellipse cx="149" cy="137" rx="11" ry="31" fill="#ffffff" stroke="#cfd8e3" strokeWidth="2" transform="rotate(-9 149 137)" />
            <circle cx="153" cy="166" r="9" fill="#ffffff" stroke="#cfd8e3" strokeWidth="2" />
          </g>
        </>
      )}

      <ellipse cx="100" cy="138" rx="46" ry="50" fill="#ffffff" stroke="#cfd8e3" strokeWidth="2" />
      <path d="M100 95 V152" stroke="#eef2f6" strokeWidth="3" fill="none" />
      <ellipse cx="100" cy="66" rx="34" ry="29" fill="#ffffff" stroke="#cfd8e3" strokeWidth="2" />

      <g className="bx-eyes">
        <circle cx="86" cy="66" r="5" fill="#202124" />
        <circle cx="114" cy="66" r="5" fill="#202124" />
      </g>
      <line x1="91" y1="66" x2="109" y2="66" stroke="#202124" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}
