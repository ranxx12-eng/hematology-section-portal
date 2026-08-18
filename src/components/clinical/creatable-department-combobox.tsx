'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface CreatableDepartmentComboboxProps {
  id?: string;
  label?: string;
  value: string;
  options: readonly string[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  onChange: (value: string) => void;
}

export function CreatableDepartmentCombobox({
  id,
  label = 'Department',
  value,
  options,
  placeholder = 'Select or type department',
  disabled = false,
  required = false,
  onChange,
}: CreatableDepartmentComboboxProps) {
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const base = needle
      ? options.filter((option) => option.toLowerCase().includes(needle))
      : [...options];

    if (query.trim() && !options.some((option) => option.toLowerCase() === query.trim().toLowerCase())) {
      base.unshift(query.trim());
    }

    return [...new Set(base)];
  }, [options, query]);

  const commitValue = (next: string) => {
    const trimmed = next.trim();
    setQuery(trimmed);
    onChange(trimmed);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required ? ' *' : ''}
      </Label>
      <div className="relative">
        <Input
          id={id}
          value={query}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          autoComplete="off"
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commitValue(query);
            }
            if (event.key === 'Escape') {
              setOpen(false);
              setQuery(value);
            }
          }}
          onBlur={() => {
            const trimmed = query.trim();
            if (trimmed !== value) {
              onChange(trimmed);
            }
          }}
          className="pe-10"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute end-0 top-0 h-10 px-3"
          disabled={disabled}
          onClick={() => setOpen((prev) => !prev)}
          aria-label="Toggle department options"
        >
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </Button>
        {open && !disabled && filteredOptions.length > 0 && (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-border bg-background shadow-md"
          >
            {filteredOptions.map((option) => (
              <li key={option}>
                <button
                  type="button"
                  role="option"
                  aria-selected={option === value}
                  className={cn(
                    'flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-muted',
                    option === value && 'bg-muted',
                  )}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => commitValue(option)}
                >
                  <span>{option}</span>
                  {option === value && <Check className="h-4 w-4 text-primary" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
