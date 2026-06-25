"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { identifyByEmail, track } from "@/lib/track";

export default function BirthForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [gender, setGender] = useState("");
  const [email, setEmail] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [placeName, setPlaceName] = useState("");
  const [countryName, setCountryName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const genderRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const placeRef = useRef<HTMLInputElement>(null);
  const countryRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    track("birth_form_opened", {});
  }, []);

  const inputClass =
    "w-full bg-transparent border-b border-ash/20 text-lg md:text-xl font-syne font-bold text-ash py-3 focus:border-blood focus-visible:outline-none focus-visible:border-blood transition-colors placeholder:text-ash/20 disabled:opacity-50 disabled:cursor-not-allowed";
  const labelClass =
    "block text-xs uppercase tracking-[0.2em] text-ash/50 mb-3 font-mono";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Add your first name so the roast can address you.");
      nameRef.current?.focus();
      return;
    }
    if (!gender.trim()) {
      setError("Add your gender so the roast uses the right voice.");
      genderRef.current?.focus();
      return;
    }
    if (!date) {
      setError("Add your date of birth so we can calculate the chart.");
      dateRef.current?.focus();
      return;
    }
    if (!placeName.trim()) {
      setError("Add your birth place so we can calculate the chart.");
      placeRef.current?.focus();
      return;
    }
    if (!countryName.trim()) {
      setError("Add your birth country so we can calculate the chart.");
      countryRef.current?.focus();
      return;
    }
    setError("");
    setLoading(true);

    track("birth_form_submitted", {
      hasEmail: !!email,
      hasBirthTime: !!time,
    });
    if (email) identifyByEmail(email, { name });

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          gender,
          email: email || undefined,
          date,
          time: time || undefined,
          placeName,
          countryName,
        }),
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

  return (
    <form
      className="space-y-10"
      onSubmit={handleSubmit}
      aria-busy={loading}
      noValidate
    >
      <div className="space-y-10">
        {/* Name */}
        <div className="relative group interactive">
          <label htmlFor="birth-name" className={labelClass}>
            First name
          </label>
          <input
            ref={nameRef}
            id="birth-name"
            name="given-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
            autoComplete="given-name"
            autoCapitalize="words"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
            aria-invalid={!!error && !name.trim()}
            aria-describedby={error ? "birth-form-error" : undefined}
            className={inputClass}
            placeholder="What should the roast call you?"
          />
        </div>

        {/* Gender */}
        <div className="relative group interactive">
          <label htmlFor="birth-gender" className={labelClass}>
            Gender
          </label>
          <input
            ref={genderRef}
            id="birth-gender"
            name="sex"
            type="text"
            required
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            disabled={loading}
            autoComplete="sex"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
            aria-invalid={!!error && !gender.trim()}
            aria-describedby={error ? "birth-form-error" : undefined}
            className={inputClass}
            placeholder="e.g. woman, man, non-binary"
          />
        </div>

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

        {/* Date + Time row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
          {/* Date */}
          <div className="relative group interactive">
            <label htmlFor="birth-date" className={labelClass}>
              Date of birth
            </label>
            <input
              ref={dateRef}
              id="birth-date"
              name="bday"
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={loading}
              autoComplete="bday"
              aria-invalid={!!error && !date}
              aria-describedby={error ? "birth-form-error" : undefined}
              className={inputClass}
              style={{ colorScheme: "dark" }}
            />
          </div>

          {/* Time */}
          <div className="relative group interactive">
            <label htmlFor="birth-time" className={labelClass}>
              Birth time{" "}
              <span className="text-ash/30 normal-case tracking-normal">
                (optional)
              </span>
            </label>
            <input
              id="birth-time"
              name="bday-time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              disabled={loading}
              className={inputClass}
              style={{ colorScheme: "dark" }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
          <div className="relative group interactive">
            <label htmlFor="birth-place" className={labelClass}>
              Birth place
            </label>
            <input
              ref={placeRef}
              id="birth-place"
              name="birth-place"
              type="text"
              required
              value={placeName}
              onChange={(e) => setPlaceName(e.target.value)}
              disabled={loading}
              autoComplete="address-level2"
              autoCapitalize="words"
              autoCorrect="off"
              enterKeyHint="next"
              aria-invalid={!!error && !placeName.trim()}
              aria-describedby={error ? "birth-form-error" : undefined}
              className={inputClass}
              placeholder="City or town"
            />
          </div>

          <div className="relative group interactive">
            <label htmlFor="birth-country" className={labelClass}>
              Country
            </label>
            <input
              ref={countryRef}
              id="birth-country"
              name="country-name"
              type="text"
              required
              value={countryName}
              onChange={(e) => setCountryName(e.target.value)}
              disabled={loading}
              autoComplete="country-name"
              autoCapitalize="words"
              autoCorrect="off"
              enterKeyHint="done"
              aria-invalid={!!error && !countryName.trim()}
              aria-describedby={error ? "birth-form-error" : undefined}
              className={inputClass}
              placeholder="Country"
            />
          </div>
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
            {loading ? "Calculating your chart..." : "Generate my roast"}
          </span>
          <div className="absolute inset-0 bg-blood transform scale-y-0 origin-bottom group-hover:scale-y-100 transition-transform duration-300 ease-in-out z-0" />
        </button>
      </div>
    </form>
  );
}
