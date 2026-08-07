'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { UserManagementPanel } from '@/components/admin/cms/user-management-panel';
import { PRODUCTION_ROLES, ROLE_LABELS, ROLE_PERMISSIONS } from '@/lib/permissions/roles';
import type { Role } from '@/lib/permissions/roles';

export { UserManagementPanel };

export function RoleManagementPanel() {
  return (
    <Card>
      <CardHeader><CardTitle>Role Management</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {PRODUCTION_ROLES.map((role) => (
          <div key={role} className="rounded-lg border border-border p-3">
            <p className="font-medium">{ROLE_LABELS[role].en}</p>
            <p className="text-xs text-muted-foreground">{ROLE_PERMISSIONS[role].length} permissions assigned</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function PermissionManagementPanel() {
  return (
    <Card>
      <CardHeader><CardTitle>Permission Matrix</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr><th className="text-start p-2">Role</th><th className="text-start p-2">Permissions</th></tr></thead>
          <tbody>
            {PRODUCTION_ROLES.map((role: Role) => (
              <tr key={role} className="border-t border-border">
                <td className="p-2 font-medium whitespace-nowrap">{ROLE_LABELS[role].en}</td>
                <td className="p-2"><div className="flex flex-wrap gap-1">{ROLE_PERMISSIONS[role].slice(0, 8).map((p) => <Badge key={p} variant="outline" className="text-xs">{p}</Badge>)}<Badge variant="secondary" className="text-xs">+{Math.max(0, ROLE_PERMISSIONS[role].length - 8)}</Badge></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

interface ConfigProps {
  branding: import('@/types/cms-admin').BrandingConfig;
  homepage: import('@/types/cms-admin').HomepageConfig;
  dashboardWidgets: import('@/types/cms-admin').DashboardWidgetConfig[];
  onBrandingChange: (b: import('@/types/cms-admin').BrandingConfig) => void;
  onHomepageChange: (h: import('@/types/cms-admin').HomepageConfig) => void;
  onWidgetsChange: (w: import('@/types/cms-admin').DashboardWidgetConfig[]) => void;
}

export function BrandingPanel({ branding, onBrandingChange }: Pick<ConfigProps, 'branding' | 'onBrandingChange'>) {
  return (
    <Card>
      <CardHeader><CardTitle>Branding</CardTitle></CardHeader>
      <CardContent className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2"><label className="text-sm font-medium">App Title</label><input className="flex h-10 w-full rounded-lg border border-border px-3 text-sm" value={branding.appTitle} onChange={(e) => onBrandingChange({ ...branding, appTitle: e.target.value })} /></div>
        <div className="space-y-2"><label className="text-sm font-medium">Tagline</label><input className="flex h-10 w-full rounded-lg border border-border px-3 text-sm" value={branding.tagline} onChange={(e) => onBrandingChange({ ...branding, tagline: e.target.value })} /></div>
        <div className="space-y-2"><label className="text-sm font-medium">Primary</label><input type="color" value={branding.primaryColor} onChange={(e) => onBrandingChange({ ...branding, primaryColor: e.target.value })} /></div>
        <div className="space-y-2"><label className="text-sm font-medium">Accent</label><input type="color" value={branding.accentColor} onChange={(e) => onBrandingChange({ ...branding, accentColor: e.target.value })} /></div>
      </CardContent>
    </Card>
  );
}

export function HomepageConfigPanel({ homepage, onHomepageChange }: Pick<ConfigProps, 'homepage' | 'onHomepageChange'>) {
  return (
    <Card>
      <CardHeader><CardTitle>Homepage Configuration</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2"><label className="text-sm font-medium">Hero Title</label><input className="flex h-10 w-full rounded-lg border border-border px-3 text-sm" value={homepage.heroTitle} onChange={(e) => onHomepageChange({ ...homepage, heroTitle: e.target.value })} /></div>
        <div className="space-y-2"><label className="text-sm font-medium">Hero Subtitle</label><input className="flex h-10 w-full rounded-lg border border-border px-3 text-sm" value={homepage.heroSubtitle} onChange={(e) => onHomepageChange({ ...homepage, heroSubtitle: e.target.value })} /></div>
        <div className="flex items-center gap-2"><Switch checked={homepage.showSpecialtyBadges} onCheckedChange={(v) => onHomepageChange({ ...homepage, showSpecialtyBadges: v })} /><label className="text-sm">Show Specialty Badges</label></div>
        <div className="flex items-center gap-2"><Switch checked={homepage.showPhotoGallery} onCheckedChange={(v) => onHomepageChange({ ...homepage, showPhotoGallery: v })} /><label className="text-sm">Show Photo Gallery</label></div>
      </CardContent>
    </Card>
  );
}

export function DashboardConfigPanel({ dashboardWidgets, onWidgetsChange }: Pick<ConfigProps, 'dashboardWidgets' | 'onWidgetsChange'>) {
  return (
    <Card>
      <CardHeader><CardTitle>Dashboard Widget Configuration</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {[...dashboardWidgets].sort((a, b) => a.sortOrder - b.sortOrder).map((w, i) => (
          <div key={w.type} className="flex items-center justify-between rounded-lg border border-border p-3">
            <span className="text-sm font-medium capitalize">{w.type.replace(/_/g, ' ')}</span>
            <div className="flex items-center gap-2">
              <Switch checked={w.enabled} onCheckedChange={(v) => onWidgetsChange(dashboardWidgets.map((x) => x.type === w.type ? { ...x, enabled: v } : x))} />
              <button type="button" className="text-xs px-2" onClick={() => { if (i === 0) return; const s = [...dashboardWidgets].sort((a, b) => a.sortOrder - b.sortOrder); [s[i - 1], s[i]] = [s[i], s[i - 1]]; onWidgetsChange(s.map((x, j) => ({ ...x, sortOrder: j }))); }}>↑</button>
              <button type="button" className="text-xs px-2" onClick={() => { if (i === dashboardWidgets.length - 1) return; const s = [...dashboardWidgets].sort((a, b) => a.sortOrder - b.sortOrder); [s[i], s[i + 1]] = [s[i + 1], s[i]]; onWidgetsChange(s.map((x, j) => ({ ...x, sortOrder: j }))); }}>↓</button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
