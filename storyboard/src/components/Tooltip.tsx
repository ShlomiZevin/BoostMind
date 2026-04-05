import { ReactNode, useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  text: string;
  children: ReactNode;
}

export function Tooltip({ text, children }: Props) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const showTimeoutRef = useRef<number | null>(null);
  const hideTimeoutRef = useRef<number | null>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);

  const show = useCallback(() => {
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    showTimeoutRef.current = window.setTimeout(() => {
      if (wrapRef.current) {
        const rect = wrapRef.current.getBoundingClientRect();
        setPos({ x: rect.left + rect.width / 2, y: rect.top - 8 });
      }
      setVisible(true);
      // Auto-hide after 3 seconds as safety net
      hideTimeoutRef.current = window.setTimeout(() => setVisible(false), 3000);
    }, 400);
  }, []);

  const hide = useCallback(() => {
    if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    setVisible(false);
  }, []);

  // Hide on scroll
  useEffect(() => {
    if (!visible) return;
    const handler = () => setVisible(false);
    window.addEventListener('scroll', handler, true);
    return () => window.removeEventListener('scroll', handler, true);
  }, [visible]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, []);

  if (!text) return <span className="tooltip-wrap">{children}</span>;

  return (
    <>
      <span
        ref={wrapRef}
        className="tooltip-wrap"
        onMouseEnter={show}
        onMouseLeave={hide}
      >
        {children}
      </span>
      {visible && createPortal(
        <div className="tooltip-bubble" style={{ left: pos.x, top: pos.y }} onMouseEnter={hide}>
          {text}
        </div>,
        document.body
      )}
    </>
  );
}
