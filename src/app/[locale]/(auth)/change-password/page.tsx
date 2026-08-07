'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/components/providers/auth-provider';
import { hasSupabaseConfig } from '@/lib/security/env';
import { createClient } from '@/lib/supabase/client';

const schema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(8),
  confirmPassword: z.string().min(8),
}).refine((d) => d.newPassword === d.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });
type FormData = z.infer<typeof schema>;

export default function ChangePasswordPage() {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const locale = useLocale();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    if (!user?.email) {
      toast.error('You must be signed in to change your password.');
      return;
    }

    if (!hasSupabaseConfig()) {
      toast.error('Password change is not configured. Contact your administrator.');
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: data.currentPassword,
    });

    if (signInError) {
      setLoading(false);
      toast.error('Current password is incorrect.');
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: data.newPassword });
    setLoading(false);

    if (error) {
      toast.error('Unable to change password. Try again.');
      return;
    }

    reset();
    toast.success('Password changed successfully.');
  };

  return (
    <div className="min-h-screen flex items-center justify-center auth-gradient p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto rounded-full bg-primary/10 p-4 w-fit">
            <Lock className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-2xl">{t('changePassword')}</CardTitle>
          <CardDescription>{user ? `Signed in as ${user.email}` : 'Update your account password'}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current {t('password')}</Label>
              <Input id="currentPassword" type="password" {...register('currentPassword')} />
              {errors.currentPassword && <p className="text-xs text-red-500">{errors.currentPassword.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New {t('password')}</Label>
              <Input id="newPassword" type="password" {...register('newPassword')} />
              {errors.newPassword && <p className="text-xs text-red-500">{errors.newPassword.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New {t('password')}</Label>
              <Input id="confirmPassword" type="password" {...register('confirmPassword')} />
              {errors.confirmPassword && <p className="text-xs text-red-500">{errors.confirmPassword.message}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? tc('loading') : tc('save')}
            </Button>
            <Link href={user ? `/${locale}/profile` : `/${locale}/login`} className="block text-center text-sm text-accent hover:text-primary hover:underline">
              {user ? `Back to ${tc('profile')}` : `Back to ${tc('login')}`}
            </Link>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
