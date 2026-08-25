import Image from 'next/image';

/** Decorative hematology laboratory background for the public login page. */
export function LoginScene() {
  return (
    <div className="login-scene" aria-hidden="true">
      {/* Ambient lab photograph — tubes left, microscope right */}
      <div className="login-scene__photo-wrap">
        <Image
          src="/images/login/hematology-lab-background.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="login-scene__photo"
        />
      </div>

      <div className="login-scene__side-tint login-scene__side-tint--left" />
      <div className="login-scene__side-tint login-scene__side-tint--right" />
      <div className="login-scene__center-shield" />
      <div className="login-scene__gradient" />
      <div className="login-scene__vignette" />

      {/* Molecular network */}
      <svg className="login-scene__network" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
        <g stroke="#5B3FD6" strokeWidth="0.75" opacity="0.14">
          <line x1="80" y1="60" x2="220" y2="140" />
          <line x1="220" y1="140" x2="360" y2="100" />
          <line x1="360" y1="100" x2="500" y2="180" />
          <line x1="980" y1="80" x2="1120" y2="160" />
          <line x1="1120" y1="160" x2="1260" y2="120" />
          <line x1="1260" y1="120" x2="1360" y2="200" />
        </g>
        <g fill="#5B3FD6" opacity="0.16">
          <circle cx="80" cy="60" r="3.5" />
          <circle cx="220" cy="140" r="3.5" />
          <circle cx="360" cy="100" r="3.5" />
          <circle cx="980" cy="80" r="3.5" />
          <circle cx="1120" cy="160" r="3.5" />
          <circle cx="1260" cy="120" r="3.5" />
        </g>
      </svg>

      {/* Blood cells */}
      <svg className="login-scene__cells" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
        <g fill="#5B3FD6" opacity="0.12">
          <circle cx="160" cy="660" r="30" />
          <circle cx="300" cy="740" r="20" />
          <circle cx="460" cy="700" r="24" />
          <circle cx="980" cy="690" r="22" />
          <circle cx="1140" cy="730" r="18" />
          <circle cx="1280" cy="670" r="26" />
        </g>
        <g fill="none" stroke="#93C5FD" strokeWidth="1.4" opacity="0.14">
          <circle cx="220" cy="820" r="34" />
          <circle cx="520" cy="850" r="26" />
          <circle cx="920" cy="830" r="32" />
          <circle cx="1220" cy="845" r="24" />
        </g>
      </svg>

      {/* Left: specimen tube rack */}
      <svg className="login-scene__tubes" viewBox="0 0 360 520" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="login-tube-glass" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#E9DDFB" stopOpacity="0.65" />
            <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#C4B5FD" stopOpacity="0.55" />
          </linearGradient>
          <linearGradient id="login-tube-cap" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#A78BFA" />
            <stop offset="100%" stopColor="#5B3FD6" />
          </linearGradient>
          <linearGradient id="login-rack" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E9DDFB" />
            <stop offset="100%" stopColor="#DDD6FE" />
          </linearGradient>
        </defs>
        <g opacity="0.34">
          <rect x="16" y="420" width="328" height="18" rx="4" fill="url(#login-rack)" stroke="#C4B5FD" strokeWidth="1.2" />
          <rect x="24" y="404" width="312" height="18" rx="3" fill="#F3EEFF" stroke="#C4B5FD" strokeWidth="1" />
        </g>
        {[
          { x: 28, h: 360, blood: 0.64, cap: '#5B3FD6' },
          { x: 76, h: 400, blood: 0.6, cap: '#7C3AED' },
          { x: 124, h: 380, blood: 0.67, cap: '#5B3FD6' },
          { x: 172, h: 410, blood: 0.58, cap: '#8B5CF6' },
          { x: 220, h: 370, blood: 0.63, cap: '#5B3FD6' },
          { x: 268, h: 390, blood: 0.61, cap: '#6D28D9' },
        ].map((tube, i) => (
          <g key={i} transform={`translate(${tube.x}, ${520 - tube.h})`} opacity="0.36">
            <rect x="8" y="0" width="36" height="16" rx="5" fill="url(#login-tube-cap)" />
            <rect x="10" y="14" width="32" height={tube.h - 14} rx="7" fill="url(#login-tube-glass)" stroke="#A78BFA" strokeWidth="1.2" />
            <rect
              x="13"
              y={14 + (tube.h - 14) * (1 - tube.blood)}
              width="26"
              height={(tube.h - 14) * tube.blood}
              rx="5"
              fill="#5B3FD6"
              opacity="0.28"
            />
            <ellipse cx="26" cy={tube.h - 5} rx="14" ry="3.5" fill="#C4B5FD" opacity="0.45" />
          </g>
        ))}
        {/* Faint slide near tubes */}
        <g opacity="0.22" transform="translate(40, 460) rotate(-8)">
          <rect x="0" y="0" width="120" height="34" rx="3" fill="#FFFFFF" stroke="#C4B5FD" strokeWidth="1.2" />
          <rect x="10" y="8" width="100" height="18" rx="2" fill="#5B3FD6" opacity="0.15" />
          <ellipse cx="36" cy="17" rx="14" ry="7" fill="#5B3FD6" opacity="0.2" />
          <ellipse cx="78" cy="19" rx="12" ry="6" fill="#93C5FD" opacity="0.25" />
        </g>
      </svg>

      {/* Right: laboratory microscope */}
      <svg className="login-scene__microscope" viewBox="0 0 460 560" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="login-scope-body" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#E9DDFB" stopOpacity="0.75" />
          </linearGradient>
        </defs>
        <g opacity="0.38" fill="none" stroke="#5B3FD6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M230 30 L230 118" />
          <circle cx="230" cy="132" r="42" fill="url(#login-scope-body)" />
          <circle cx="230" cy="132" r="26" strokeWidth="1.8" opacity="0.7" />
          <path d="M230 174 L230 300" strokeWidth="2.8" />
          <path d="M150 300 L310 300" strokeWidth="3.2" />
          <path d="M172 300 L172 450" strokeWidth="2.4" />
          <path d="M288 300 L288 450" strokeWidth="2.4" />
          <path d="M128 450 L332 450" strokeWidth="3.6" />
          <path d="M108 450 L352 450" strokeWidth="1.6" opacity="0.45" />
          <rect x="192" y="218" width="76" height="54" rx="8" strokeWidth="2" fill="url(#login-scope-body)" />
          <path d="M230 272 L230 300" />
          <ellipse cx="230" cy="430" rx="54" ry="12" fill="#5B3FD6" fillOpacity="0.1" stroke="none" />
          <path d="M272 132 L342 86" strokeWidth="1.8" />
          <circle cx="352" cy="78" r="10" fill="#93C5FD" fillOpacity="0.35" />
          <path d="M188 132 L118 86" strokeWidth="1.8" />
          <circle cx="108" cy="78" r="10" fill="#93C5FD" fillOpacity="0.35" />
          <rect x="196" y="318" width="68" height="36" rx="6" strokeWidth="1.6" opacity="0.65" />
        </g>
      </svg>

      {/* Bottom: glass slides / blood smear */}
      <svg className="login-scene__slides" viewBox="0 0 960 130" preserveAspectRatio="xMidYMid meet">
        <g opacity="0.2">
          <rect x="60" y="44" width="240" height="60" rx="5" fill="#FFFFFF" stroke="#C4B5FD" strokeWidth="1.5" />
          <rect x="82" y="58" width="196" height="34" rx="3" fill="#5B3FD6" opacity="0.14" />
          <ellipse cx="130" cy="75" rx="20" ry="11" fill="#5B3FD6" opacity="0.2" />
          <ellipse cx="200" cy="78" rx="24" ry="12" fill="#93C5FD" opacity="0.25" />
          <ellipse cx="258" cy="72" rx="16" ry="9" fill="#5B3FD6" opacity="0.16" />

          <rect x="360" y="52" width="220" height="52" rx="5" fill="#FFFFFF" stroke="#C4B5FD" strokeWidth="1.5" />
          <rect x="380" y="64" width="180" height="28" rx="3" fill="#5B3FD6" opacity="0.12" />

          <rect x="620" y="48" width="260" height="56" rx="5" fill="#FFFFFF" stroke="#C4B5FD" strokeWidth="1.5" />
          <rect x="644" y="60" width="212" height="32" rx="3" fill="#5B3FD6" opacity="0.13" />
          <ellipse cx="700" cy="76" rx="22" ry="11" fill="#5B3FD6" opacity="0.18" />
          <ellipse cx="780" cy="80" rx="18" ry="10" fill="#93C5FD" opacity="0.22" />
        </g>
      </svg>
    </div>
  );
}
