import { cn } from '../../lib/utils';

export function Section({ title, description, source, action, children }: {
  title: string; description?: string; source?: string; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section className="mt-14 first:mt-0">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {description && <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">{description}</p>}
        </div>
        <div className="flex items-center gap-3">
          {source && <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-muted-foreground">{source}</span>}
          {action}
        </div>
      </div>
      {children}
    </section>
  );
}

export function Card({ title, subtitle, className, children }: { title?: string; subtitle?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('rounded-lg border border-border bg-surface p-5', className)}>
      {title && <h3 className="text-sm font-semibold">{title}</h3>}
      {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      <div className={title ? 'mt-4' : ''}>{children}</div>
    </div>
  );
}
