import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';

type Props = { open: boolean; title: string; onClose: () => void; children: ReactNode };
export function Modal({ open, title, onClose, children }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return createPortal(<dialog ref={dialogRef} className="modal" onClose={onClose} onClick={(event) => {
    if (event.target === dialogRef.current) onClose();
  }} aria-label={title}>
    <div className="modal__header"><h2>{title}</h2><Button variant="ghost" onClick={onClose} aria-label="Закрыть окно">×</Button></div>
    {children}
  </dialog>, document.body);
}
