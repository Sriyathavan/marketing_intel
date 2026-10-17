'use client';
import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

export const Sheet = Dialog.Root;
export const SheetTitle = Dialog.Title;
export const SheetDescription = Dialog.Description;

type Pos = { x: number; y: number };
const DragCtx = React.createContext<React.HTMLAttributes<HTMLElement>>({});

/** Header strip that moves the floating panel when dragged. Buttons inside it stay clickable. */
export function SheetDragHandle({ className, children, ...props }: React.HTMLAttributes<HTMLElement>) {
  const handle = React.useContext(DragCtx);
  return <header {...props} {...handle} className={cn('cursor-grab touch-none select-none active:cursor-grabbing', className)}>{children}</header>;
}

/** Non-modal floating panel. Esc and the close button dismiss it; drag its header to reposition. */
export const SheetContent = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<typeof Dialog.Content>>(
  ({ className, children, style, ...props }, ref) => {
    const el = React.useRef<HTMLDivElement | null>(null);
    const [pos, setPos] = React.useState<Pos | null>(null);
    const drag = React.useRef<{ dx: number; dy: number } | null>(null);

    const handle: React.HTMLAttributes<HTMLElement> = {
      onPointerDown: e => {
        if (e.button !== 0 || (e.target as HTMLElement).closest('button, a, input, textarea')) return;
        const r = el.current?.getBoundingClientRect();
        if (!r) return;
        drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
        e.currentTarget.setPointerCapture(e.pointerId);
      },
      onPointerMove: e => {
        const d = drag.current, r = el.current?.getBoundingClientRect();
        if (!d || !r) return;
        const x = Math.min(Math.max(8 - r.width + 120, e.clientX - d.dx), window.innerWidth - 120);
        const y = Math.min(Math.max(0, e.clientY - d.dy), window.innerHeight - 48);
        setPos({ x, y });
      },
      onPointerUp: e => { drag.current = null; if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); },
      onPointerCancel: () => { drag.current = null; },
    };

    return (
      <Dialog.Portal>
        <Dialog.Content
          ref={n => { el.current = n; if (typeof ref === 'function') ref(n); else if (ref) ref.current = n; }}
          onInteractOutside={e => e.preventDefault()}
          className={cn('fixed right-4 top-[72px] z-50 flex h-[calc(100vh-88px)] w-[min(480px,calc(100vw-32px))] flex-col overflow-hidden rounded-xl border border-border-strong bg-surface shadow-2xl', className)}
          style={pos ? { ...style, left: pos.x, top: pos.y, right: 'auto', height: `min(calc(100vh - 88px), calc(100vh - ${pos.y}px - 8px))` } : style}
          {...props}>
          <DragCtx.Provider value={handle}>{children}</DragCtx.Provider>
          <Dialog.Close aria-label="Close"
            className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="size-4" />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    );
  },
);
SheetContent.displayName = 'SheetContent';
