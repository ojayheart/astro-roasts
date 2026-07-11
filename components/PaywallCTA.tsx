"use client";

import { useState } from "react";
import CheckoutModal from "./CheckoutModal";
import { track } from "@/lib/track";
import { shareStoryCard } from "@/lib/share-story";

interface PaywallCTAProps {
  roastId: string;
  amountMinorUnits?: number;
  kind?: string;
  onUnlocked?: () => void;
}

type ShareStep = "idle" | "sharing" | "confirm" | "unlocking" | "failed";

export default function PaywallCTA({
  roastId,
  amountMinorUnits = 500,
  kind = "solo",
  onUnlocked,
}: PaywallCTAProps) {
  const price = `€${(amountMinorUnits / 100).toFixed(0)}`;
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<ShareStep>("idle");

  const shareEligible = kind === "solo" && !!onUnlocked;

  const requestUnlock = async () => {
    setStep("unlocking");
    try {
      const res = await fetch("/api/share-unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roastId }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.unlocked) {
        track("unlock_via_share_succeeded", { roastId });
        onUnlocked?.();
        return;
      }
      track("unlock_via_share_failed", {
        roastId,
        reason: json.error || `http_${res.status}`,
      });
      setStep("failed");
    } catch {
      track("unlock_via_share_failed", { roastId, reason: "network" });
      setStep("failed");
    }
  };

  const handleShareToUnlock = async () => {
    track("share_to_unlock_clicked", { roastId });
    setStep("sharing");
    const outcome = await shareStoryCard(roastId);

    if (outcome === "aborted") {
      setStep("idle");
      return;
    }
    track("share_to_unlock_shared", { roastId, method: outcome });

    // Share sheet actually resolved → unlock straight away. Download/copy
    // fallbacks can't observe the post, so ask for the honor-system confirm.
    if (outcome === "shared" || outcome === "shared_url") {
      await requestUnlock();
    } else {
      setStep("confirm");
    }
  };

  const primaryButtonClass =
    "interactive w-full bg-ash text-void font-syne font-extrabold uppercase tracking-[0.15em] py-5 px-8 min-h-[44px] text-center text-lg md:text-xl hover:bg-blood hover:text-ash active:bg-blood active:text-ash focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blood focus-visible:ring-offset-2 focus-visible:ring-offset-void transition-colors duration-300 relative overflow-hidden group disabled:opacity-60 disabled:pointer-events-none";

  return (
    <>
      <div className="paywall-ui w-full flex flex-col items-center my-10 md:my-12 px-6">
        <div className="w-full max-w-md flex flex-col items-center">
          <span className="text-[10px] md:text-xs font-mono tracking-[0.15em] text-ash/60 mb-4 uppercase text-center">
            Full dossier: every planet, house, aspect, and callback.
          </span>

          {shareEligible ? (
            <>
              {step === "confirm" || step === "unlocking" ? (
                <div className="w-full flex flex-col items-center gap-3">
                  <span className="text-xs font-mono tracking-[0.1em] text-ash/80 text-center">
                    Card saved. Post it to your story, tag @astroroasted, then —
                  </span>
                  <button
                    type="button"
                    disabled={step === "unlocking"}
                    onClick={requestUnlock}
                    className={primaryButtonClass}
                  >
                    <span className="relative z-10 block group-hover:scale-[1.02] transition-transform duration-300">
                      {step === "unlocking"
                        ? "Unlocking…"
                        : "I posted it → unlock"}
                    </span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={step === "sharing"}
                  onClick={handleShareToUnlock}
                  className={primaryButtonClass}
                >
                  <span className="relative z-10 block group-hover:scale-[1.02] transition-transform duration-300">
                    {step === "sharing"
                      ? "Opening share…"
                      : "Share to your story → unlock free"}
                  </span>
                </button>
              )}

              {step === "failed" && (
                <span className="text-[10px] font-mono tracking-[0.1em] text-blood mt-3 text-center">
                  Unlock didn&apos;t go through — try again in a minute, or grab
                  it below.
                </span>
              )}

              <button
                type="button"
                onClick={() => {
                  track("paywall_button_clicked", { roastId });
                  setOpen(true);
                }}
                className="interactive text-[11px] font-mono tracking-[0.15em] text-ash/50 mt-4 uppercase underline underline-offset-4 hover:text-ash focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blood transition-colors duration-300"
              >
                or skip the share — {price}
              </button>
            </>
          ) : (
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
          )}

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
