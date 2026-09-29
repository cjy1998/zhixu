import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '../lib/cx';
import { Icon } from './Icon';
import u from '../styles/ui.module.css';
import s from './Modal.module.css';

interface ModalProps {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: string;
  onRequestClose: () => void;
  children: ReactNode;
  footer?: { note?: ReactNode; actions?: ReactNode };
  extraClassName?: string;
}

export function Modal({ title, subtitle, icon = 'spark', onRequestClose, children, footer, extraClassName }: ModalProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    returnFocus.current = document.activeElement as HTMLElement | null;
    const root = document.getElementById('root');
    root?.setAttribute('inert', '');
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus({ preventScroll: true });
    return () => {
      root?.removeAttribute('inert');
      document.body.style.overflow = '';
      returnFocus.current?.focus?.();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onRequestClose();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusables = [...dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex="0"]',
      )].filter((el) => el.offsetParent !== null);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onRequestClose]);

  return createPortal(
    <div className={s.modalBackdrop}>
      <section
        ref={dialogRef}
        className={cx(s.modal, extraClassName)}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        tabIndex={-1}
      >
        <header className={s.modalTop}>
          <div className={s.modalTitle}>
            <div className={u.circleIcon}>
              <Icon name={icon} />
            </div>
            <div>
              <h2 id="dialog-title">{title}</h2>
              {subtitle ? <p>{subtitle}</p> : null}
            </div>
          </div>
          <button className={u.iconButton} onClick={onRequestClose} aria-label="关闭弹窗" type="button">
            <Icon name="close" />
          </button>
        </header>
        <div className={s.modalBody}>{children}</div>
        {footer ? (
          <footer className={s.modalBottom}>
            {footer.note ? <small>{footer.note}</small> : <span />}
            {footer.actions ? <span className="flex gap8">{footer.actions}</span> : null}
          </footer>
        ) : null}
      </section>
    </div>,
    document.body,
  );
}
