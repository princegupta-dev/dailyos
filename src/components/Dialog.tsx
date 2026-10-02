import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';

interface DialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Modal built on the native <dialog> element, which provides focus trapping, Escape to
 * close, and inert background content in supporting browsers (including iOS Safari 15.4+).
 */
export function Dialog({ open, title, onClose, children, footer }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      {open && (
        <div className="dialog__panel">
          <header className="dialog__header">
            <h2 id={titleId} className="dialog__title">
              {title}
            </h2>
            <button
              type="button"
              className="icon-button icon-button--plain"
              aria-label="Close"
              onClick={onClose}
            >
              <X size={20} aria-hidden="true" />
            </button>
          </header>
          <div className="dialog__body">{children}</div>
          {footer && <footer className="dialog__footer">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  destructive = false,
  pending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="button button--secondary" onClick={onCancel}>
            Keep as is
          </button>
          <button
            type="button"
            className={`button ${destructive ? 'button--danger' : 'button--primary'}`}
            onClick={onConfirm}
            disabled={pending}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="dialog__message">{message}</div>
    </Dialog>
  );
}
