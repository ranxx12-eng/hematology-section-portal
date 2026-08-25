'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { useLocale, useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoginScene } from '@/components/auth/login-scene';
import { PortalLogo } from '@/components/shared/portal-logo';
import { useAuth } from '@/components/providers/auth-provider';
import '@/styles/login-page.css';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  remember: z.boolean().optional(),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const { login, user, isLoading } = useAuth();
  const router = useRouter();
  const locale = useLocale();
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { remember: false },
  });

  useRouteReplace(!isLoading && !!user, `/${locale}/dashboard`);

  if (isLoading || user) {
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
    <div className="login-page">
      <LoginScene />

      <div className="login-card">
        <div className="login-card__header">
          <div className="login-card__logo">
            <PortalLogo imageClassName="h-16 w-auto max-w-[4.5rem]" />
          </div>
          <h1 className="login-card__title">{t('loginTitle')}</h1>
          <p className="login-card__subtitle">{t('loginSubtitle')}</p>
          <div className="login-card__divider" aria-hidden="true" />
        </div>

        <div className="login-card__body">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t('email')}</Label>
              <Input id="email" type="email" placeholder="you@hospital.org" {...register('email')} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t('password')}</Label>
              <Input id="password" type="password" placeholder="••••••••" {...register('password')} />
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>
            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" {...register('remember')} className="rounded accent-primary" />
                {t('rememberMe')}
              </label>
              <Link href={`/${locale}/forgot-password`} className="text-sm text-primary hover:text-primary/80 hover:underline shrink-0">
                {t('forgotPassword')}
              </Link>
            </div>
            <Button type="submit" className="login-card__submit" disabled={loading}>
              {loading ? tc('loading') : tc('login')}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
