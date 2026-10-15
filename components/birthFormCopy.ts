/**
 * Every user-facing string in the birth form (BirthForm + PersonFields).
 *
 * Edit copy here only. Components read from this object and never hard-code
 * text. Empty strings are allowed for optional slots (hints, subtitles,
 * fine print): an empty string simply renders nothing.
 */

export type FormMode = "solo" | "couple" | "family";

export type FieldKey =
  | "name"
  | "gender"
  | "date"
  | "time"
  | "place"
  | "email";

/**
 * Who a validation error is about. Solo mode talks to "you"; couple/family
 * modes talk about "person N". Build one with COPY.errors.who.
 */
export type Who = {
  /** "your" / "person 2's" */
  possessive: string;
  /** "you" / "them" */
  object: string;
};

type FieldCopy = {
  label: string;
  /** Shown inside an empty input. Not rendered for date/time on desktop. */
  placeholder: string;
  /** Small helper line under the row. Empty string hides it. */
  hint: string;
};

export const COPY = {
  modes: {
    /** Accessible name for the segmented control. */
    ariaLabel: "Who is getting roasted",
    solo: {
      tab: "Just me",
      subtitle: "One chart. Nobody else to blame this time.",
    },
    couple: {
      tab: "Us two",
      subtitle: "Two charts, cross-referenced. Settles who's the problem.",
    },
    family: {
      tab: "My lot",
      subtitle: "Three to six people. Finally explains Christmas.",
    },
  } satisfies { ariaLabel: string } & Record<
    FormMode,
    { tab: string; subtitle: string }
  >,

  /** Small uppercase captions above each grouped card. */
  groups: {
    who: "Who",
    born: "Born",
    email: "Delivery",
  },

  fields: {
    name: {
      label: "First name",
      placeholder: "What the roast calls you",
      hint: "",
    },
    gender: {
      label: "Gender",
      placeholder: "",
      hint: "",
    },
    date: {
      label: "Date of birth",
      /** iOS Safari shows no native placeholder for empty dates. */
      placeholder: "Select",
      hint: "The real year, please. Saturn already knows.",
    },
    time: {
      label: "Birth time",
      placeholder: "Optional",
      hint: "Sharper roast. Don't know it? Text your mum. She'll know to the minute.",
    },
    place: {
      label: "Birthplace",
      placeholder: "Town, country",
      hint: "Include the country. There's a Paris in Texas.",
    },
    email: {
      label: "Email for your link",
      placeholder: "you@wherever.com",
      hint: "So the link survives you closing the tab.",
    },
  } satisfies Record<FieldKey, FieldCopy>,

  /** Tap-to-pick gender options (value is what the roast receives). */
  genderOptions: [
    { value: "woman", label: "Woman" },
    { value: "man", label: "Man" },
    { value: "non-binary", label: "Non-binary" },
  ],

  /** Tag shown next to labels of optional fields. */
  optionalTag: "(optional)",

  person: {
    // Works for partners and friends alike.
    label: (n: number) =>
      n === 1 ? "You" : n === 2 ? "Your person" : `Person ${n}`,
    remove: "Remove",
    removeAriaLabel: (n: number) => `Remove person ${n} (−€4)`,
    add: "Drag in another relative",
    addPriceNote: "+ €4",
  },

  cta: {
    solo: "Roast me. I'm fine.",
    couple: "Roast us. We're fine.",
    family: "Ruin Christmas early",
    loading: "Doing the maths. Brace.",
  } satisfies Record<FormMode, string> & { loading: string },

  /** Line under the CTA. Receives the formatted price, e.g. "€5". */
  priceHint: {
    solo: (price: string) => `Free teaser. ${price} for the bits that hurt.`,
    couple: (price: string) => `Free teaser. ${price} to see who's worse.`,
    family: (price: string) => `Free teaser. ${price}. Mum's paying.`,
  } satisfies Record<FormMode, (price: string) => string>,

  finePrint:
    "For entertainment only. Not a diagnosis. If it's accurate, take it up with your mum.",

  errors: {
    who: {
      solo: { possessive: "your", object: "you" } as Who,
      person: (n: number): Who => ({
        possessive:
          n === 1 ? "your" : n === 2 ? "your person's" : `person ${n}'s`,
        object: n === 1 ? "you" : "them",
      }),
    },
    name: (who: Who) =>
      `Add ${who.possessive} first name. Hard to roast a blank.`,
    gender: (who: Who) =>
      `Pick ${who.possessive} gender, so the insults use the right pronouns.`,
    date: (who: Who) =>
      `Add ${who.possessive} date of birth. Without it, the planets have nothing on ${who.object}.`,
    place: (who: Who) =>
      `Add ${who.possessive} birthplace. "Earth" is too vague, even for astrology.`,
    /** Fallback when /api/generate fails without its own message. */
    generic:
      "We couldn't start your roast. That's on us, not your Saturn. Check your details and try again.",
    network:
      "Your Wi-Fi is in retrograde. Check your connection and try again.",
  },
};
