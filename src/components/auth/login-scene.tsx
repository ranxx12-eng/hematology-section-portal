import Image from 'next/image';

/** Decorative hematology laboratory background for the public login page. */
export function LoginScene() {
  return (
    <div className="login-scene" aria-hidden="true">
      <Image
        src="/images/login/hematology-lab-background.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="login-scene__photo"
      />

      <div className="login-scene__wash" />
      <div className="login-scene__gradient" />
      <div className="login-scene__vignette" />

      {/* Molecular network — extremely subtle */}
      <svg className="login-scene__network" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
        <g stroke="#5B3FD6" strokeWidth="0.6" opacity="0.07">
          <line x1="120" y1="80" x2="280" y2="160" />
          <line x1="280" y1="160" x2="420" y2="120" />
          <line x1="420" y1="120" x2="560" y2="200" />
          <line x1="900" y1="100" x2="1040" y2="180" />
          <line x1="1040" y1="180" x2="1180" y2="140" />
          <line x1="1180" y1="140" x2="1320" y2="220" />
        </g>
        <g fill="#5B3FD6" opacity="0.06">
          <circle cx="120" cy="80" r="3" />
          <circle cx="280" cy="160" r="3" />
          <circle cx="420" cy="120" r="3" />
          <circle cx="900" cy="100" r="3" />
          <circle cx="1180" cy="140" r="3" />
        </g>
      </svg>

      {/* Blood cells — scattered soft circles */}
      <svg className="login-scene__cells" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
        <g fill="#5B3FD6" opacity="0.05">
          <circle cx="180" cy="640" r="28" />
          <circle cx="320" cy="720" r="18" />
          <circle cx="480" cy="680" r="22" />
          <circle cx="760" cy="700" r="26" />
          <circle cx="1040" cy="680" r="24" />
          <circle cx="1320" cy="660" r="20" />
        </g>
        <g fill="none" stroke="#93C5FD" strokeWidth="1.2" opacity="0.06">
          <circle cx="250" cy="820" r="32" />
          <circle cx="550" cy="850" r="24" />
          <circle cx="850" cy="830" r="30" />
          <circle cx="1150" cy="840" r="22" />
        </g>
      </svg>
    </div>
  );
}
