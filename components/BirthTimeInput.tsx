"use client";

import { useEffect, useRef, useState } from "react";

type Meridiem = "" | "am" | "pm";
type Parts = { h: string; m: string; ap: Meridiem };

const EMPTY: Parts = { h: "", m: "", ap: "" };

/** Emitted while something is typed but it can't be resolved to a time. */
export const BIRTH_TIME_INVALID = "invalid";

/** Hours 0 and 13–23 are unambiguous 24-hour times: no AM/PM needed. */
function is24h(h: string) {
  if (!h) return false;
  const n = Number(h);
  return n === 0 || n >= 13;
}

function resolve({ h, m, ap }: Parts): string {
  if (!h && !m) return "";
  if (!h) return BIRTH_TIME_INVALID;
  const hour = Number(h);
  const minute = m ? Number(m) : 0; // "7 pm" with no minutes means 7:00
  if (hour > 23 || minute > 59) return BIRTH_TIME_INVALID;
  let h24 = hour;
  if (!is24h(h)) {
    if (!ap) return BIRTH_TIME_INVALID;
    h24 = (hour % 12) + (ap === "pm" ? 12 : 0);
  }
  return `${String(h24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function fromValue(v: string): Parts {
  const match = /^(\d{2}):(\d{2})$/.exec(v);
  if (!match) return EMPTY;
  const h24 = Number(match[1]);
  if (h24 === 0) return { h: "12", m: match[2], ap: "am" };
  if (h24 === 12) return { h: "12", m: match[2], ap: "pm" };
  if (h24 > 12) return { h: String(h24 - 12), m: match[2], ap: "pm" };
  return { h: String(h24), m: match[2], ap: "am" };
}

export function formatBirthTime(v: string): string {
  const p = fromValue(v);
  return p.h ? `${Number(p.h)}:${p.m} ${p.ap}` : "";
}

/**
 * Birth time as HH : MM number boxes plus an AM/PM toggle. Typing a 24-hour
 * hour (13–23 or 00) switches the toggle off. Emits "HH:MM" (24h), "" when
 * empty, or BIRTH_TIME_INVALID when partial.
 */
export default function BirthTimeInput({
  id,
  value,
  onChange,
  disabled,
  describedBy,
  invalid,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  describedBy?: string;
  invalid?: boolean;
}) {
  const [parts, setParts] = useState<Parts>(() => fromValue(value));
  const hRef = useRef<HTMLInputElement>(null);
  const mRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (value === BIRTH_TIME_INVALID) return;
    if (value && value !== resolve(parts)) setParts(fromValue(value));
    if (!value && (parts.h || parts.m || parts.ap)) setParts(EMPTY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const commit = (next: Parts) => {
    setParts(next);
    const v = resolve(next);
    if (v !== value) onChange(v);
  };

  // Same left-to-right spill as the date: "730" or "1930" typed into the
  // hour box lands as 7:30 / 19:30.
  const onType = (from: "h" | "m", raw: string) => {
    let rest = raw.replace(/\D/g, "");
    const next = { ...parts };
    if (from === "h") {
      let h = rest.slice(0, 2);
      let used = h.length;
      if (h.length >= 1 && Number(h[0]) > 2) {
        h = `0${h[0]}`;
        used = 1;
      }
      next.h = h;
      rest = rest.slice(used);
      if (!rest) {
        commit(next);
        if (h.length === 2) mRef.current?.focus();
        return;
      }
    }
    let m = rest.slice(0, 2);
    if (m.length === 1 && Number(m) > 5) m = `0${m}`;
    next.m = m;
    commit(next);
    if (from === "h") mRef.current?.focus();
  };

  const box =
    "ios-input bg-transparent p-0 text-center text-[17px] leading-6 tabular-nums caret-blood placeholder:text-ash/30 first:text-left first:pl-0 focus:outline-none disabled:cursor-not-allowed";
  const common = {
    type: "text",
    inputMode: "numeric" as const,
    pattern: "[0-9]*",
    disabled,
    "aria-invalid": invalid || undefined,
    "aria-describedby": describedBy,
    className: box,
  };
  const twentyFour = is24h(parts.h);

  return (
    <div
      role="group"
      aria-label="Birth time, hours and minutes"
      className="flex items-center justify-start gap-4"
    >
      <div className="flex items-center">
        <input
          {...common}
          id={id}
          ref={hRef}
          aria-label="Hour"
          placeholder="HH"
          value={parts.h}
          onChange={(e) => onType("h", e.target.value)}
          onKeyDown={(e) => {
            if ((e.key === ":" || e.key === "." || e.key === " ") && parts.h) {
              e.preventDefault();
              mRef.current?.focus();
            }
          }}
          onFocus={(e) => e.currentTarget.select()}
          style={{ width: "2.6ch" }}
        />
        <span aria-hidden="true" className="px-0.5 text-[17px] text-ash/25">
          :
        </span>
        <input
          {...common}
          ref={mRef}
          aria-label="Minutes"
          placeholder="MM"
          value={parts.m}
          onChange={(e) => onType("m", e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !e.currentTarget.value) {
              e.preventDefault();
              hRef.current?.focus();
            }
          }}
          onFocus={(e) => e.currentTarget.select()}
          style={{ width: "2.8ch" }}
        />
      </div>
      <div
        role="radiogroup"
        aria-label="AM or PM"
        className={`flex rounded-full border border-ash/15 p-0.5 transition-opacity ${
          twentyFour ? "opacity-30" : ""
        }`}
      >
        {(["am", "pm"] as const).map((ap) => {
          const checked = !twentyFour && parts.ap === ap;
          return (
            <button
              key={ap}
              type="button"
              role="radio"
              aria-checked={checked}
              disabled={disabled || twentyFour}
              onClick={() => commit({ ...parts, ap })}
              className={`interactive h-8 min-w-[42px] rounded-full px-2 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blood/60 disabled:cursor-default ${
                checked ? "bg-ash text-void" : "text-ash/60 hover:text-ash"
              }`}
            >
              {ap}
            </button>
          );
        })}
      </div>
    </div>
  );
}
