'use client';

import { useRouter } from 'next/navigation';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { useLocale } from 'next-intl';
import { Bot } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/components/providers/auth-provider';

export default function AIAssistantPage() {
  const locale = useLocale();
  const router = useRouter();
  const { can } = useAuth();

  const accessDenied = !can('reports.view') && !can('tasks.view');


  useRouteReplace(accessDenied, `/${locale}/unauthorized`);


  if (accessDenied) return null;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">AI Assistant</h1>
        <p className="text-muted-foreground">Intelligent assistant for the Hematology Section — module expansion ready</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Bot className="h-5 w-5 text-primary" />Coming Soon</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>The AI Assistant module is reserved for future integration with laboratory knowledge bases, SOP guidance, and operational queries.</p>
          <p>All existing portal modules remain fully accessible from the sidebar.</p>
        </CardContent>
      </Card>
    </div>
  );
}
