"use client";

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

export default function PersonFields({
  idPrefix,
  label,
  value,
  onChange,
  disabled,
}: {
  idPrefix: string;
  label: string | null;
  value: PersonFormValue;
  onChange: (v: PersonFormValue) => void;
  disabled: boolean;
}) {
  const inputClass =
    "w-full bg-transparent border-b border-ash/20 text-lg md:text-xl font-syne font-bold text-ash py-3 focus:border-blood focus-visible:outline-none focus-visible:border-blood transition-colors placeholder:text-ash/20 disabled:opacity-50 disabled:cursor-not-allowed";
  const labelClass =
    "block text-xs uppercase tracking-[0.2em] text-ash/50 mb-3 font-mono";

  return (
    <div className="space-y-10">
      {label && (
        <p className="text-xs uppercase tracking-[0.2em] text-blood font-mono">
          {label}
        </p>
      )}

      {/* Name */}
      <div className="relative group interactive">
        <label htmlFor={`${idPrefix}-name`} className={labelClass}>
          First name
        </label>
        <input
          id={`${idPrefix}-name`}
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
          className={inputClass}
          placeholder="What should the roast call you?"
        />
      </div>

      {/* Gender */}
      <div className="relative group interactive">
        <label htmlFor={`${idPrefix}-gender`} className={labelClass}>
          Gender
        </label>
        <input
          id={`${idPrefix}-gender`}
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
          className={inputClass}
          placeholder="e.g. woman, man, non-binary"
        />
      </div>

      {/* Date + Time row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
        {/* Date */}
        <div className="relative group interactive">
          <label htmlFor={`${idPrefix}-date`} className={labelClass}>
            Date of birth
          </label>
          <input
            id={`${idPrefix}-date`}
            name="bday"
            type="date"
            required
            value={value.date}
            onChange={(e) => onChange({ ...value, date: e.target.value })}
            disabled={disabled}
            autoComplete="bday"
            className={inputClass}
            style={{ colorScheme: "dark" }}
          />
        </div>

        {/* Time */}
        <div className="relative group interactive">
          <label htmlFor={`${idPrefix}-time`} className={labelClass}>
            Birth time{" "}
            <span className="text-ash/30 normal-case tracking-normal">
              (optional)
            </span>
          </label>
          <input
            id={`${idPrefix}-time`}
            name="bday-time"
            type="time"
            value={value.time}
            onChange={(e) => onChange({ ...value, time: e.target.value })}
            disabled={disabled}
            className={inputClass}
            style={{ colorScheme: "dark" }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
        <div className="relative group interactive">
          <label htmlFor={`${idPrefix}-place`} className={labelClass}>
            Birth place
          </label>
          <input
            id={`${idPrefix}-place`}
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
            className={inputClass}
            placeholder="City or town"
          />
        </div>

        <div className="relative group interactive">
          <label htmlFor={`${idPrefix}-country`} className={labelClass}>
            Country
          </label>
          <input
            id={`${idPrefix}-country`}
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
            className={inputClass}
            placeholder="Country"
          />
        </div>
      </div>
    </div>
  );
}
