"use client";

import { useState, useRef, useEffect } from "react";
import { searchCities } from "@/lib/cities";

interface CityAutocompleteProps {
  value: string;
  onChange: (city: string) => void;
}

export default function CityAutocomplete({
  value,
  onChange,
}: CityAutocompleteProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInput = (val: string) => {
    setQuery(val);
    const matches = searchCities(val);
    setResults(matches);
    setOpen(matches.length > 0);
    setActiveIndex(-1);
    if (!matches.includes(val)) {
      onChange("");
    }
  };

  const selectCity = (city: string) => {
    setQuery(city);
    onChange(city);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      selectCity(results[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapperRef} className="relative group interactive">
      <label className="block text-[11px] uppercase tracking-[0.2em] text-ash/40 mb-4 font-mono">
        City of Birth
      </label>
      <input
        type="text"
        required
        value={query}
        onChange={(e) => handleInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (results.length > 0) setOpen(true);
        }}
        className="w-full bg-transparent border-b border-ash/20 text-2xl md:text-3xl font-syne font-bold text-ash py-3 focus:border-blood focus:outline-none transition-colors placeholder:text-ash/20"
        placeholder="Start typing a city"
        autoComplete="off"
      />

      {open && results.length > 0 && (
        <ul className="absolute z-50 top-full left-0 w-full mt-2 border border-ash/20 bg-void max-h-60 overflow-y-auto">
          {results.map((city, i) => (
            <li
              key={city}
              onMouseDown={() => selectCity(city)}
              className={`px-4 py-3 text-sm font-mono cursor-pointer transition-colors ${
                i === activeIndex
                  ? "bg-bruise text-blood"
                  : "text-ash/70 hover:bg-bruise/50 hover:text-ash"
              }`}
            >
              {city}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
