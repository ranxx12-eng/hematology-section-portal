'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PortalLogo } from '@/components/shared/portal-logo';
import { useAuth } from '@/components/providers/auth-provider';
import { DEMO_USERS } from '@/lib/mock/store';
import Link from 'next/link';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  remember: z.boolean().optional(),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const { login, user } = useAuth();
  const router = useRouter();
  const locale = useLocale();
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { remember: false },
  });

  if (user) {
    router.replace(`/${locale}/dashboard`);
    return null;
  }

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    const result = await login(data.email, data.password, data.remember);
    setLoading(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success('Welcome back!');
    router.push(`/${locale}/dashboard`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center auth-gradient p-4">
      <Card className="w-full max-w-md shadow-xl border-border">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto">
            <PortalLogo imageClassName="h-16 w-16 mx-auto" />
          </div>
          <CardTitle className="text-2xl text-primary">{t('loginTitle')}</CardTitle>
          <CardDescription>{t('loginSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t('email')}</Label>
              <Input id="email" type="email" placeholder="admin@hematology.local" {...register('email')} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t('password')}</Label>
              <Input id="password" type="password" placeholder="••••••••" {...register('password')} />
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" {...register('remember')} className="rounded accent-primary" />
                {t('rememberMe')}
              </label>
              <Link href={`/${locale}/forgot-password`} className="text-sm text-accent hover:text-primary hover:underline">
                {t('forgotPassword')}
              </Link>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? tc('loading') : tc('login')}
            </Button>
          </form>
          <div className="mt-6 p-4 rounded-lg bg-muted/50 text-xs space-y-2">
            <p className="font-medium text-muted-foreground">Demo Accounts (password: Demo@123456)</p>
            {DEMO_USERS.slice(0, 4).map((u) => (
              <button
                key={u.email}
                type="button"
                className="block w-full text-start hover:text-primary transition-colors"
                onClick={() => {
                  const form = document.getElementById('email') as HTMLInputElement;
                  if (form) form.value = u.email;
                }}
              >
                {u.role}: {u.email}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
