import { useEffect, useRef } from "react";
import { Button } from "../../components/ui/Button";

export function ProfileLeaveDialog({
  onStay,
  onLeave,
}: {
  onStay: () => void;
  onLeave: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const stay = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = dialog.current;
    if (node?.showModal) node.showModal();
    else node?.setAttribute("open", "");
    stay.current?.focus();
    return () => {
      node?.close?.();
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="student-leave-dialog"
      aria-labelledby="leave-profile-title"
      aria-describedby="leave-profile-description"
      onCancel={(event) => {
        event.preventDefault();
        onStay();
      }}
    >
      <h2 id="leave-profile-title">Несохранённые изменения профиля</h2>
      <p id="leave-profile-description">
        Останьтесь, чтобы сохранить изменения. При уходе введённые данные будут
        потеряны.
      </p>
      <div className="student-actions">
        <button
          ref={stay}
          type="button"
          className="button button--primary"
          onClick={onStay}
        >
          Остаться
        </button>
        <Button variant="secondary" onClick={onLeave}>
          Уйти без сохранения
        </Button>
      </div>
    </dialog>
  );
}
