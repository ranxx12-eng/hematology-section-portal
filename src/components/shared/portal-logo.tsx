'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

const DEFAULT_LOGO_SRC = '/images/portal/hospital-logo.svg';

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
  const [logoFailed, setLogoFailed] = useState(false);

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
          src={DEFAULT_LOGO_SRC}
          alt="Hospital Logo"
          className={cn('object-contain rounded-lg bg-white/10 p-1', imageClassName ?? 'h-10 w-10')}
          onError={() => setLogoFailed(true)}
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
