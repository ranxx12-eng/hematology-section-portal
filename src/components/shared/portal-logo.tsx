'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { FALLBACK_LOGO_SRC } from '@/lib/portal/official-logo';
import { useOfficialLogo } from '@/hooks/use-official-logo';

interface PortalLogoProps {
  className?: string;
  imageClassName?: string;
  showText?: boolean;
  textClassName?: string;
  subtitle?: string;
}

export function PortalLogo({
  className,
  imageClassName,
  showText = false,
  textClassName,
  subtitle,
}: PortalLogoProps) {
  const t = useTranslations('common');
  const { src } = useOfficialLogo();
  const [logoFailed, setLogoFailed] = useState(false);
  const [useFallback, setUseFallback] = useState(false);

  const logoSrc = useFallback ? FALLBACK_LOGO_SRC : src;

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {logoFailed ? (
        <div
          className={cn(
            'flex items-center justify-center rounded-lg bg-primary/10 text-primary font-semibold',
            imageClassName ?? 'h-10 w-10',
          )}
          aria-hidden
        >
          HS
        </div>
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={logoSrc}
          alt="Hospital Logo"
          className={cn('object-contain rounded-lg bg-white/10 p-1', imageClassName ?? 'h-10 w-auto max-w-[3rem]')}
          onError={() => {
            if (!useFallback && src !== FALLBACK_LOGO_SRC) {
              setUseFallback(true);
              return;
            }
            setLogoFailed(true);
          }}
        />
      )}
      {showText && (
        <div className={textClassName}>
          <p className="text-sm font-bold leading-tight">{t('appName')}</p>
          {subtitle && <p className="text-xs opacity-70 mt-0.5">{subtitle}</p>}
        </div>
      )}
    </div>
  );
}
