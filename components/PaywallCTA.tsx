"use client";

import { useState } from "react";
import CheckoutModal from "./CheckoutModal";

interface PaywallCTAProps {
  roastId: string;
}

export default function PaywallCTA({ roastId }: PaywallCTAProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="paywall-ui fixed bottom-0 left-0 w-full pt-32 pb-8 px-6 paywall-gradient z-50 flex flex-col items-center justify-end pointer-events-none">
        <div className="pointer-events-auto w-full max-w-md flex flex-col items-center">
          <span className="text-[10px] md:text-xs font-mono tracking-[0.15em] text-ash/60 mb-4 uppercase text-center">
            Full dossier: every planet, house, aspect, and callback.
          </span>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="interactive w-full bg-ash text-void font-syne font-extrabold uppercase tracking-[0.15em] py-5 px-8 text-center text-lg md:text-xl hover:bg-blood hover:text-ash transition-colors duration-300 relative overflow-hidden group"
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
