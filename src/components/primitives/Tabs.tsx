'use client';

import { useId, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '@/lib/cn';

export interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
}

interface TabsProps {
  items: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
  /** Scrollable row on mobile (project detail tabs). */
  scrollable?: boolean;
}

/**
 * Keyboard-accessible tabs with a sliding active indicator and
 * crossfading content (approved tab motion).
 */
export function Tabs({ items, activeId, onChange, className, scrollable }: TabsProps) {
  const baseId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

  const activeIndex = items.findIndex((t) => t.id === activeId);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next =
      e.key === 'ArrowRight'
        ? (activeIndex + 1) % items.length
        : (activeIndex - 1 + items.length) % items.length;
    onChange(items[next].id);
    const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    buttons?.[next]?.focus();
  };

  return (
    <div className={className}>
      <div
        ref={listRef}
        role="tablist"
        aria-label="Konten"
        onKeyDown={handleKeyDown}
        className={cn(
          'relative flex gap-0.5 border-b border-sk-border',
          scrollable && 'no-scrollbar overflow-x-auto',
        )}
      >
        {items.map((tab) => {
          const active = tab.id === activeId;
          return (
            <button
              key={tab.id}
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              aria-selected={active}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={active ? 0 : -1}
              onClick={(e) => {
                onChange(tab.id);
                const rect = e.currentTarget.getBoundingClientRect();
                const parent = listRef.current?.getBoundingClientRect();
                if (parent) setIndicator({ left: rect.left - parent.left, width: rect.width });
              }}
              className={cn(
                'relative shrink-0 px-5 py-3.5 text-[13.5px] font-semibold transition-colors duration-200',
                active ? 'text-sk-navy' : 'text-sk-muted hover:text-sk-navy',
              )}
            >
              {tab.label}
            </button>
          );
        })}
        {indicator && (
          <motion.span
            aria-hidden
            className="absolute -bottom-px h-0.5 rounded-full bg-sk-blue"
            initial={false}
            animate={{ left: indicator.left, width: indicator.width }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          />
        )}
        {!indicator && (
          <span
            aria-hidden
            className="absolute -bottom-px h-0.5 rounded-full bg-sk-blue"
            style={{
              left: `${(100 / items.length) * Math.max(0, activeIndex)}%`,
              width: `${100 / items.length}%`,
            }}
          />
        )}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={activeId}
          role="tabpanel"
          id={`${baseId}-panel-${activeId}`}
          aria-labelledby={`${baseId}-tab-${activeId}`}
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -8 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="pt-5"
        >
          {items.find((t) => t.id === activeId)?.content}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
