"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CityAutocomplete from "./CityAutocomplete";

export default function BirthForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!city) {
      setError("Select a city from the dropdown");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, date, time, city }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Something went wrong");
      }

      const { id } = await res.json();
      router.push(`/roast/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate");
      setLoading(false);
    }
  };

  return (
    <form className="space-y-16" onSubmit={handleSubmit}>
      <div className="space-y-14">
        {/* Name */}
        <div className="relative group interactive">
          <label className="block text-[11px] uppercase tracking-[0.2em] text-ash/40 mb-4 font-mono">
            First Name
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-transparent border-b border-ash/20 text-2xl md:text-3xl font-syne font-bold text-ash py-3 focus:border-blood focus:outline-none transition-colors placeholder:text-ash/20"
            placeholder="Enter your name"
          />
        </div>

        {/* Date + Time row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-14">
          {/* Date */}
          <div className="relative group interactive">
            <label className="block text-[11px] uppercase tracking-[0.2em] text-ash/40 mb-4 font-mono">
              Date of Birth
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-transparent border-b border-ash/20 text-2xl md:text-3xl font-syne font-bold text-ash py-3 focus:border-blood focus:outline-none transition-colors"
              style={{ colorScheme: "dark" }}
            />
          </div>

          {/* Time */}
          <div className="relative group interactive">
            <label className="block text-[11px] uppercase tracking-[0.2em] text-ash/40 mb-4 font-mono">
              Exact Time (Don&apos;t lie)
            </label>
            <input
              type="time"
              required
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full bg-transparent border-b border-ash/20 text-2xl md:text-3xl font-syne font-bold text-ash py-3 focus:border-blood focus:outline-none transition-colors"
              style={{ colorScheme: "dark" }}
            />
          </div>
        </div>

        {/* City */}
        <CityAutocomplete value={city} onChange={setCity} />
      </div>

      {error && <p className="text-blood text-sm font-mono">{error}</p>}

      {/* CTA */}
      <div className="pt-4">
        <button
          type="submit"
          disabled={loading}
          className="interactive w-full bg-ash text-void font-syne font-bold text-2xl md:text-4xl uppercase py-8 hover:bg-blood hover:text-ash transition-colors duration-300 relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="relative z-10">
            {loading ? "Reading the stars..." : "Expose Me"}
          </span>
          <div className="absolute inset-0 bg-blood transform scale-y-0 origin-bottom group-hover:scale-y-100 transition-transform duration-300 ease-in-out z-0" />
        </button>
      </div>
    </form>
  );
}
