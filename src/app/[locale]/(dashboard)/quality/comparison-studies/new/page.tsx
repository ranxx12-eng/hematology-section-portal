'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PageContentSections } from '@/components/page-content/page-content-sections';
import { useRouteReplace } from '@/hooks/use-route-replace';
import { createComparisonStudyDraft } from '@/lib/clinical/comparison-studies';
import { resolveStaffContext } from '@/lib/clinical/staff-context';
import {
  COMPARISON_STUDY_TYPES,
  COMPARISON_TYPES,
  comparisonTypeRequiresInstruments,
} from '@/lib/comparison-studies/constants';
import {
  canCreateComparisonStudies,
  canViewComparisonStudies,
} from '@/lib/comparison-studies/permissions';
import type { ComparisonSectionCode, ComparisonStudyType } from '@/types/comparison-study';

const SECTION_OPTIONS: ComparisonSectionCode[] = ['CBC', 'COAGULATION', 'ESR'];

export default function NewComparisonStudyPage() {
  const locale = useLocale();
  const router = useRouter();
  const { can, user } = useAuth();
  const accessDenied = !canViewComparisonStudies(can) || !canCreateComparisonStudies(can);
  useRouteReplace(accessDenied, `/${locale}/unauthorized`);

  const [selectedType, setSelectedType] = useState<ComparisonStudyType | null>(null);
  const [creating, setCreating] = useState(false);
  const [sections, setSections] = useState<ComparisonSectionCode[]>(['CBC']);
  const [setup, setSetup] = useState({
    studyTitle: '',
    comparisonType: COMPARISON_TYPES[0] as string,
    studyDate: new Date().toISOString().slice(0, 10),
    purpose: '',
    referenceLabel: '',
    comparisonLabel: '',
  });

  const createStudy = async (studyType: ComparisonStudyType) => {
    if (!user) return;
    if (studyType === 'standard_comparison') {
      if (!setup.studyTitle.trim()) {
        toast.error('Study title is required');
        return;
      }
      if (sections.length === 0) {
        toast.error('Select at least one section');
        return;
      }
    }

    setCreating(true);
    const staff = await resolveStaffContext(user);
    const result = await createComparisonStudyDraft(
      staff,
      studyType,
      studyType === 'standard_comparison'
        ? {
            ...setup,
            studyTitle: setup.studyTitle.trim(),
            sections,
          }
        : undefined,
    );
    setCreating(false);

    if (result.error || !result.data) {
      toast.error(result.error ?? 'Failed to create study');
      return;
    }
    router.push(`/${locale}/quality/comparison-studies/${result.data.id}`);
  };

  return (
    <PageContentSections pageKey="dashboard" fallbackTitle="New Comparison Study" fallbackSubtitle="Choose study type">
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/${locale}/quality/comparison-studies`}><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">New Comparison Study</h1>
            <p className="text-muted-foreground">Choose study type to begin</p>
          </div>
        </div>

        {!selectedType ? (
          <div className="grid gap-4">
            {COMPARISON_STUDY_TYPES.map((type) => (
              <Card
                key={type.key}
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => setSelectedType(type.key)}
              >
                <CardHeader>
                  <CardTitle>{type.label}</CardTitle>
                  <CardDescription>{type.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : selectedType === 'standard_comparison' ? (
          <Card>
            <CardHeader>
              <CardTitle>Standard Comparison Study Setup</CardTitle>
              <CardDescription>Form-Hema-013 · Configure study before entering results</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Study Title</Label>
                <Input value={setup.studyTitle} onChange={(e) => setSetup((p) => ({ ...p, studyTitle: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Comparison Type</Label>
                <Select value={setup.comparisonType} onValueChange={(v) => setSetup((p) => ({ ...p, comparisonType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COMPARISON_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Study Date</Label>
                <Input type="date" value={setup.studyDate} onChange={(e) => setSetup((p) => ({ ...p, studyDate: e.target.value }))} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Reason / Purpose</Label>
                <Textarea value={setup.purpose} onChange={(e) => setSetup((p) => ({ ...p, purpose: e.target.value }))} rows={2} />
              </div>
              {!comparisonTypeRequiresInstruments(setup.comparisonType) && (
                <>
                  <div className="space-y-2">
                    <Label>Reference / Previous Side</Label>
                    <Input value={setup.referenceLabel} onChange={(e) => setSetup((p) => ({ ...p, referenceLabel: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Comparison / New Side</Label>
                    <Input value={setup.comparisonLabel} onChange={(e) => setSetup((p) => ({ ...p, comparisonLabel: e.target.value }))} />
                  </div>
                </>
              )}
              <div className="space-y-2 sm:col-span-2">
                <Label>Sections</Label>
                <div className="flex flex-wrap gap-4">
                  {SECTION_OPTIONS.map((section) => (
                    <label key={section} className="flex items-center gap-2">
                      <Checkbox
                        checked={sections.includes(section)}
                        onCheckedChange={(checked) => {
                          setSections((prev) => checked
                            ? [...prev, section]
                            : prev.filter((s) => s !== section));
                        }}
                      />
                      {section}
                    </label>
                  ))}
                </div>
              </div>
              <div className="sm:col-span-2 flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setSelectedType(null)}>Back</Button>
                <Button disabled={creating} onClick={() => void createStudy('standard_comparison')}>
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Study'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>{COMPARISON_STUDY_TYPES.find((t) => t.key === selectedType)?.label}</CardTitle>
              <CardDescription>Phase 1 — draft shell only</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                {COMPARISON_STUDY_TYPES.find((t) => t.key === selectedType)?.description}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setSelectedType(null)}>Back</Button>
                <Button disabled={creating} onClick={() => void createStudy(selectedType)}>
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Draft'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PageContentSections>
  );
}
