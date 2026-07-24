'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function UnauthorizedPage() {
  const tc = useTranslations('common');
  const locale = useLocale();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-dark-navy via-medical-blue/20 to-sky-blue/10 p-4">
      <Card className="w-full max-w-md shadow-xl text-center">
        <CardHeader className="space-y-4">
          <div className="mx-auto rounded-full bg-red-100 p-4 w-fit">
            <ShieldOff className="h-10 w-10 text-red-600" />
          </div>
          <CardTitle className="text-2xl">{tc('unauthorized')}</CardTitle>
          <CardDescription>You do not have permission to access this resource.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button asChild>
            <Link href={`/${locale}/dashboard`}>{tc('dashboard')}</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/${locale}/login`}>{tc('login')}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
