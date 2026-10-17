import * as React from 'react';
import { cn } from '../../lib/utils';

const base = 'w-full rounded-md border border-border-strong bg-surface px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-2';
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...p }, ref) => <input ref={ref} className={cn(base, 'h-9', className)} {...p} />);
Input.displayName = 'Input';
export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...p }, ref) => <textarea ref={ref} className={cn(base, 'py-2', className)} {...p} />);
Textarea.displayName = 'Textarea';
export function Label({ className, ...p }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('flex flex-col gap-1.5 text-xs font-medium text-muted-foreground', className)} {...p} />;
}
