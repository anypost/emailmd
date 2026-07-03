'use client';

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export { cx };

/* ------------------------------------------------------------------ */
/* Button                                                              */
/* ------------------------------------------------------------------ */

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'ghost' | 'outline' | 'solid' | 'danger';
  size?: 'sm' | 'icon' | 'icon-sm';
}

export function Button({
  variant = 'ghost',
  size = 'sm',
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx('emd-btn', `emd-btn-${variant}`, `emd-btn-${size}`, className)}
      {...rest}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Tooltip (CSS-only)                                                  */
/* ------------------------------------------------------------------ */

export function Tip({
  label,
  side = 'bottom',
  children,
}: {
  label: string;
  side?: 'top' | 'bottom';
  children: ReactNode;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [align, setAlign] = useState<'center' | 'start' | 'end'>('center');

  // A centered tooltip clips at the viewport edges; measure on hover/focus
  // and pin to the trigger's start/end when it wouldn't fit.
  const measure = () => {
    const el = ref.current;
    if (!el) return;
    const width = parseFloat(getComputedStyle(el, '::after').width) || label.length * 7 + 16;
    const rect = el.getBoundingClientRect();
    const center = rect.left + rect.width / 2;
    const margin = 8;
    if (center + width / 2 > window.innerWidth - margin) setAlign('end');
    else if (center - width / 2 < margin) setAlign('start');
    else setAlign('center');
  };

  return (
    <span
      ref={ref}
      className={cx('emd-tip', `emd-tip-${side}`)}
      data-tip={label}
      data-align={align}
      onMouseEnter={measure}
      onFocus={measure}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Popup positioning shared by Menu and Popover                        */
/* ------------------------------------------------------------------ */

function useDismissable(open: boolean, close: () => void) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, close]);

  return rootRef;
}

/* ------------------------------------------------------------------ */
/* Menu (dropdown)                                                     */
/* ------------------------------------------------------------------ */

export function Menu({
  trigger,
  align = 'start',
  className,
  children,
}: {
  /** Render the trigger; receives open state and a toggle callback. */
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  align?: 'start' | 'end';
  className?: string;
  children: ReactNode | ((close: () => void) => ReactNode);
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const rootRef = useDismissable(open, close);

  return (
    <div className="emd-popup-root" ref={rootRef}>
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div
          role="menu"
          className={cx('emd-popup', 'emd-menu', `emd-popup-${align}`, className)}
        >
          {typeof children === 'function' ? children(close) : children}
        </div>
      )}
    </div>
  );
}

export function MenuItem({
  onSelect,
  close,
  children,
  className,
}: {
  onSelect: () => void;
  /** Provided by Menu's render-prop children to close after selection. */
  close?: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={cx('emd-menu-item', className)}
      onClick={() => {
        close?.();
        onSelect();
      }}
    >
      {children}
    </button>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="emd-menu-label">{children}</div>;
}

export function MenuSeparator() {
  return <div className="emd-menu-separator" role="separator" />;
}

/* ------------------------------------------------------------------ */
/* Popover (arbitrary content)                                         */
/* ------------------------------------------------------------------ */

export function Popover({
  trigger,
  align = 'start',
  className,
  children,
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  align?: 'start' | 'end';
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const rootRef = useDismissable(open, close);

  return (
    <div className="emd-popup-root" ref={rootRef}>
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div className={cx('emd-popup', `emd-popup-${align}`, className)}>{children}</div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Modal (native <dialog>)                                             */
/* ------------------------------------------------------------------ */

export function Modal({
  open,
  onClose,
  title,
  description,
  footer,
  size = 'md',
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={cx('emd-modal', `emd-modal-${size}`)}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // Click on the backdrop (the dialog element itself) closes.
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="emd-modal-inner">
        <div className="emd-modal-header">
          <div>
            <h2 className="emd-modal-title">{title}</h2>
            {description && <p className="emd-modal-description">{description}</p>}
          </div>
          <Button size="icon-sm" aria-label="Close" onClick={onClose}>
            <XGlyph />
          </Button>
        </div>
        <div className="emd-modal-body">{children}</div>
        {footer && <div className="emd-modal-footer">{footer}</div>}
      </div>
    </dialog>
  );
}

function XGlyph() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Input / Select / Label                                              */
/* ------------------------------------------------------------------ */

export function Input({
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx('emd-input', className)} {...rest} />;
}

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx('emd-label', className)}>{children}</span>;
}
