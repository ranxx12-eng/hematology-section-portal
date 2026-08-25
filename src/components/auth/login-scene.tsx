/** Decorative hematology laboratory background for the public login page. */
export function LoginScene() {
  return (
    <div className="login-scene" aria-hidden="true">
      <div className="login-scene__gradient" />
      <div className="login-scene__vignette" />

      {/* Molecular network — extremely subtle */}
      <svg className="login-scene__network" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
        <g stroke="#5B3FD6" strokeWidth="0.6" opacity="0.06">
          <line x1="120" y1="80" x2="280" y2="160" />
          <line x1="280" y1="160" x2="420" y2="120" />
          <line x1="420" y1="120" x2="560" y2="200" />
          <line x1="900" y1="100" x2="1040" y2="180" />
          <line x1="1040" y1="180" x2="1180" y2="140" />
          <line x1="1180" y1="140" x2="1320" y2="220" />
          <line x1="200" y1="720" x2="360" y2="780" />
          <line x1="360" y1="780" x2="520" y2="740" />
          <line x1="920" y1="760" x2="1080" y2="820" />
          <line x1="1080" y1="820" x2="1240" y2="780" />
        </g>
        <g fill="#5B3FD6" opacity="0.05">
          <circle cx="120" cy="80" r="3" />
          <circle cx="280" cy="160" r="3" />
          <circle cx="420" cy="120" r="3" />
          <circle cx="560" cy="200" r="3" />
          <circle cx="900" cy="100" r="3" />
          <circle cx="1040" cy="180" r="3" />
          <circle cx="1180" cy="140" r="3" />
          <circle cx="1320" cy="220" r="3" />
        </g>
      </svg>

      {/* Blood cells — scattered soft circles */}
      <svg className="login-scene__cells" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
        <g fill="#5B3FD6" opacity="0.04">
          <circle cx="180" cy="640" r="28" />
          <circle cx="320" cy="720" r="18" />
          <circle cx="480" cy="680" r="22" />
          <circle cx="620" cy="760" r="14" />
          <circle cx="760" cy="700" r="26" />
          <circle cx="900" cy="740" r="16" />
          <circle cx="1040" cy="680" r="24" />
          <circle cx="1180" cy="720" r="12" />
          <circle cx="1320" cy="660" r="20" />
        </g>
        <g fill="none" stroke="#93C5FD" strokeWidth="1.2" opacity="0.05">
          <circle cx="250" cy="820" r="32" />
          <circle cx="550" cy="850" r="24" />
          <circle cx="850" cy="830" r="30" />
          <circle cx="1150" cy="840" r="22" />
        </g>
      </svg>

      {/* Left: specimen tubes */}
      <svg className="login-scene__tubes" viewBox="0 0 320 480" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="tube-glass" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#E9DDFB" stopOpacity="0.35" />
            <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#C4B5FD" stopOpacity="0.25" />
          </linearGradient>
          <linearGradient id="tube-cap" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8B5CF6" />
            <stop offset="100%" stopColor="#5B3FD6" />
          </linearGradient>
        </defs>
        {[
          { x: 24, h: 340, blood: 0.62 },
          { x: 72, h: 380, blood: 0.58 },
          { x: 120, h: 360, blood: 0.65 },
          { x: 168, h: 390, blood: 0.55 },
          { x: 216, h: 350, blood: 0.6 },
          { x: 264, h: 370, blood: 0.57 },
        ].map((tube, i) => (
          <g key={i} transform={`translate(${tube.x}, ${480 - tube.h})`} opacity="0.22">
            <rect x="8" y="0" width="32" height="14" rx="4" fill="url(#tube-cap)" />
            <rect x="10" y="12" width="28" height={tube.h - 12} rx="6" fill="url(#tube-glass)" stroke="#C4B5FD" strokeWidth="1" />
            <rect
              x="12"
              y={12 + (tube.h - 12) * (1 - tube.blood)}
              width="24"
              height={(tube.h - 12) * tube.blood}
              rx="4"
              fill="#5B3FD6"
              opacity="0.18"
            />
            <ellipse cx="24" cy={tube.h - 4} rx="12" ry="3" fill="#C4B5FD" opacity="0.3" />
          </g>
        ))}
      </svg>

      {/* Right: microscope */}
      <svg className="login-scene__microscope" viewBox="0 0 420 520" preserveAspectRatio="xMidYMid meet">
        <g opacity="0.14" fill="none" stroke="#5B3FD6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M210 40 L210 120" />
          <circle cx="210" cy="130" r="36" />
          <circle cx="210" cy="130" r="22" strokeWidth="1.5" opacity="0.6" />
          <path d="M210 166 L210 280" strokeWidth="2.5" />
          <path d="M140 280 L280 280" strokeWidth="3" />
          <path d="M160 280 L160 420" />
          <path d="M260 280 L260 420" />
          <path d="M120 420 L300 420" strokeWidth="3.5" />
          <path d="M100 420 L320 420" strokeWidth="1.5" opacity="0.5" />
          <rect x="175" y="200" width="70" height="48" rx="6" strokeWidth="1.8" />
          <path d="M210 248 L210 280" />
          <ellipse cx="210" cy="400" rx="48" ry="10" fill="#5B3FD6" fillOpacity="0.08" stroke="none" />
          <path d="M248 130 L310 90" strokeWidth="1.5" />
          <circle cx="318" cy="84" r="8" />
          <path d="M172 130 L110 90" strokeWidth="1.5" />
          <circle cx="102" cy="84" r="8" />
        </g>
        <g opacity="0.08" fill="#93C5FD">
          <circle cx="210" cy="130" r="8" />
        </g>
      </svg>

      {/* Bottom: glass slides / blood smear */}
      <svg className="login-scene__slides" viewBox="0 0 900 120" preserveAspectRatio="xMidYMid meet">
        <g opacity="0.12">
          <rect x="80" y="40" width="220" height="56" rx="4" fill="#FFFFFF" stroke="#C4B5FD" strokeWidth="1.5" />
          <rect x="100" y="52" width="180" height="32" rx="2" fill="#5B3FD6" opacity="0.12" />
          <ellipse cx="140" cy="68" rx="18" ry="10" fill="#5B3FD6" opacity="0.15" />
          <ellipse cx="200" cy="72" rx="22" ry="11" fill="#93C5FD" opacity="0.2" />
          <ellipse cx="250" cy="66" rx="14" ry="8" fill="#5B3FD6" opacity="0.12" />

          <rect x="340" y="48" width="200" height="48" rx="4" fill="#FFFFFF" stroke="#C4B5FD" strokeWidth="1.5" />
          <rect x="358" y="58" width="164" height="28" rx="2" fill="#5B3FD6" opacity="0.1" />

          <rect x="580" y="44" width="240" height="52" rx="4" fill="#FFFFFF" stroke="#C4B5FD" strokeWidth="1.5" />
          <rect x="602" y="56" width="196" height="28" rx="2" fill="#5B3FD6" opacity="0.11" />
          <ellipse cx="650" cy="70" rx="20" ry="10" fill="#5B3FD6" opacity="0.14" />
          <ellipse cx="720" cy="74" rx="16" ry="9" fill="#93C5FD" opacity="0.18" />
        </g>
      </svg>
    </div>
  );
}
