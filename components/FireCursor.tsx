"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const EMBERS = [
  { x: "-10px", d: "0s" },
  { x: "7px", d: "0.35s" },
  { x: "-3px", d: "0.7s" },
  { x: "11px", d: "0.95s" },
];

/**
 * Swaps the mouse pointer for a flickering 🔥 (with rising embers) while it is
 * over the wrapped element. Browsers can't animate native cursors, so this is
 * a pointer-following element; the native cursor is hidden via CSS. Mouse
 * only: touch and pen never see it.
 */
export default function FireCursor({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const cursorRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [on, setOn] = useState(false);

  useEffect(() => setMounted(true), []);

  const move = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || !cursorRef.current) return;
    cursorRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
  };

  return (
    <div
      className={`fire-cursor-zone ${className}`}
      onPointerEnter={(e) => {
        if (e.pointerType !== "mouse") return;
        move(e);
        setOn(true);
      }}
      onPointerMove={move}
      onPointerLeave={() => setOn(false)}
    >
      {children}
      {mounted &&
        // Portal: GSAP leaves transforms on form ancestors, which would
        // otherwise trap position: fixed.
        createPortal(
          <div
            ref={cursorRef}
            aria-hidden="true"
            data-on={on}
            className="fire-cursor"
          >
            <div className="fire-cursor-inner">
              {EMBERS.map((e, i) => (
                <span
                  key={i}
                  className="fire-ember"
                  style={{ "--x": e.x, "--d": e.d } as React.CSSProperties}
                />
              ))}
              <span className="fire-cursor-flame">🔥</span>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
