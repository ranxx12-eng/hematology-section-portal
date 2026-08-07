'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Plus, Trash2, Pin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ImageUploadField, PdfUploadField } from '@/components/admin/image-upload-field';
import { PageManagementPanel } from '@/components/admin/cms/page-management-panel';
import { NavigationManagementPanel } from '@/components/admin/cms/navigation-management-panel';
import {
  UserManagementPanel, RoleManagementPanel, PermissionManagementPanel,
  BrandingPanel, HomepageConfigPanel, DashboardConfigPanel,
} from '@/components/admin/cms/access-config-panels';
import { useAuth } from '@/components/providers/auth-provider';
import { getMockDatabase, saveMockDatabase } from '@/lib/mock/store';
import { createEmptyNewsletter } from '@/lib/mock/portal-content';
import { appendAuditLog } from '@/lib/page-utils';
import { NEWSLETTER_TOPICS } from '@/lib/portal-content/defaults';
import type { PortalContent, LeadershipProfile, ContentSection, Newsletter } from '@/types/portal-content';
import type { CmsAdminState } from '@/types/cms-admin';

export default function AdministrationPage() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const { can, user } = useAuth();
  const [content, setContent] = useState<PortalContent>(() => getMockDatabase().portalContent);
  const [cms, setCms] = useState<CmsAdminState>(() => getMockDatabase().cmsAdmin);
  const [editingNewsletter, setEditingNewsletter] = useState<Newsletter | null>(null);

  const refresh = useCallback(() => {
    const db = getMockDatabase();
    setContent(db.portalContent);
    setCms(db.cmsAdmin);
  }, []);

  const save = () => {
    const db = getMockDatabase();
    db.portalContent = content;
    db.cmsAdmin = cms;
    if (user) appendAuditLog(db, user.id, 'update', 'administration');
    saveMockDatabase(db);
    refresh();
    toast.success('All administration settings saved');
  };

  const accessDenied = !can('settings.manage');


  useRouteReplace(accessDenied, `/${locale}/unauthorized`);


  if (accessDenied) return null;

  const updateLeader = (id: string, patch: Partial<LeadershipProfile>) => {
    setContent((prev) => ({ ...prev, leadership: prev.leadership.map((l) => l.id === id ? { ...l, ...patch } : l) }));
  };

  const updateSection = (id: string, patch: Partial<ContentSection>) => {
    setContent((prev) => ({ ...prev, missionVision: prev.missionVision.map((s) => s.id === id ? { ...s, ...patch, updatedAt: new Date().toISOString() } : s) }));
  };

  const saveNewsletter = () => {
    if (!editingNewsletter?.title.trim()) { toast.error('Newsletter title is required'); return; }
    setContent((prev) => {
      const exists = prev.newsletters.some((n) => n.id === editingNewsletter.id);
      return { ...prev, newsletters: exists ? prev.newsletters.map((n) => n.id === editingNewsletter.id ? { ...editingNewsletter, updatedAt: new Date().toISOString() } : n) : [{ ...editingNewsletter, updatedAt: new Date().toISOString() }, ...prev.newsletters] };
    });
    setEditingNewsletter(null);
    toast.success('Newsletter updated — click Save All');
  };

  const deleteNewsletter = (id: string) => {
    if (!confirm(tc('confirmDelete'))) return;
    setContent((prev) => ({ ...prev, newsletters: prev.newsletters.filter((n) => n.id !== id) }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{tc('administration')}</h1>
          <p className="text-muted-foreground">Enterprise administration — pages, navigation, access control, and portal content</p>
        </div>
        <Button onClick={save}>{tc('save')} All Changes</Button>
      </div>

      <Tabs defaultValue="pages">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="pages">Page Management</TabsTrigger>
          <TabsTrigger value="navigation">Navigation</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="dashboard">Dashboard Config</TabsTrigger>
          <TabsTrigger value="homepage">Homepage</TabsTrigger>
          <TabsTrigger value="images">Portal Images</TabsTrigger>
          <TabsTrigger value="leadership">Leadership</TabsTrigger>
          <TabsTrigger value="mission">Mission & Vision</TabsTrigger>
          <TabsTrigger value="newsletters">Newsletters</TabsTrigger>
        </TabsList>

        <TabsContent value="pages" className="mt-4"><PageManagementPanel cms={cms} onChange={setCms} /></TabsContent>
        <TabsContent value="navigation" className="mt-4"><NavigationManagementPanel cms={cms} onChange={setCms} /></TabsContent>
        <TabsContent value="users" className="mt-4"><UserManagementPanel /></TabsContent>
        <TabsContent value="roles" className="mt-4"><RoleManagementPanel /></TabsContent>
        <TabsContent value="permissions" className="mt-4"><PermissionManagementPanel /></TabsContent>
        <TabsContent value="branding" className="mt-4"><BrandingPanel branding={cms.branding} onBrandingChange={(b) => setCms({ ...cms, branding: b })} /></TabsContent>
        <TabsContent value="dashboard" className="mt-4"><DashboardConfigPanel dashboardWidgets={cms.dashboardWidgets} onWidgetsChange={(w) => setCms({ ...cms, dashboardWidgets: w })} /></TabsContent>
        <TabsContent value="homepage" className="mt-4"><HomepageConfigPanel homepage={cms.homepage} onHomepageChange={(h) => setCms({ ...cms, homepage: h })} /></TabsContent>

        <TabsContent value="images" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Official Dashboard Images</CardTitle></CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              {(Object.keys(content.dashboardImages) as (keyof PortalContent['dashboardImages'])[]).map((key) => (
                <ImageUploadField key={key} label={key.replace(/([A-Z])/g, ' $1')} value={content.dashboardImages[key]} onChange={(url) => setContent((prev) => ({ ...prev, dashboardImages: { ...prev.dashboardImages, [key]: url } }))} />
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leadership" className="mt-4 space-y-4">
          {content.leadership.sort((a, b) => a.sortOrder - b.sortOrder).map((leader) => (
            <Card key={leader.id}>
              <CardHeader><CardTitle>{leader.position}</CardTitle></CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <ImageUploadField label="Official Photo" value={leader.photoUrl} onChange={(url) => updateLeader(leader.id, { photoUrl: url })} />
                <div className="space-y-3">
                  <div><Label>Full Name</Label><Input value={leader.fullName} onChange={(e) => updateLeader(leader.id, { fullName: e.target.value })} /></div>
                  <div><Label>Position</Label><Input value={leader.position} onChange={(e) => updateLeader(leader.id, { position: e.target.value })} /></div>
                  <div><Label>Years of Experience</Label><Input type="number" value={leader.yearsOfExperience} onChange={(e) => updateLeader(leader.id, { yearsOfExperience: Number(e.target.value) })} /></div>
                </div>
                <div className="md:col-span-2 space-y-3">
                  <div><Label>Biography</Label><Textarea rows={4} value={leader.biography} onChange={(e) => updateLeader(leader.id, { biography: e.target.value })} /></div>
                  <div><Label>Qualifications</Label><Textarea rows={2} value={leader.qualifications} onChange={(e) => updateLeader(leader.id, { qualifications: e.target.value })} /></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="mission" className="mt-4 space-y-4">
          {content.missionVision.map((section) => (
            <Card key={section.id}>
              <CardHeader><CardTitle>{section.title}</CardTitle></CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3 md:col-span-2">
                  <div><Label>Title</Label><Input value={section.title} onChange={(e) => updateSection(section.id, { title: e.target.value })} /></div>
                  <div><Label>Content (HTML)</Label><Textarea rows={6} value={section.content} onChange={(e) => updateSection(section.id, { content: e.target.value })} /></div>
                </div>
                <ImageUploadField label="Section Image" value={section.imageUrl ?? ''} onChange={(url) => updateSection(section.id, { imageUrl: url })} />
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="newsletters" className="mt-4 space-y-4">
          <div className="flex justify-end"><Button onClick={() => setEditingNewsletter(createEmptyNewsletter())}><Plus className="h-4 w-4 me-2" />Add Newsletter</Button></div>
          {editingNewsletter && (
            <Card>
              <CardHeader><CardTitle>{editingNewsletter.title || 'New Newsletter'}</CardTitle></CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <div><Label>Title</Label><Input value={editingNewsletter.title} onChange={(e) => setEditingNewsletter({ ...editingNewsletter, title: e.target.value })} /></div>
                  <div><Label>Author</Label><Input value={editingNewsletter.author} onChange={(e) => setEditingNewsletter({ ...editingNewsletter, author: e.target.value })} /></div>
                  <div className="flex items-center gap-2"><Switch checked={editingNewsletter.isPinned} onCheckedChange={(v) => setEditingNewsletter({ ...editingNewsletter, isPinned: v })} /><Label>Pin</Label></div>
                </div>
                <ImageUploadField label="Cover" value={editingNewsletter.coverImageUrl} onChange={(url) => setEditingNewsletter({ ...editingNewsletter, coverImageUrl: url })} />
                <div className="md:col-span-2"><PdfUploadField label="PDF" value={editingNewsletter.pdfDataUrl} onChange={(url) => setEditingNewsletter({ ...editingNewsletter, pdfDataUrl: url })} /></div>
                <div className="md:col-span-2 flex gap-2"><Button onClick={saveNewsletter}>{tc('save')}</Button><Button variant="outline" onClick={() => setEditingNewsletter(null)}>{tc('cancel')}</Button></div>
              </CardContent>
            </Card>
          )}
          {content.newsletters.map((n) => (
            <Card key={n.id}><CardContent className="py-4 flex justify-between"><div><p className="font-medium">{n.title}{n.isPinned && <Pin className="inline h-4 w-4 ms-2 text-primary" />}</p><p className="text-sm text-muted-foreground">{n.publicationDate}</p></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setEditingNewsletter(n)}>{tc('edit')}</Button><Button size="sm" variant="ghost" onClick={() => deleteNewsletter(n.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></CardContent></Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
