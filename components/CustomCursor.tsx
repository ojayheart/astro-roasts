"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

export default function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cursor = cursorRef.current;
    if (!cursor) return;

    // Touch / coarse-pointer devices have no cursor to replace — skip mount.
    // Also skip when the user has Reduce Motion on; chasing the mouse with a
    // GSAP tween counts as motion they opted out of.
    if (typeof window !== "undefined") {
      const coarse = window.matchMedia("(pointer: coarse)").matches;
      const noHover = !window.matchMedia("(hover: hover)").matches;
      const reduce = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (coarse || noHover || reduce) {
        cursor.style.display = "none";
        return;
      }
    }

    const onMouseMove = (e: MouseEvent) => {
      gsap.to(cursor, {
        x: e.clientX,
        y: e.clientY,
        duration: 0.1,
        ease: "power2.out",
      });
    };

    const onMouseEnterInteractive = () => cursor.classList.add("hovered");
    const onMouseLeaveInteractive = () => cursor.classList.remove("hovered");

    const onMouseOut = () => {
      cursor.style.opacity = "0";
    };
    const onMouseOver = () => {
      cursor.style.opacity = "1";
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseout", onMouseOut);
    document.addEventListener("mouseover", onMouseOver);

    const interactives = document.querySelectorAll(
      "a, button, input, label, .interactive",
    );
    interactives.forEach((el) => {
      el.addEventListener("mouseenter", onMouseEnterInteractive);
      el.addEventListener("mouseleave", onMouseLeaveInteractive);
    });

    // Re-bind on DOM changes
    const observer = new MutationObserver(() => {
      const newInteractives = document.querySelectorAll(
        "a, button, input, label, .interactive",
      );
      newInteractives.forEach((el) => {
        el.addEventListener("mouseenter", onMouseEnterInteractive);
        el.addEventListener("mouseleave", onMouseLeaveInteractive);
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseout", onMouseOut);
      document.removeEventListener("mouseover", onMouseOver);
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={cursorRef}
      id="cursor"
      className="fixed top-0 left-0 w-3 h-3 bg-blood rounded-full pointer-events-none z-[9999] -translate-x-1/2 -translate-y-1/2 mix-blend-difference transition-[width,height,background-color] duration-200 will-change-transform [&.hovered]:w-10 [&.hovered]:h-10 [&.hovered]:bg-ash"
    />
  );
}
