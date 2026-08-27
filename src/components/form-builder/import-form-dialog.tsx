'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ImportFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportFormDialog({ open, onOpenChange }: ImportFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Existing Form</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm text-muted-foreground">
          <p>
            Word (.docx) and Excel (.xlsx, .xls) import is planned for Phase 2. Uploaded source files will be parsed into editable draft fields for manual review before publish.
          </p>
          <p>
            For now, create a new electronic form manually or duplicate an existing form from the library.
          </p>
          <Button className="w-full" onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
