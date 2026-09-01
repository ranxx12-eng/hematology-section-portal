'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getComparisonStudyTypeDefinition } from '@/lib/comparison-studies/constants';
import type { ComparisonStudyType } from '@/types/comparison-study';

interface SpecializedStudyPlaceholderProps {
  studyType: ComparisonStudyType;
  studyNumber: string;
  status: string;
}

export function SpecializedStudyPlaceholder({
  studyType,
  studyNumber,
  status,
}: SpecializedStudyPlaceholderProps) {
  const definition = getComparisonStudyTypeDefinition(studyType);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>{definition?.label ?? studyType}</CardTitle>
          <Badge variant="secondary">{status.replace(/_/g, ' ')}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{studyNumber}</p>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          {definition?.description ?? 'Dedicated workflow and controlled form will be configured separately.'}
        </p>
      </CardContent>
    </Card>
  );
}
