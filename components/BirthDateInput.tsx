"use client";

import { useEffect, useRef, useState } from "react";

type Parts = { d: string; m: string; y: string };

/** Emitted while something is typed but it isn't a real date yet. */
export const BIRTH_DATE_INVALID = "invalid";

const EMPTY: Parts = { d: "", m: "", y: "" };
const THIS_YEAR = new Date().getFullYear();

function toIso({ d, m, y }: Parts): string {
  if (d.length < 1 || m.length < 1 || y.length !== 4) return "";
  const day = Number(d);
  const month = Number(m);
  const year = Number(y);
  if (year < 1900 || year > THIS_YEAR) return "";
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return "";
  }
  return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function fromIso(iso: string): Parts {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return match ? { y: match[1], m: match[2], d: match[3] } : EMPTY;
}

/** "21/01/1994", "21.1.94"-ish, "1994-01-21" or "21011994" → parts. */
function parsePasted(text: string): Parts | null {
  const t = text.trim();
  const iso = /^(\d{4})\D(\d{1,2})\D(\d{1,2})$/.exec(t);
  if (iso)
    return {
      y: iso[1],
      m: iso[2].padStart(2, "0"),
      d: iso[3].padStart(2, "0"),
    };
  const dmy = /^(\d{1,2})\D(\d{1,2})\D(\d{4})$/.exec(t);
  if (dmy)
    return {
      d: dmy[1].padStart(2, "0"),
      m: dmy[2].padStart(2, "0"),
      y: dmy[3],
    };
  const packed = /^(\d{2})(\d{2})(\d{4})$/.exec(t);
  if (packed) return { d: packed[1], m: packed[2], y: packed[3] };
  return null;
}

export function formatBirthDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Birthday entry as three numeric boxes (DD / MM / YYYY). Fastest pattern for
 * dates far in the past: numeric keypad on phones, auto-advance, smart paste,
 * and autofill via bday-day/month/year. Emits ISO "YYYY-MM-DD" when the date
 * is real, "" when empty, BIRTH_DATE_INVALID when partial or impossible.
 */
export default function BirthDateInput({
  id,
  value,
  onChange,
  disabled,
  describedBy,
  invalid,
}: {
  id: string;
  value: string;
  onChange: (iso: string) => void;
  disabled?: boolean;
  describedBy?: string;
  invalid?: boolean;
}) {
  const [parts, setParts] = useState<Parts>(() => fromIso(value));
  const refs = {
    d: useRef<HTMLInputElement>(null),
    m: useRef<HTMLInputElement>(null),
    y: useRef<HTMLInputElement>(null),
  };

  // Follow external resets/changes (e.g. a person card being removed).
  useEffect(() => {
    if (value === BIRTH_DATE_INVALID) return;
    if (value && value !== toIso(parts)) setParts(fromIso(value));
    if (!value && (parts.d || parts.m || parts.y)) setParts(EMPTY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const commit = (next: Parts) => {
    setParts(next);
    const touched = !!(next.d || next.m || next.y);
    const iso = toIso(next) || (touched ? BIRTH_DATE_INVALID : "");
    if (iso !== value) onChange(iso);
  };

  // Digits flow left to right: extra digits typed (or autofilled) into one
  // box spill into the next, so "21011994" in the day box fills all three.
  const handle = (key: keyof Parts, raw: string) => {
    const order: (keyof Parts)[] = ["d", "m", "y"];
    const max = { d: 2, m: 2, y: 4 };
    const next = { ...parts };
    let rest = raw.replace(/\D/g, "");
    let i = order.indexOf(key);
    let last = key;
    while (i < order.length) {
      const k = order[i];
      let chunk = rest.slice(0, max[k]);
      let used = chunk.length;
      // A day of 4–9 or a month of 2–9 can only be one digit: pad it.
      const lone = k === "d" ? 3 : k === "m" ? 1 : Infinity;
      if (chunk.length >= 1 && Number(chunk[0]) > lone) {
        chunk = `0${chunk[0]}`;
        used = 1;
      }
      next[k] = chunk;
      rest = rest.slice(used);
      last = k;
      if (!rest) break;
      i++;
    }
    commit(next);
    const full = next[last].length === max[last];
    const target = full && last !== "y" ? order[order.indexOf(last) + 1] : last;
    if (target !== key) refs[target].current?.focus();
  };

  const onKeyDown =
    (key: keyof Parts) => (e: React.KeyboardEvent<HTMLInputElement>) => {
      const order: (keyof Parts)[] = ["d", "m", "y"];
      const i = order.indexOf(key);
      const el = e.currentTarget;
      if (e.key === "Backspace" && !el.value && i > 0) {
        e.preventDefault();
        refs[order[i - 1]].current?.focus();
      } else if (
        (e.key === "/" || e.key === "." || e.key === "-" || e.key === " ") &&
        i < 2
      ) {
        // Typing a separator pads a single digit and jumps ahead.
        e.preventDefault();
        if (el.value.length === 1) {
          commit({ ...parts, [key]: `0${el.value}` });
        }
        refs[order[i + 1]].current?.focus();
      } else if (
        e.key === "ArrowRight" &&
        i < 2 &&
        el.selectionStart === el.value.length
      ) {
        e.preventDefault();
        refs[order[i + 1]].current?.focus();
      } else if (e.key === "ArrowLeft" && i > 0 && el.selectionStart === 0) {
        e.preventDefault();
        refs[order[i - 1]].current?.focus();
      }
    };

  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const parsed = parsePasted(e.clipboardData.getData("text"));
    if (!parsed) return;
    e.preventDefault();
    commit(parsed);
    refs.y.current?.focus();
  };

  const box =
    "ios-input bg-transparent p-0 text-center text-[17px] leading-6 tabular-nums caret-blood placeholder:text-ash/30 first:text-left first:pl-0 focus:outline-none disabled:cursor-not-allowed";
  const sep = (
    <span aria-hidden="true" className="px-1 text-[17px] text-ash/25">
      /
    </span>
  );
  const common = {
    type: "text",
    inputMode: "numeric" as const,
    pattern: "[0-9]*",
    disabled,
    onPaste,
    "aria-invalid": invalid || undefined,
    "aria-describedby": describedBy,
    className: box,
  };

  return (
    <div
      role="group"
      aria-label="Date of birth, day month year"
      className="flex items-center justify-start"
    >
      <input
        {...common}
        id={id}
        ref={refs.d}
        name="bday-day"
        autoComplete="bday-day"
        aria-label="Day"
        placeholder="DD"
        value={parts.d}
        onChange={(e) => handle("d", e.target.value)}
        onKeyDown={onKeyDown("d")}
        onFocus={(e) => e.currentTarget.select()}
        style={{ width: "2.6ch" }}
      />
      {sep}
      <input
        {...common}
        ref={refs.m}
        name="bday-month"
        autoComplete="bday-month"
        aria-label="Month"
        placeholder="MM"
        value={parts.m}
        onChange={(e) => handle("m", e.target.value)}
        onKeyDown={onKeyDown("m")}
        onFocus={(e) => e.currentTarget.select()}
        style={{ width: "2.8ch" }}
      />
      {sep}
      <input
        {...common}
        ref={refs.y}
        name="bday-year"
        autoComplete="bday-year"
        aria-label="Year"
        placeholder="YYYY"
        value={parts.y}
        onChange={(e) => handle("y", e.target.value)}
        onKeyDown={onKeyDown("y")}
        onFocus={(e) => e.currentTarget.select()}
        style={{ width: "4.6ch" }}
      />
    </div>
  );
}
