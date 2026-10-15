"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { identifyByEmail, track } from "@/lib/track";
import PersonFields, {
  EMPTY_PERSON,
  FieldRow,
  FormGroup,
  describedBy,
  hintIdFor,
  stackedInputClass,
  type PersonFormValue,
} from "./PersonFields";
import FireCursor from "./FireCursor";
import { BIRTH_DATE_INVALID } from "./BirthDateInput";
import { BIRTH_TIME_INVALID } from "./BirthTimeInput";
import { COPY, type FieldKey, type FormMode } from "./birthFormCopy";

type PersonField = Exclude<FieldKey, "email">;

/** Which form value backs each validated field (for clearing inline errors). */
const VALUE_KEY: Record<PersonField, keyof PersonFormValue> = {
  name: "name",
  gender: "gender",
  date: "date",
  time: "time",
  place: "placeName",
};

export default function BirthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<FormMode>("solo");
  const [people, setPeople] = useState<PersonFormValue[]>([EMPTY_PERSON]);
  const [familyUnlocked, setFamilyUnlocked] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState<{
    person: number;
    field: PersonField;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    track("birth_form_opened", {});
    const params = new URLSearchParams(window.location.search);
    const unlocked =
      localStorage.getItem("ar_has_roast") === "1" ||
      params.get("mode") === "family";
    setFamilyUnlocked(unlocked);
    if (params.get("mode") === "family") switchMode("family");
    if (params.get("mode") === "couple") switchMode("couple");
  }, []);

  const PEOPLE_BY_MODE: Record<FormMode, number> = {
    solo: 1,
    couple: 2,
    family: 3,
  };

  function switchMode(next: FormMode) {
    setMode(next);
    setFieldError(null);
    setPeople((prev) => {
      const target = PEOPLE_BY_MODE[next];
      const copy = prev.slice(0, next === "family" ? 6 : target);
      while (copy.length < target) copy.push(EMPTY_PERSON);
      return copy;
    });
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate every person
    for (let i = 0; i < people.length; i++) {
      const p = people[i];
      const who =
        mode === "solo" ? COPY.errors.who.solo : COPY.errors.who.person(i + 1);
      const fail = (field: PersonField, message: string) => {
        setError(message);
        setFieldError({ person: i, field });
        document.getElementById(`p${i}-${field}`)?.focus();
      };
      if (!p.name.trim()) return fail("name", COPY.errors.name(who));
      if (!p.gender.trim()) return fail("gender", COPY.errors.gender(who));
      if (!p.date) return fail("date", COPY.errors.date(who));
      if (p.date === BIRTH_DATE_INVALID)
        return fail("date", COPY.errors.dateInvalid(who));
      if (p.time === BIRTH_TIME_INVALID)
        return fail("time", COPY.errors.timeInvalid(who));
      if (!p.placeName.trim()) return fail("place", COPY.errors.place(who));
    }

    setError("");
    setFieldError(null);
    setLoading(true);

    track("birth_form_submitted", {
      mode,
      hasEmail: !!email,
      hasBirthTime: !!people[0].time,
      peopleCount: people.length,
    });
    if (email) identifyByEmail(email, { name: people[0].name });

    try {
      let body;
      if (mode === "solo") {
        // Solo: unchanged body shape
        const p = people[0];
        body = {
          name: p.name,
          gender: p.gender,
          email: email || undefined,
          date: p.date,
          time: p.time || undefined,
          placeName: p.placeName,
          countryName: p.countryName,
        };
      } else {
        // Couple/family: group body
        body = {
          kind: mode,
          email: email || undefined,
          people: people.map((p) => ({
            name: p.name,
            gender: p.gender,
            date: p.date,
            time: p.time || null,
            birthPlace: [p.placeName, p.countryName]
              .filter((s) => s.trim())
              .join(", "),
          })),
        };
      }

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || COPY.errors.generic);
        setLoading(false);
        return;
      }

      track("roast_generation_started", { roastId: data.id });
      router.push(`/roast/${data.id}`);
    } catch {
      setError(COPY.errors.network);
      setLoading(false);
    }
  };

  const price =
    mode === "solo"
      ? "€5"
      : mode === "couple"
        ? "€8"
        : `€${8 + 4 * (people.length - 2)}`;

  const modes: FormMode[] = [
    "solo",
    "couple",
    ...(familyUnlocked ? (["family"] as const) : []),
  ];

  const emailHint = COPY.fields.email.hint;

  return (
    <form
      className="space-y-8"
      onSubmit={handleSubmit}
      aria-busy={loading}
      noValidate
    >
      {/* Mode switch */}
      <div className="space-y-3">
        <SegmentedControl modes={modes} value={mode} onChange={switchMode} />
        {COPY.modes[mode].subtitle && (
          <p
            aria-live="polite"
            className="px-1 text-center font-ui text-[15px] leading-snug text-ash/55"
          >
            {COPY.modes[mode].subtitle}
          </p>
        )}
      </div>

      <div className="space-y-6">
        {/* Person fields */}
        {people.map((p, i) => (
          <PersonFields
            key={i}
            idPrefix={`p${i}`}
            label={mode === "solo" ? null : COPY.person.label(i + 1)}
            value={p}
            onChange={(updated) => {
              const copy = [...people];
              copy[i] = updated;
              setPeople(copy);
              if (
                fieldError?.person === i &&
                updated[VALUE_KEY[fieldError.field]] !==
                  p[VALUE_KEY[fieldError.field]]
              ) {
                setFieldError(null);
              }
            }}
            disabled={loading}
            error={
              fieldError?.person === i
                ? { field: fieldError.field, message: error }
                : null
            }
            onRemove={
              mode === "family" && i >= 3
                ? () => {
                    setPeople(people.filter((_, idx) => idx !== i));
                    setFieldError(null);
                  }
                : undefined
            }
            removeAriaLabel={COPY.person.removeAriaLabel(i + 1)}
            showHints={i === 0}
          />
        ))}

        {/* Family mode: add person row */}
        {mode === "family" && people.length < 6 && (
          <div className="ios-group">
            <button
              type="button"
              onClick={() => setPeople([...people, EMPTY_PERSON])}
              disabled={loading}
              className="interactive group/add flex min-h-[52px] w-full items-center gap-3 rounded-[15px] px-4 text-left transition-colors duration-200 hover:bg-ash/[0.04] active:bg-ash/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blood/60 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span
                aria-hidden="true"
                className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-blood text-void transition-transform duration-200 group-active/add:scale-90"
              >
                <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none">
                  <path
                    d="M6 1.5v9M1.5 6h9"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <span className="flex-1 font-ui text-[17px] text-blood">
                {COPY.person.add}
              </span>
              <span className="font-mono text-xs tracking-[0.1em] text-ash/40">
                {COPY.person.addPriceNote}
              </span>
            </button>
          </div>
        )}

        {/* Email */}
        <FormGroup caption={COPY.groups.email}>
          <FieldRow
            id="birth-email"
            label={COPY.fields.email.label}
            hint={emailHint}
            optional
          >
            <input
              id="birth-email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              autoComplete="email"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              inputMode="email"
              enterKeyHint="next"
              className={stackedInputClass}
              placeholder={COPY.fields.email.placeholder}
              aria-describedby={describedBy(
                hintIdFor("birth-email", emailHint),
              )}
            />
          </FieldRow>
        </FormGroup>
      </div>

      {error && (
        <p
          id="birth-form-error"
          role="alert"
          aria-live="assertive"
          className="rounded-2xl border border-blood/25 bg-blood/[0.08] px-4 py-3 font-ui text-[15px] leading-snug text-blood"
        >
          {error}
        </p>
      )}

      {/* CTA */}
      <div className="space-y-3">
        <FireCursor>
          <button
            type="submit"
            disabled={loading}
            className="interactive relative flex min-h-[60px] w-full items-center justify-center gap-3 rounded-2xl bg-blood px-5 py-4 text-balance font-syne text-base font-bold uppercase leading-tight tracking-tight text-void shadow-[0_12px_40px_-12px_rgb(255_42_0/0.65),inset_0_1px_0_rgb(255_255_255/0.25)] transition-[transform,filter,box-shadow] duration-200 ease-out hover:brightness-110 hover:shadow-[0_16px_48px_-12px_rgb(255_42_0/0.8),inset_0_1px_0_rgb(255_255_255/0.25)] active:scale-[0.98] active:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ash focus-visible:ring-offset-2 focus-visible:ring-offset-void disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:brightness-100 sm:text-lg md:text-xl md:font-extrabold"
          >
            {loading && (
              <span
                aria-hidden="true"
                className="h-[18px] w-[18px] shrink-0 animate-spin rounded-full border-2 border-void/25 border-t-void"
              />
            )}
            <span>{loading ? COPY.cta.loading : COPY.cta[mode]}</span>
          </button>
        </FireCursor>
        <div className="space-y-1 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.15em] text-ash/55">
            {COPY.priceHint[mode](price)}
          </p>
          {COPY.finePrint && (
            <p className="mx-auto max-w-xs font-ui text-[12px] leading-[17px] text-ash/35">
              {COPY.finePrint}
            </p>
          )}
        </div>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------------ */
/* iOS segmented control (radio group with roving tabindex)                 */
/* ------------------------------------------------------------------------ */

function SegmentedControl({
  modes,
  value,
  onChange,
}: {
  modes: FormMode[];
  value: FormMode;
  onChange: (m: FormMode) => void;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const index = Math.max(0, modes.indexOf(value));

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const step =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? 1
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? -1
          : 0;
    let next = -1;
    if (step) next = (index + step + modes.length) % modes.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = modes.length - 1;
    if (next < 0) return;
    e.preventDefault();
    onChange(modes[next]);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={COPY.modes.ariaLabel}
      onKeyDown={onKeyDown}
      className="relative flex rounded-full border border-ash/10 bg-ash/[0.06] p-1"
    >
      {/* Sliding thumb */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-1 left-1 rounded-full bg-ash/[0.14] shadow-[0_3px_8px_rgb(0_0_0/0.45),inset_0_0_0_0.5px_rgb(229_229_229/0.18)] transition-[transform,width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{
          width: `calc((100% - 0.5rem) / ${modes.length})`,
          transform: `translateX(${index * 100}%)`,
        }}
      />
      {modes.map((m, i) => {
        const selected = m === value;
        return (
          <button
            key={m}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(m)}
            className={`interactive relative z-10 min-h-[40px] flex-1 rounded-full px-3 font-ui text-[15px] font-semibold tracking-[-0.01em] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blood/70 ${
              selected ? "text-ash" : "text-ash/50 hover:text-ash/80"
            }`}
          >
            {COPY.modes[m].tab}
          </button>
        );
      })}
    </div>
  );
}
