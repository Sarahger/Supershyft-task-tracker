import clsx from 'clsx';
import { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, ...props }, ref) => (
    <div className="space-y-1.5">
      {label && <label className="block text-xs font-medium text-text-secondary">{label}</label>}
      <input
        ref={ref}
        className={clsx('input', error && 'border-red-400', className)}
        {...props}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
);

Input.displayName = 'Input';

export function Textarea({ label, className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-xs font-medium text-text-secondary">{label}</label>}
      <textarea className={clsx('input resize-none', className)} {...props} />
    </div>
  );
}

export function Select({ label, options, className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string; options: { value: string; label: string }[] }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-xs font-medium text-text-secondary">{label}</label>}
      <select className={clsx('input', className)} {...props}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
