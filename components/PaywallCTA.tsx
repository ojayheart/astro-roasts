"use client";

import { useState } from "react";
import CheckoutModal from "./CheckoutModal";
import { track } from "@/lib/track";
import { formatPrice } from "@/lib/currency";

interface PaywallCTAProps {
  roastId: string;
  amountMinorUnits?: number;
  currency?: string;
  onUnlocked?: () => void;
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
  onUnlocked,
}: PaywallCTAProps) {
  const price = formatPrice(amountMinorUnits, currency);
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="my-10 flex flex-col items-center border-t border-ash/15 pt-10 md:my-12">
        <p className="mb-6 max-w-sm text-center font-quote text-2xl italic leading-[1.2] text-ash md:text-[1.75rem]">
          The full set: every flaw, every pattern, every callback.
        </p>

        <button
          type="button"
          onClick={() => {
            track("paywall_button_clicked", { roastId });
            setOpen(true);
          }}
          className="cta interactive w-full max-w-md justify-between"
        >
          <span>Unlock the full roast</span>
          <span>{price}</span>
        </button>

        <span className="mt-4 text-center font-mono text-[11px] uppercase tracking-[0.15em] text-ash/50">
          One-time payment · entertainment only · satire · not advice
        </span>
      </div>

      <CheckoutModal
        roastId={roastId}
        open={open}
        onClose={() => setOpen(false)}
        onUnlocked={onUnlocked}
      />
    </>
  );
}
