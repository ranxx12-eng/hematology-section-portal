'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { useLocale, useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import Link from 'next/link';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoginScene } from '@/components/auth/login-scene';
import { PortalLogo } from '@/components/shared/portal-logo';
import { useAuth } from '@/components/providers/auth-provider';
import { resolveSafeNextPath } from '@/lib/auth/safe-redirect';
import '@/styles/login-page.css';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  remember: z.boolean().optional(),
});

type LoginForm = z.infer<typeof loginSchema>;

function LoginPageContent() {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const { login, user, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const postLoginPath = resolveSafeNextPath(searchParams.get('next'), locale);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { remember: false },
  });

  useRouteReplace(!isLoading && !!user, postLoginPath);

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
    router.push(postLoginPath);
  };

  return (
    <div className="login-page">
      <LoginScene />

      <div className="login-card">
        <div className="login-card__header">
          <div className="login-card__logo">
            <PortalLogo imageClassName="h-14 w-auto max-w-[4rem]" />
          </div>
          <h1 className="login-card__title">{t('loginTitle')}</h1>
          <p className="login-card__subtitle">{t('loginSubtitle')}</p>
          <div className="login-card__divider" aria-hidden="true">
            <span className="login-card__divider-line" />
            <span className="login-card__divider-diamond" />
            <span className="login-card__divider-line" />
          </div>
        </div>

        <div className="login-card__body">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="sr-only">{t('email')}</label>
              <div className="login-card__field">
                <Mail className="login-card__field-icon" aria-hidden="true" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder={t('email')}
                  className="login-card__input"
                  {...register('email')}
                />
              </div>
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="sr-only">{t('password')}</label>
              <div className="login-card__field">
                <Lock className="login-card__field-icon" aria-hidden="true" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder={t('password')}
                  className="login-card__input login-card__input--password"
                  {...register('password')}
                />
                <button
                  type="button"
                  className="login-card__field-toggle"
                  aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>

            <div className="login-card__options">
              <label className="login-card__remember">
                <input type="checkbox" {...register('remember')} />
                {t('rememberMe')}
              </label>
              <Link href={`/${locale}/forgot-password`} className="login-card__forgot">
                {t('forgotPassword')}
              </Link>
            </div>

            <Button type="submit" className="login-card__submit" disabled={loading}>
              {loading ? tc('loading') : t('signIn')}
            </Button>
          </form>
        </div>
      </div>

      <p className="login-page__footer">{t('loginFooter')}</p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}
