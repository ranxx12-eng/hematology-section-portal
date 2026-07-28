'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/components/providers/auth-provider';
import { ROLE_LABELS } from '@/lib/permissions/roles';
import { getMockDatabase, saveMockDatabase, setStoredAuth } from '@/lib/mock/store';
import { appendAuditLog } from '@/lib/page-utils';
import Link from 'next/link';

export default function ProfilePage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const { user } = useAuth();
  const [fullName, setFullName] = useState('');
  const [language, setLanguage] = useState<'en' | 'ar'>('en');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName(user.fullName);
      setLanguage(user.language);
    }
  }, [user]);

  if (!user) return null;

  const handleSave = () => {
    setSaving(true);
    const db = getMockDatabase();
    const updated = { ...user, fullName, language, updatedAt: new Date().toISOString() };
    appendAuditLog(db, user.id, 'update', 'profile', user.id);
    saveMockDatabase(db);
    setStoredAuth(updated, !!localStorage.getItem('hematology-portal-auth'));
    setSaving(false);
    toast.success('Profile updated');
  };

  const roleLabel = ROLE_LABELS[user.role]?.[locale as 'en' | 'ar'] ?? user.role;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">{tc('profile')}</h1>
        <p className="text-muted-foreground">Manage your account settings</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <div className="rounded-full bg-primary/10 p-3">
            <User className="h-8 w-8 text-primary" />
          </div>
          <div>
            <CardTitle>{user.fullName}</CardTitle>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            <Badge className="mt-1">{roleLabel}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={user.email} disabled />
          </div>
          <div className="space-y-2">
            <Label>Language</Label>
            <Select value={language} onValueChange={(v) => setLanguage(v as 'en' | 'ar')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="ar">العربية</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-3 pt-2">
            <Button onClick={handleSave} disabled={saving}>{saving ? tc('loading') : tc('save')}</Button>
            <Button variant="outline" asChild>
              <Link href={`/${locale}/change-password`}>Change Password</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
