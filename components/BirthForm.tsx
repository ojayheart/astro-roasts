"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { identifyByEmail, track } from "@/lib/track";
import PersonFields, {
  EMPTY_PERSON,
  type PersonFormValue,
} from "./PersonFields";
import { formatPrice } from "@/lib/currency";

type FormMode = "solo" | "couple" | "family";

export default function BirthForm({ currency = "usd" }: { currency?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<FormMode>("solo");
  const [people, setPeople] = useState<PersonFormValue[]>([EMPTY_PERSON]);
  const [familyUnlocked, setFamilyUnlocked] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
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
    setPeople((prev) => {
      const target = PEOPLE_BY_MODE[next];
      const copy = prev.slice(0, next === "family" ? 6 : target);
      while (copy.length < target) copy.push(EMPTY_PERSON);
      return copy;
    });
  }

  const inputClass =
    "w-full bg-transparent border-b border-ash/20 text-lg md:text-xl font-syne font-bold text-ash py-3 focus:border-blood focus-visible:outline-none focus-visible:border-blood transition-colors placeholder:text-ash/20 disabled:opacity-50 disabled:cursor-not-allowed";
  const labelClass =
    "block text-xs uppercase tracking-[0.2em] text-ash/50 mb-3 font-mono";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate every person
    for (let i = 0; i < people.length; i++) {
      const p = people[i];
      if (!p.name.trim()) {
        setError(
          `Add ${mode === "solo" ? "your" : `person ${i + 1}'s`} first name so the roast can address ${mode === "solo" ? "you" : "them"}.`,
        );
        document.getElementById(`p${i}-name`)?.focus();
        return;
      }
      if (!p.gender.trim()) {
        setError(
          `Add ${mode === "solo" ? "your" : `person ${i + 1}'s`} gender so the roast uses the right voice.`,
        );
        document.getElementById(`p${i}-gender`)?.focus();
        return;
      }
      if (!p.date) {
        setError(
          `Add ${mode === "solo" ? "your" : `person ${i + 1}'s`} date of birth so we can calculate the chart.`,
        );
        document.getElementById(`p${i}-date`)?.focus();
        return;
      }
      if (!p.placeName.trim()) {
        setError(
          `Add ${mode === "solo" ? "your" : `person ${i + 1}'s`} birth place so we can calculate the chart.`,
        );
        document.getElementById(`p${i}-place`)?.focus();
        return;
      }
      if (!p.countryName.trim()) {
        setError(
          `Add ${mode === "solo" ? "your" : `person ${i + 1}'s`} birth country so we can calculate the chart.`,
        );
        document.getElementById(`p${i}-country`)?.focus();
        return;
      }
    }

    setError("");
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
        setError(
          data.error ||
            "We couldn't start your roast. Check your details and try again.",
        );
        setLoading(false);
        return;
      }

      track("roast_generation_started", { roastId: data.id });
      router.push(`/roast/${data.id}`);
    } catch {
      setError("Connection failed. Check your internet and try again.");
      setLoading(false);
    }
  };

  const ctaLabel =
    mode === "solo"
      ? "Generate my roast"
      : mode === "couple"
        ? "Roast us both"
        : "Roast the whole family";

  return (
    <form
      className="space-y-10"
      onSubmit={handleSubmit}
      aria-busy={loading}
      noValidate
    >
      {/* Mode tabs */}
      <div className="flex gap-6 font-mono text-xs uppercase tracking-[0.2em]">
        {(
          [
            "solo",
            "couple",
            ...(familyUnlocked ? ["family"] : []),
          ] as FormMode[]
        ).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => switchMode(m)}
            className={`interactive pb-1 border-b-2 transition-colors ${
              mode === m
                ? "border-blood text-blood"
                : "border-transparent text-ash/50 hover:text-ash"
            }`}
          >
            {m === "solo" ? "Just me" : m === "couple" ? "Us" : "My family"}
          </button>
        ))}
      </div>

      <div className="space-y-10">
        {/* Person fields */}
        {people.map((p, i) => (
          <div key={i} className="space-y-10">
            <PersonFields
              idPrefix={`p${i}`}
              label={mode === "solo" ? null : `Person ${i + 1}`}
              value={p}
              onChange={(updated) => {
                const copy = [...people];
                copy[i] = updated;
                setPeople(copy);
              }}
              disabled={loading}
            />
            {mode === "family" && i >= 3 && (
              <button
                type="button"
                onClick={() => setPeople(people.filter((_, idx) => idx !== i))}
                disabled={loading}
                className="interactive text-xs font-mono uppercase tracking-[0.2em] text-ash/50 hover:text-blood transition-colors"
              >
                Remove person {i + 1}
              </button>
            )}
          </div>
        ))}

        {/* Family mode: add person button */}
        {mode === "family" && people.length < 6 && (
          <button
            type="button"
            onClick={() => setPeople([...people, EMPTY_PERSON])}
            disabled={loading}
            className="interactive text-xs font-mono uppercase tracking-[0.2em] text-blood hover:text-ash transition-colors"
          >
            Add person (+ {formatPrice(400, currency)})
          </button>
        )}

        {/* Email */}
        <div className="relative group interactive">
          <label htmlFor="birth-email" className={labelClass}>
            Email for your link
          </label>
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
            className={inputClass}
            placeholder="Optional, but useful"
          />
        </div>
      </div>

      {error && (
        <p
          id="birth-form-error"
          role="alert"
          aria-live="assertive"
          className="text-blood text-sm font-mono"
        >
          {error}
        </p>
      )}

      {/* CTA */}
      <div className="pt-4">
        <button
          type="submit"
          disabled={loading}
          className="interactive w-full bg-ash text-void font-syne font-bold text-lg md:text-2xl uppercase py-5 min-h-[44px] hover:bg-blood hover:text-ash active:bg-blood active:text-ash focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blood focus-visible:ring-offset-2 focus-visible:ring-offset-void transition-colors duration-300 relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="relative z-10">
            {loading ? "Calculating your chart..." : ctaLabel}
          </span>
          <div className="absolute inset-0 bg-blood transform scale-y-0 origin-bottom group-hover:scale-y-100 transition-transform duration-300 ease-in-out z-0" />
        </button>
      </div>
    </form>
  );
}
