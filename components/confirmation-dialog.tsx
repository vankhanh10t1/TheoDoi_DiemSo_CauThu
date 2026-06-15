'use client';

type ConfirmationDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  busyLabel?: string;
  busy?: boolean;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmationDialog({
  open,
  title,
  description,
  confirmLabel,
  busyLabel = 'Đang xử lý...',
  busy = false,
  danger = false,
  onCancel,
  onConfirm
}: ConfirmationDialogProps) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="confirmation-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmation-dialog-title"
        aria-describedby="confirmation-dialog-description"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="confirmation-modal-header">
          <h3 id="confirmation-dialog-title">{title}</h3>
        </div>
        <p id="confirmation-dialog-description" className="confirmation-modal-copy">
          {description}
        </p>
        <div className="confirmation-modal-actions">
          <button className="secondary-button" type="button" onClick={onCancel} disabled={busy}>
            Hủy
          </button>
          <button
            className={danger ? 'danger-button' : 'primary-button'}
            type="button"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
