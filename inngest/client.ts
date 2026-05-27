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
    name: string;
    email: string | null;
    date: string;
    time: string | null;
    city: string;
  };
};
