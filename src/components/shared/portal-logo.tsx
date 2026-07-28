'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { getMockDatabase } from '@/lib/mock/store';
import { cn } from '@/lib/utils';

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
  const logoUrl = useMemo(() => getMockDatabase().portalContent.dashboardImages.hospitalLogo, []);

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logoUrl}
        alt="Hospital Logo"
        className={cn('object-contain rounded-lg bg-white/10 p-1', imageClassName ?? 'h-10 w-10')}
      />
      {showText && (
        <div className={textClassName}>
          <p className="text-sm font-bold leading-tight">{t('appName')}</p>
          {subtitle && <p className="text-xs opacity-70 mt-0.5">{subtitle}</p>}
        </div>
      )}
    </div>
  );
}
