import Image from 'next/image';

export const HEMATOLOGY_LOGIN_BACKGROUND_SRC = '/images/hematology-login-background.jpg';

/** Full-page hematology laboratory background for the public login page. */
export function LoginScene() {
  return (
    <div className="login-scene" aria-hidden="true">
      <Image
        src={HEMATOLOGY_LOGIN_BACKGROUND_SRC}
        alt=""
        fill
        priority
        sizes="100vw"
        className="login-scene__photo"
      />
      <div className="login-scene__overlay" />
    </div>
  );
}
