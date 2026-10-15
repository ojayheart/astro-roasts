"use client";

import type { ReactNode } from "react";
import { COPY, type FieldKey } from "./birthFormCopy";
import BirthDateInput, { formatBirthDate } from "./BirthDateInput";
import BirthTimeInput, { formatBirthTime } from "./BirthTimeInput";

export type PersonFormValue = {
  name: string;
  gender: string;
  date: string;
  time: string;
  placeName: string;
  countryName: string;
};

export const EMPTY_PERSON: PersonFormValue = {
  name: "",
  gender: "",
  date: "",
  time: "",
  placeName: "",
  countryName: "",
};

/* ------------------------------------------------------------------------ */
/* Shared primitives (also used by BirthForm for the email row)             */
/* ------------------------------------------------------------------------ */

/** Text input inside a stacked row: floating label sits in the top padding,
 *  so the whole row is the tap target. */
export const stackedInputClass =
  "ios-input block w-full bg-transparent px-4 pt-[30px] pb-3 text-[17px] leading-6";

const labelTextClass =
  "font-mono text-[11px] leading-4 uppercase tracking-[0.16em] text-ash/50 transition-colors duration-200 group-focus-within/row:text-blood group-data-[invalid=true]/row:text-blood";

export function describedBy(
  ...ids: Array<string | false | null | undefined>
): string | undefined {
  const joined = ids.filter(Boolean).join(" ");
  return joined || undefined;
}

export function hintIdFor(id: string, hint?: string) {
  return hint ? `${id}-hint` : undefined;
}

