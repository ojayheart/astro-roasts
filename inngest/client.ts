import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "astro-roasts",
});

// Event types
export type RoastGenerateEvent = {
  name: "roast/generate";
  data: {
    roastId: string;
    userId: string;
    name?: string;
    gender?: string;
    email: string | null;
    date?: string;
    time?: string | null;
    city?: string;
    kind?: "solo" | "couple" | "family";
    relationship?: string;
    people?: Array<{
      name: string;
      gender: string;
      date: string;
      time: string | null;
      birthPlace: string;
    }>;
    /** Present when the roast came in via the Instagram DM funnel */
    mcSubscriberId?: string;
    /** Present when the roast came in via Meta's direct Instagram webhook */
    igSenderId?: string;
  };
};

export type DailyGenerateEvent = {
  name: "daily/generate";
  data: {
    userId: string;
    /** The calendar date where the handset is, not UTC. */
    date: string;
  };
};

export type RoastAnnotateEvent = {
  name: "roast/annotate";
  data: {
    roastId: string;
  };
};
