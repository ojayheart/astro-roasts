"use client";

import { useState } from "react";
import CheckoutModal from "./CheckoutModal";
import { track } from "@/lib/track";
import { formatPrice } from "@/lib/currency";

interface PaywallCTAProps {
  roastId: string;
  amountMinorUnits?: number;
  currency?: string;
}

/**
 * Share-to-unlock was removed 2026-07-30: people didn't need to share to get
 * the card (the story image downloads either way), so the free unlock was
 * paying out for nothing. Sharing still exists — see ShareButton — it just no
 * longer lifts the paywall. /api/share-unlock stays for in-flight sessions.
 */
export default function PaywallCTA({
  roastId,
  amountMinorUnits = 500,
  currency = "usd",
}: PaywallCTAProps) {
  const price = formatPrice(amountMinorUnits, currency);
  const [open, setOpen] = useState(false);

  const primaryButtonClass =
    "interactive w-full bg-ash text-void font-syne font-extrabold uppercase tracking-[0.15em] py-5 px-8 min-h-[44px] text-center text-lg md:text-xl hover:bg-blood hover:text-ash active:bg-blood active:text-ash focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blood focus-visible:ring-offset-2 focus-visible:ring-offset-void transition-colors duration-300 relative overflow-hidden group disabled:opacity-60 disabled:pointer-events-none";

  return (
    <>
      <div className="paywall-ui w-full flex flex-col items-center my-10 md:my-12 px-6">
        <div className="w-full max-w-md flex flex-col items-center">
          <span className="text-[10px] md:text-xs font-mono tracking-[0.15em] text-ash/60 mb-4 uppercase text-center">
            The full set: every planet, house, aspect, and callback.
          </span>

          <button
            type="button"
            onClick={() => {
              track("paywall_button_clicked", { roastId });
              setOpen(true);
            }}
            className={primaryButtonClass}
          >
            <span className="relative z-10 block group-hover:scale-[1.02] transition-transform duration-300">
              Unlock the full roast — {price}
            </span>
          </button>

          <span className="text-[10px] font-mono tracking-[0.15em] text-ash/40 mt-3 uppercase text-center">
            One-time payment · entertainment only · satire · not advice
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
