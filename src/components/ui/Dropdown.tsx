"use client";

import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";

/** A trigger plus a floating panel that closes on outside click or Escape. */
export function Dropdown({
  trigger,
  children,
  align = "left",
  side = "bottom",
  className = "",
  wrapperClassName = "relative",
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "left" | "right";
  side?: "bottom" | "top";
  className?: string;
  wrapperClassName?: string;
}) {
  const [position, setPosition] = useState<CSSProperties | null>(null);
  const [wrapper, setWrapper] = useState<HTMLDivElement | null>(null);
  const close = useCallback(() => setPosition(null), []);
  const open = position !== null;

  function toggle() {
    if (open || !wrapper) {
      setPosition(null);
      return;
    }
    // Fixed positioning so the panel isn't clipped by scrolling containers like the sidebar.
    const rect = wrapper.getBoundingClientRect();
    const vertical = side === "top" ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 };
    setPosition(
      align === "right"
        ? { ...vertical, right: Math.max(8, window.innerWidth - rect.right) }
        : { ...vertical, left: Math.min(rect.left, window.innerWidth - 240) },
    );
  }

  useEffect(() => {
    if (!open || !wrapper) {
      return;
    }
    const onDown = (e: MouseEvent) => {
      if (!wrapper.contains(e.target as Node)) {
        setPosition(null);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPosition(null);
      }
    };
    const onScroll = (e: Event) => {
      if (!wrapper.contains(e.target as Node)) {
        setPosition(null);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, wrapper]);

  return (
    <div ref={setWrapper} className={wrapperClassName}>
      {trigger({ open, toggle })}
      {position && (
        <div
          style={position}
          className={`fixed z-50 max-h-[70vh] overflow-y-auto rounded-lg bg-white py-1.5 text-sm font-normal text-ink shadow-menu ${className}`}
        >
          {children(close)}
        </div>
      )}
    </div>
  );
}

export function MenuItem({
  icon,
  children,
  onClick,
  danger = false,
  hint,
}: {
  icon?: ReactNode;
  children: ReactNode;
  onClick: () => void;
  danger?: boolean;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`mx-1 flex w-[calc(100%-0.5rem)] items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-hover ${
        danger ? "hover:text-danger" : ""
      }`}
    >
      {icon && <span className="flex w-5 shrink-0 justify-center text-ink-2">{icon}</span>}
      <span className="flex-1 truncate">{children}</span>
      {hint && <span className="text-xs text-ink-3">{hint}</span>}
    </button>
  );
}

export function MenuDivider() {
  return <div className="my-1 h-px bg-line" />;
}

export function Modal({ onClose, children, className = "" }: { onClose: () => void; children: ReactNode; className?: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 px-4 pt-[12vh]" onMouseDown={onClose}>
      <div
        className={`w-full overflow-hidden rounded-xl bg-white text-ink shadow-menu ${className}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
