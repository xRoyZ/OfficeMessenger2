import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useInRouterContext } from 'react-router-dom';
import { cn } from './cn';

export interface DropdownMenuItem {
  label: string;
  to?: string;
  onSelect?: () => void;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
}

export interface DropdownMenuProps {
  label: string;
  trigger: ReactNode;
  items: DropdownMenuItem[];
  placement?: 'top' | 'bottom';
  align?: 'start' | 'end';
  triggerClassName?: string;
  className?: string;
}

export function DropdownMenu({
  label,
  trigger,
  items,
  placement = 'bottom',
  align = 'start',
  triggerClassName,
  className,
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inRouter = useInRouterContext();

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const itemClasses = (item: DropdownMenuItem) =>
    cn('dropdown__item', item.danger && 'is-danger');

  const selectItem = (item: DropdownMenuItem) => {
    if (item.disabled) {
      return;
    }
    setOpen(false);
    item.onSelect?.();
  };

  return (
    <div className={cn('dropdown', className)} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={cn('dropdown__trigger', triggerClassName)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((current) => !current)}
      >
        {trigger}
      </button>
      {open ? (
        <div
          className={cn(
            'dropdown__menu',
            align === 'end' && 'dropdown__menu--end',
            placement === 'top' && 'dropdown__menu--top',
          )}
          role="menu"
          aria-label={label}
        >
          {items.map((item, index) => {
            if (item.to && !item.disabled) {
              const content = (
                <>
                  {item.icon}
                  <span>{item.label}</span>
                </>
              );

              return inRouter ? (
                <Link
                  key={item.to + index}
                  to={item.to}
                  role="menuitem"
                  className={itemClasses(item)}
                  onClick={() => {
                    setOpen(false);
                    item.onSelect?.();
                  }}
                >
                  {content}
                </Link>
              ) : (
                <a
                  key={item.to + index}
                  href={item.to}
                  role="menuitem"
                  className={itemClasses(item)}
                  onClick={() => {
                    setOpen(false);
                    item.onSelect?.();
                  }}
                >
                  {content}
                </a>
              );
            }

            return (
              <button
                key={`${item.label}-${index}`}
                type="button"
                role="menuitem"
                className={itemClasses(item)}
                disabled={item.disabled}
                onClick={() => selectItem(item)}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
