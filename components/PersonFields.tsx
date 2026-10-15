"use client";

import type { ReactNode } from "react";
import { COPY, type FieldKey } from "./birthFormCopy";

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

/** Date/time input inside an inline row: value right-aligned. */
export const dateTimeInputClass =
  "ios-input ios-datetime block w-full bg-transparent py-3 text-[17px] leading-6";

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
  emptyPlaceholder,
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
  /** Shown on iOS Safari only, when a native date/time input is empty. */
  emptyPlaceholder?: string;
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
          <div className="relative min-w-0 flex-1">
            {children}
            {emptyPlaceholder && (
              <span
                aria-hidden="true"
                className="ios-empty-placeholder pointer-events-none absolute inset-y-0 right-1 items-center font-ui text-[17px] text-ash/30"
              >
                {emptyPlaceholder}
              </span>
            )}
          </div>
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

const GROUP_OF: Record<PersonFieldError["field"], "who" | "when" | "where"> = {
  name: "who",
  gender: "who",
  date: "when",
  time: "when",
  place: "where",
  country: "where",
};

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
        <FieldRow
          id={id("gender")}
          label={f.gender.label}
          hint={hint(f.gender.hint)}
          invalid={isInvalid("gender")}
        >
          <input
            id={id("gender")}
            name="sex"
            type="text"
            required
            value={value.gender}
            onChange={(e) => onChange({ ...value, gender: e.target.value })}
            disabled={disabled}
            autoComplete="sex"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
            className={stackedInputClass}
            placeholder={f.gender.placeholder}
            {...aria("gender", hint(f.gender.hint))}
          />
        </FieldRow>
      </FormGroup>

      <FormGroup
        caption={COPY.groups.when}
        error={errorGroup === "when" ? error?.message : undefined}
        errorId={errorId("when")}
      >
        <FieldRow
          id={id("date")}
          label={f.date.label}
          hint={hint(f.date.hint)}
          invalid={isInvalid("date")}
          layout="inline"
          emptyPlaceholder={f.date.placeholder}
        >
          <input
            id={id("date")}
            name="bday"
            type="date"
            required
            value={value.date}
            onChange={(e) => onChange({ ...value, date: e.target.value })}
            disabled={disabled}
            autoComplete="bday"
            className={dateTimeInputClass}
            data-empty={value.date ? undefined : "true"}
            style={{ colorScheme: "dark" }}
            {...aria("date", hint(f.date.hint))}
          />
        </FieldRow>
        <FieldRow
          id={id("time")}
          label={f.time.label}
          optional
          hint={hint(f.time.hint)}
          layout="inline"
          emptyPlaceholder={f.time.placeholder}
        >
          <input
            id={id("time")}
            name="bday-time"
            type="time"
            value={value.time}
            onChange={(e) => onChange({ ...value, time: e.target.value })}
            disabled={disabled}
            className={dateTimeInputClass}
            data-empty={value.time ? undefined : "true"}
            style={{ colorScheme: "dark" }}
            {...aria("time", hint(f.time.hint))}
          />
        </FieldRow>
      </FormGroup>

      <FormGroup
        caption={COPY.groups.where}
        error={errorGroup === "where" ? error?.message : undefined}
        errorId={errorId("where")}
      >
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
            autoComplete="address-level2"
            autoCapitalize="words"
            autoCorrect="off"
            enterKeyHint="next"
            className={stackedInputClass}
            placeholder={f.place.placeholder}
            {...aria("place", hint(f.place.hint))}
          />
        </FieldRow>
        <FieldRow
          id={id("country")}
          label={f.country.label}
          hint={hint(f.country.hint)}
          invalid={isInvalid("country")}
        >
          <input
            id={id("country")}
            name="country-name"
            type="text"
            required
            value={value.countryName}
            onChange={(e) =>
              onChange({ ...value, countryName: e.target.value })
            }
            disabled={disabled}
            autoComplete="country-name"
            autoCapitalize="words"
            autoCorrect="off"
            enterKeyHint="done"
            className={stackedInputClass}
            placeholder={f.country.placeholder}
            {...aria("country", hint(f.country.hint))}
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
