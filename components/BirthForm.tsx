"use client";

import { useState } from "react";
import CityAutocomplete from "./CityAutocomplete";

interface BirthFormProps {
  onSubmit: (data: {
    name: string;
    email?: string;
    date: string;
    time?: string;
    city: string;
  }) => void;
}

export default function BirthForm({ onSubmit }: BirthFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [city, setCity] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!city) {
      setError("Select a city from the dropdown");
      return;
    }
    setError("");

    onSubmit({
      name,
      email: email || undefined,
      date,
      time: time || undefined,
      city,
    });
  };

  return (
    <form className="space-y-10" onSubmit={handleSubmit}>
      <div className="space-y-10">
        {/* Name */}
        <div className="relative group interactive">
          <label className="block text-xs uppercase tracking-[0.2em] text-ash/50 mb-3 font-mono">
            First Name
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-transparent border-b border-ash/20 text-lg md:text-xl font-syne font-bold text-ash py-3 focus:border-blood focus:outline-none transition-colors placeholder:text-ash/20"
            placeholder="Enter your name"
          />
        </div>

        {/* Email */}
        <div className="relative group interactive">
          <label className="block text-xs uppercase tracking-[0.2em] text-ash/50 mb-3 font-mono">
            Email (for your roast)
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-transparent border-b border-ash/20 text-lg md:text-xl font-syne font-bold text-ash py-3 focus:border-blood focus:outline-none transition-colors placeholder:text-ash/20"
            placeholder="optional@email.com"
          />
        </div>

        {/* Date + Time row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-14">
          {/* Date */}
          <div className="relative group interactive">
            <label className="block text-xs uppercase tracking-[0.2em] text-ash/50 mb-3 font-mono">
              Date of Birth
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-transparent border-b border-ash/20 text-lg md:text-xl font-syne font-bold text-ash py-3 focus:border-blood focus:outline-none transition-colors"
              style={{ colorScheme: "dark" }}
            />
          </div>

          {/* Time */}
          <div className="relative group interactive">
            <label className="block text-xs uppercase tracking-[0.2em] text-ash/50 mb-3 font-mono">
              Exact Time{" "}
              <span className="text-ash/30 normal-case tracking-normal">
                (optional)
              </span>
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full bg-transparent border-b border-ash/20 text-lg md:text-xl font-syne font-bold text-ash py-3 focus:border-blood focus:outline-none transition-colors"
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
          className="interactive w-full bg-ash text-void font-syne font-bold text-lg md:text-2xl uppercase py-5 hover:bg-blood hover:text-ash transition-colors duration-300 relative overflow-hidden group"
        >
          <span className="relative z-10">Expose Me</span>
          <div className="absolute inset-0 bg-blood transform scale-y-0 origin-bottom group-hover:scale-y-100 transition-transform duration-300 ease-in-out z-0" />
        </button>
      </div>
    </form>
  );
}
