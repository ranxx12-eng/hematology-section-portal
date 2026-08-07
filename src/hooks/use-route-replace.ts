'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Navigate via replace inside useEffect — never during render. */
export function useRouteReplace(when: boolean, href: string) {
  const router = useRouter();

  useEffect(() => {
    if (when) {
      router.replace(href);
    }
  }, [when, href, router]);
}
