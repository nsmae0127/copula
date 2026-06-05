import { useRef, useState } from "react";
import { Trash2, X } from "lucide-react";
import { useDialogFocusTrap } from "../hooks/useDialogFocusTrap";

interface ConfirmDialogProps {
  title: string;
  body: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
}

export function ConfirmDialog({
  title,
  body,
  confirmLabel = "삭제",
  onCancel,
  onConfirm
}: ConfirmDialogProps) {
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dialogRef = useRef<HTMLElement | null>(null);

  useDialogFocusTrap(dialogRef, () => {
    if (!isSubmitting) onCancel();
  });

  async function confirm() {
    setError("");
    setIsSubmitting(true);

    try {
      await onConfirm();
    } catch (error) {
      setError(error instanceof Error ? error.message : "요청을 처리하지 못했습니다.");
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) onCancel();
      }}
    >
      <section ref={dialogRef} className="confirm-dialog" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onCancel} aria-label="닫기" disabled={isSubmitting}>
            <X aria-hidden="true" />
          </button>
        </div>
        <p className="muted">{body}</p>
        {error ? <p className="status-banner error">{error}</p> : null}
        <div className="button-pair">
          <button className="secondary-button" onClick={onCancel} disabled={isSubmitting}>
            취소
          </button>
          <button className="danger-button" onClick={() => void confirm()} disabled={isSubmitting}>
            <Trash2 aria-hidden="true" />
            {isSubmitting ? "진행 중" : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
