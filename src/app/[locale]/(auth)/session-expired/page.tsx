'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SessionExpiredPage() {
  const tc = useTranslations('common');
  const locale = useLocale();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-dark-navy via-medical-blue/20 to-sky-blue/10 p-4">
      <Card className="w-full max-w-md shadow-xl text-center">
        <CardHeader className="space-y-4">
          <div className="mx-auto rounded-full bg-amber-100 p-4 w-fit">
            <Clock className="h-10 w-10 text-amber-600" />
          </div>
          <CardTitle className="text-2xl">{tc('sessionExpired')}</CardTitle>
          <CardDescription>Your session has expired. Please sign in again to continue.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href={`/${locale}/login`}>{tc('login')}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
