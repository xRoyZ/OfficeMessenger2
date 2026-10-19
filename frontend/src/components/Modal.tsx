import {
  useEffect,
  useId,
  useRef,
  type FormEventHandler,
  type ReactNode,
} from 'react';
import { IconButton } from './Button';
import { cn } from './cn';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  warning?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
  closeLabel?: string;
  onSubmit?: FormEventHandler<HTMLFormElement>;
}

function CloseIcon() {
  return (
    <svg className="icon icon--sm" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg className="icon icon--sm" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6M12 17h.01" />
    </svg>
  );
}

export function Modal({
  open,
  onClose,
  title,
  description,
  warning,
  children,
  actions,
  className,
  closeLabel = 'Dialog schließen',
  onSubmit,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (dialog.open) {
      return;
    }

    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const panel = (
    <>
      <div className="dialog__head">
        <div>
          <h2 id={titleId}>{title}</h2>
          {description ? <p id={descriptionId}>{description}</p> : null}
        </div>
        <IconButton
          variant="ghost"
          size="sm"
          label={closeLabel}
          onClick={onClose}
          aria-label={closeLabel}
        >
          <CloseIcon />
        </IconButton>
      </div>
      {warning || children ? (
        <div className="dialog__body">
          {warning ? (
            <div className="dialog__warn">
              <WarningIcon />
              <span>{warning}</span>
            </div>
          ) : null}
          {children}
        </div>
      ) : null}
      {actions ? <div className="dialog__actions">{actions}</div> : null}
    </>
  );

  return (
    <dialog
      ref={dialogRef}
      className={cn('dialog', className)}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) {
          onClose();
        }
      }}
    >
      {onSubmit ? (
        <form className="dialog__panel" onSubmit={onSubmit}>
          {panel}
        </form>
      ) : (
        <div className="dialog__panel">{panel}</div>
      )}
    </dialog>
  );
}

export const Dialog = Modal;
