'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { OperationalRecordModule } from '@/lib/records/registry';

export function ViewDeletedRecordsLink({
  module,
  locale,
}: {
  module: OperationalRecordModule;
  locale: string;
}) {
  return (
    <Button variant="outline" size="sm" asChild>
      <Link href={`/${locale}/administration/deleted-records?module=${module}`}>
        View Deleted
      </Link>
    </Button>
  );
}
