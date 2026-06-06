"use client";

import { useState } from "react";
import CheckoutModal from "./CheckoutModal";
import { track } from "@/lib/track";

interface PaywallCTAProps {
  roastId: string;
}

export default function PaywallCTA({ roastId }: PaywallCTAProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="paywall-ui w-full flex flex-col items-center my-10 md:my-12 px-6">
        <div className="w-full max-w-md flex flex-col items-center">
          <span className="text-[10px] md:text-xs font-mono tracking-[0.15em] text-ash/60 mb-4 uppercase text-center">
            Full dossier: every planet, house, aspect, and callback.
          </span>
          <button
            type="button"
            onClick={() => {
              track("paywall_button_clicked", { roastId });
              setOpen(true);
            }}
            className="interactive w-full bg-ash text-void font-syne font-extrabold uppercase tracking-[0.15em] py-5 px-8 min-h-[44px] text-center text-lg md:text-xl hover:bg-blood hover:text-ash active:bg-blood active:text-ash focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blood focus-visible:ring-offset-2 focus-visible:ring-offset-void transition-colors duration-300 relative overflow-hidden group"
          >
            <span className="relative z-10 block group-hover:scale-[1.02] transition-transform duration-300">
              Unlock the full roast — $5
            </span>
          </button>
          <span className="text-[10px] font-mono tracking-[0.15em] text-ash/40 mt-3 uppercase text-center">
            Entertainment only · satire · not advice
          </span>
        </div>
      </div>

      <CheckoutModal
        roastId={roastId}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
