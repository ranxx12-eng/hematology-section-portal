'use client';

import { useLocale } from 'next-intl';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { useAuth } from '@/components/providers/auth-provider';
import { PageContentEditor } from '@/components/page-content/page-content-editor';
import { canManagePageContent } from '@/lib/page-content/constants';

export default function PageContentAdminPage() {
  const locale = useLocale();
  const { can, user } = useAuth();
  const accessDenied = !canManagePageContent(can);

  useRouteReplace(accessDenied, `/${locale}/unauthorized`);

  if (accessDenied || !user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Page Content</h1>
        <p className="text-muted-foreground">
          Manage informational content for dashboard and clinical module pages. Operational forms are not affected.
        </p>
      </div>
      <PageContentEditor userId={user.id} />
    </div>
  );
}
