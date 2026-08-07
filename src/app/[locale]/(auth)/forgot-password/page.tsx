'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { hasSupabaseConfig, getAppUrl } from '@/lib/security/env';
import { createClient } from '@/lib/supabase/client';

const schema = z.object({ email: z.string().email() });
type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const locale = useLocale();
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setLoading(true);

    if (!hasSupabaseConfig()) {
      setLoading(false);
      toast.error('Password reset is not configured. Contact your administrator.');
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${getAppUrl()}/${locale}/reset-password`,
    });

    setLoading(false);
    if (error) {
      toast.error('Unable to send reset email. Verify your address or contact support.');
      return;
    }
    toast.success('If an account exists, a reset link has been sent.');
  };

  return (
    <div className="min-h-screen flex items-center justify-center auth-gradient p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto rounded-full bg-primary/10 p-4 w-fit">
            <Mail className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-2xl">{t('forgotPassword')}</CardTitle>
          <CardDescription>Enter your email to receive a password reset link</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t('email')}</Label>
              <Input id="email" type="email" placeholder="you@hospital.org" {...register('email')} />
              {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? tc('loading') : t('resetPassword')}
            </Button>
            <Link href={`/${locale}/login`} className="block text-center text-sm text-accent hover:text-primary hover:underline">
              Back to {tc('login')}
            </Link>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