export function FormGroup({
  caption,
  error,
  errorId,
  children,
}: {
  caption?: string;
  error?: string;
  errorId?: string;
  children: ReactNode;
}) {
  return (
    <div>
      {caption && (
        <p className="px-4 pb-2 font-mono text-[11px] uppercase tracking-[0.22em] text-ash/45">
          {caption}
        </p>
      )}
      <div className="ios-group">{children}</div>
      {error && (
        <p
          id={errorId}
          className="flex items-start gap-1.5 px-4 pt-2 font-ui text-[13px] leading-[18px] text-blood"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            className="mt-px h-4 w-4 shrink-0"
            fill="currentColor"
          >
            <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm-.75 3.25a.75.75 0 0 1 1.5 0v3.5a.75.75 0 0 1-1.5 0v-3.5ZM8 11.75a.9.9 0 1 1 0-1.8.9.9 0 0 1 0 1.8Z" />
          </svg>
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

export function FieldRow({
  id,
  label,
  optional = false,
  hint,
  invalid = false,
  layout = "stacked",
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  hint?: string;
  invalid?: boolean;
  /** stacked: label above value (text fields). inline: label left, value
   *  right (date/time). */
  layout?: "stacked" | "inline";
  children: ReactNode;
}) {
  const labelContent = (
    <>
      {label}
      {optional && (
        <span className="ml-1.5 normal-case tracking-normal text-ash/30">
          {COPY.optionalTag}
        </span>
      )}
    </>
  );

  return (
    <div
      className="ios-row group/row interactive"
      data-invalid={invalid ? "true" : undefined}
    >
      {layout === "stacked" ? (
        <div className="relative">
          <label
            htmlFor={id}
            className={`pointer-events-none absolute left-4 top-3 ${labelTextClass}`}
          >
            {labelContent}
          </label>
          {children}
        </div>
      ) : (
        <div className="flex min-h-[52px] items-center gap-4 pl-4 pr-3">
          <label
            htmlFor={id}
            className={`shrink-0 cursor-pointer ${labelTextClass}`}
          >
            {labelContent}
          </label>
          <div className="relative min-w-0 flex-1">{children}</div>
        </div>
      )}
      {hint && (
        <p
          id={`${id}-hint`}
          className={`px-4 pb-3 font-ui text-[13px] leading-[18px] text-ash/40 ${
            layout === "stacked" ? "-mt-1" : "-mt-1.5"
          }`}
        >
          {hint}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Person                                                                   */
/* ------------------------------------------------------------------------ */

type PersonFieldError = {
  field: Exclude<FieldKey, "email">;
  message: string;
};

const GROUP_OF: Record<PersonFieldError["field"], "who" | "born"> = {
  name: "who",
  gender: "who",
  date: "born",
  time: "born",
  place: "born",
};

/** iOS-style pill choices: one tap instead of typing. Arrow keys move the
 *  selection (radio-group semantics, roving tabindex). */
function GenderChoice({
  id,
  value,
  onChange,
  disabled,
  invalid,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  invalid: boolean;
}) {
  const options = COPY.genderOptions;
  const selected = options.findIndex((o) => o.value === value);
  const pick = (i: number) => {
    const next = (i + options.length) % options.length;
    onChange(options[next].value);
    document.getElementById(`${id}-${next}`)?.focus();
  };
  return (
    <div
      className="ios-row group/row interactive"
      data-invalid={invalid ? "true" : undefined}
    >
      <div className="px-4 pt-3 pb-3.5">
        <p id={`${id}-label`} className={labelTextClass}>
          {COPY.fields.gender.label}
        </p>
        <div
          role="radiogroup"
          aria-labelledby={`${id}-label`}
          aria-invalid={invalid || undefined}
          className="mt-2.5 flex gap-2"
        >
          {options.map((o, i) => {
            const checked = i === selected;
            return (
              <button
                key={o.value}
                // First option carries the field id so validation can focus it.
                id={i === 0 ? id : `${id}-${i}`}
                type="button"
                role="radio"
                aria-checked={checked}
                tabIndex={checked || (selected === -1 && i === 0) ? 0 : -1}
                disabled={disabled}
                onClick={() => onChange(o.value)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                    e.preventDefault();
                    pick(i + 1);
                  } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                    e.preventDefault();
                    pick(i - 1);
                  }
                }}
                className={`interactive h-10 flex-1 rounded-full border font-ui text-[15px] transition-[background-color,border-color,color,transform] duration-200 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blood/60 disabled:cursor-not-allowed disabled:opacity-40 ${
                  checked
                    ? "border-ash bg-ash font-medium text-void"
                    : "border-ash/15 text-ash/70 hover:border-ash/35 hover:text-ash"
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function PersonFields({
  idPrefix,
  label,
  value,
  onChange,
  disabled,
  onRemove,
  removeAriaLabel,
  error,
  showHints = true,
}: {
  idPrefix: string;
  label: string | null;
  value: PersonFormValue;
  onChange: (v: PersonFormValue) => void;
  disabled: boolean;
  /** When set, the person header shows an iOS-style red "Remove" action. */
  onRemove?: () => void;
  removeAriaLabel?: string;
  /** Field-level validation error to highlight inline. */
  error?: PersonFieldError | null;
  /** Hide helper hints (e.g. on repeated person cards) to cut noise. */
  showHints?: boolean;
}) {
  const f = COPY.fields;
  const hint = (text: string) => (showHints ? text : "");
  const id = (key: string) => `${idPrefix}-${key}`;
  const errorGroup = error ? GROUP_OF[error.field] : null;
  const errorId = (group: string) =>
    errorGroup === group ? `${idPrefix}-${group}-error` : undefined;
  const isInvalid = (field: PersonFieldError["field"]) =>
    error?.field === field;
  const aria = (field: PersonFieldError["field"], hintText: string) => ({
    "aria-invalid": isInvalid(field) || undefined,
    "aria-describedby": describedBy(
      hintIdFor(id(field), hintText),
      isInvalid(field) && errorId(GROUP_OF[field]),
    ),
  });

  // Once a real date/time is in, the hint becomes a read-back so day/month
  // mix-ups are obvious at a glance.
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(value.date);
  const validTime = /^\d{2}:\d{2}$/.test(value.time);
  const dateHint = validDate ? formatBirthDate(value.date) : hint(f.date.hint);
  const timeHint = validTime
    ? `${formatBirthTime(value.time)}. Noted.`
    : hint(f.time.hint);

  const groups = (
    <div className="space-y-6">
      <FormGroup
        caption={COPY.groups.who}
        error={errorGroup === "who" ? error?.message : undefined}
        errorId={errorId("who")}
      >
        <FieldRow
          id={id("name")}
          label={f.name.label}
          hint={hint(f.name.hint)}
          invalid={isInvalid("name")}
        >
          <input
            id={id("name")}
            name="given-name"
            type="text"
            required
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
            disabled={disabled}
            autoComplete="given-name"
            autoCapitalize="words"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
            className={stackedInputClass}
            placeholder={f.name.placeholder}
            {...aria("name", hint(f.name.hint))}
          />
        </FieldRow>
        <GenderChoice
          id={id("gender")}
          value={value.gender}
          onChange={(gender) => onChange({ ...value, gender })}
          disabled={disabled}
          invalid={isInvalid("gender")}
        />
      </FormGroup>

      <FormGroup
        caption={COPY.groups.born}
        error={errorGroup === "born" ? error?.message : undefined}
        errorId={errorId("born")}
      >
        <FieldRow
          id={id("date")}
          label={f.date.label}
          hint={dateHint}
          invalid={isInvalid("date")}
        >
          <div className="px-4 pt-[30px] pb-3">
            <BirthDateInput
              id={id("date")}
              value={value.date}
              onChange={(date) => onChange({ ...value, date })}
              disabled={disabled}
              invalid={isInvalid("date")}
              describedBy={aria("date", dateHint)["aria-describedby"]}
            />
          </div>
        </FieldRow>
        <FieldRow
          id={id("time")}
          label={f.time.label}
          optional
          hint={timeHint}
          invalid={isInvalid("time")}
        >
          <div className="px-4 pt-[30px] pb-3">
            <BirthTimeInput
              id={id("time")}
              value={value.time}
              onChange={(time) => onChange({ ...value, time })}
              disabled={disabled}
              invalid={isInvalid("time")}
              describedBy={aria("time", timeHint)["aria-describedby"]}
            />
          </div>
        </FieldRow>
        <FieldRow
          id={id("place")}
          label={f.place.label}
          hint={hint(f.place.hint)}
          invalid={isInvalid("place")}
        >
          <input
            id={id("place")}
            name="birth-place"
            type="text"
            required
            value={value.placeName}
            onChange={(e) => onChange({ ...value, placeName: e.target.value })}
            disabled={disabled}
            autoComplete="off"
            autoCapitalize="words"
            autoCorrect="off"
            enterKeyHint="done"
            className={stackedInputClass}
            placeholder={f.place.placeholder}
            {...aria("place", hint(f.place.hint))}
          />
        </FieldRow>
      </FormGroup>
    </div>
  );

  if (!label) return groups;

  return (
    <section
      aria-label={label}
      className="rounded-[28px] border border-ash/10 bg-ash/[0.02] p-3 sm:p-4"
    >
      <div className="flex min-h-[44px] items-center justify-between gap-3 pb-3 pl-4 pr-1">
        <h3 className="flex items-center gap-2.5 font-syne text-lg font-bold uppercase tracking-tight text-ash">
          <span
            aria-hidden="true"
            className="h-2 w-2 rounded-full bg-blood shadow-[0_0_10px_rgb(255_42_0/0.7)]"
          />
          {label}
        </h3>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            aria-label={removeAriaLabel}
            className="interactive -my-1 min-h-[44px] rounded-xl px-3 font-ui text-[15px] font-medium text-blood transition-[opacity,background-color] duration-200 hover:bg-blood/10 active:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blood/60 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {COPY.person.remove}
          </button>
        )}
      </div>
      {groups}
    </section>
  );
}
