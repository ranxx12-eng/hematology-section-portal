'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getNavIcon, NAV_ICON_MAP } from '@/lib/cms/icons';
import type { CmsAdminState, NavGroupConfig, NavItemConfig } from '@/types/cms-admin';
import type { Permission } from '@/lib/permissions/roles';
import { PERMISSIONS_LIST } from '@/lib/cms/permissions-list';

interface Props {
  cms: CmsAdminState;
  onChange: (cms: CmsAdminState) => void;
}

export function NavigationManagementPanel({ cms, onChange }: Props) {
  const navigation = cms.navigation;

  const updateNav = (next: NavGroupConfig[]) => onChange({ ...cms, navigation: next });

  const moveGroup = (index: number, dir: -1 | 1) => {
    const next = [...navigation].sort((a, b) => a.sortOrder - b.sortOrder);
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    updateNav(next.map((g, i) => ({ ...g, sortOrder: i })));
  };

  const moveItem = (groupId: string, index: number, dir: -1 | 1) => {
    updateNav(navigation.map((g) => {
      if (g.id !== groupId) return g;
      const items = [...g.items].sort((a, b) => a.sortOrder - b.sortOrder);
      const target = index + dir;
      if (target < 0 || target >= items.length) return g;
      [items[index], items[target]] = [items[target], items[index]];
      return { ...g, items: items.map((it, i) => ({ ...it, sortOrder: i })) };
    }));
  };

  const updateItem = (groupId: string, itemId: string, patch: Partial<NavItemConfig>) => {
    updateNav(navigation.map((g) => g.id === groupId ? { ...g, items: g.items.map((it) => it.id === itemId ? { ...it, ...patch } : it) } : g));
  };

  const updateGroup = (groupId: string, patch: Partial<NavGroupConfig>) => {
    updateNav(navigation.map((g) => g.id === groupId ? { ...g, ...patch } : g));
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Manage sidebar groups, menu items, order, and visibility</p>
      {[...navigation].sort((a, b) => a.sortOrder - b.sortOrder).map((group, gi) => {
        const GroupIcon = getNavIcon(group.icon);
        return (
          <Card key={group.id}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base flex items-center gap-2"><GroupIcon className="h-4 w-4" />{group.labelKey}</CardTitle>
              <div className="flex items-center gap-2">
                <Switch checked={group.visible} onCheckedChange={(v) => updateGroup(group.id, { visible: v })} />
                <Button size="sm" variant="ghost" onClick={() => moveGroup(gi, -1)}>↑</Button>
                <Button size="sm" variant="ghost" onClick={() => moveGroup(gi, 1)}>↓</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {[...group.items].sort((a, b) => a.sortOrder - b.sortOrder).map((item, ii) => {
                const Icon = getNavIcon(item.icon);
                return (
                  <div key={item.id} className="grid md:grid-cols-6 gap-2 items-center rounded-lg border border-border p-3">
                    <div className="flex items-center gap-2 md:col-span-2"><Icon className="h-4 w-4 text-primary" /><Input value={item.labelKey} onChange={(e) => updateItem(group.id, item.id, { labelKey: e.target.value })} className="h-8" /></div>
                    <Input value={item.href} onChange={(e) => updateItem(group.id, item.id, { href: e.target.value })} className="h-8" placeholder="Route" />
                    <Select value={item.icon} onValueChange={(v) => updateItem(group.id, item.id, { icon: v })}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.keys(NAV_ICON_MAP).map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={item.permission ?? 'none'} onValueChange={(v) => updateItem(group.id, item.id, { permission: v === 'none' ? undefined : v as Permission })}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="Permission" /></SelectTrigger>
                      <SelectContent><SelectItem value="none">None</SelectItem>{PERMISSIONS_LIST.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                    </Select>
                    <div className="flex items-center gap-1">
                      <Switch checked={item.visible} onCheckedChange={(v) => updateItem(group.id, item.id, { visible: v })} />
                      <Button size="sm" variant="ghost" onClick={() => moveItem(group.id, ii, -1)}>↑</Button>
                      <Button size="sm" variant="ghost" onClick={() => moveItem(group.id, ii, 1)}>↓</Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
