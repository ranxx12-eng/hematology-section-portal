'use client';

import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface MultiSelectFieldProps {
  id?: string;
  label: string;
  options: readonly string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  disabled?: boolean;
  required?: boolean;
  searchPlaceholder?: string;
}

export function MultiSelectField({
  id,
  label,
  options,
  selected,
  onChange,
  disabled = false,
  required = false,
  searchPlaceholder = 'Search...',
}: MultiSelectFieldProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(
    () => options.filter((option) => option.toLowerCase().includes(search.trim().toLowerCase())),
    [options, search],
  );

  const toggle = (value: string) => {
    if (disabled) return;
    onChange(
      selected.includes(value)
        ? selected.filter((item) => item !== value)
        : [...selected, value],
    );
  };

  const remove = (value: string) => {
    if (disabled) return;
    onChange(selected.filter((item) => item !== value));
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}{required ? ' *' : ''}</Label>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((item) => (
            <Badge key={item} variant="secondary" className="gap-1 pe-1">
              {item}
              {!disabled && (
                <button
                  type="button"
                  className="rounded-sm hover:bg-muted-foreground/20 p-0.5"
                  aria-label={`Remove ${item}`}
                  onClick={() => remove(item)}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}
      <Input
        id={id}
        placeholder={searchPlaceholder}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        disabled={disabled}
      />
      <div className="max-h-40 overflow-y-auto rounded-lg border border-border p-3 space-y-2">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No matching options.</p>
        ) : (
          filtered.map((option) => (
            <label key={option} className="flex items-start gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={selected.includes(option)}
                onCheckedChange={() => toggle(option)}
                disabled={disabled}
              />
              <span>{option}</span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}
