'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '../lib/utils';
import RefreshControl from './RefreshControl';

const LINKS = [
  { href: '/', label: 'Calendar' },
  { href: '/dashboard', label: 'Dashboard' },
];

export function TopNav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-8 px-6">
        <Link href="/" className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
          <span aria-hidden className="size-2.5 rounded-sm bg-accent" />
          Marketing Intelligence
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-1">
          {LINKS.map(l => {
            const active = l.href === '/' ? pathname === '/' : pathname.startsWith(l.href);
            return (
              <Link key={l.href} href={l.href} aria-current={active ? 'page' : undefined}
                className={cn('rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto"><RefreshControl /></div>
      </div>
    </header>
  );
}
