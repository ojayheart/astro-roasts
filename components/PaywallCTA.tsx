"use client";

declare global {
  interface Window {
    Paddle?: {
      Checkout: {
        open: (options: Record<string, unknown>) => void;
      };
    };
  }
}

interface PaywallCTAProps {
  roastId: string;
}

export default function PaywallCTA({ roastId }: PaywallCTAProps) {
  const priceId = process.env.NEXT_PUBLIC_PADDLE_PRICE_ID?.trim() ?? "";

  const handleCheckout = () => {
    if (!window.Paddle || !priceId) {
      console.error("Paddle checkout is not ready.");
      return;
    }

    window.Paddle.Checkout.open({
      settings: {
        displayMode: "overlay",
        variant: "one-page",
        theme: "dark",
      },
      items: [{ priceId, quantity: 1 }],
      customData: { roastId },
    });
  };

  return (
    <div className="paywall-ui fixed bottom-0 left-0 w-full pt-32 pb-8 px-6 paywall-gradient z-50 flex flex-col items-center justify-end pointer-events-none">
      <div className="pointer-events-auto w-full max-w-md flex flex-col items-center">
        <span className="text-[10px] md:text-xs font-mono tracking-[0.15em] text-ash/60 mb-4 uppercase text-center">
          Full dossier: every planet, house, aspect, and callback.
        </span>
        <button
          onClick={handleCheckout}
          className="interactive w-full bg-ash text-void font-syne font-extrabold uppercase tracking-[0.15em] py-5 px-8 text-center text-lg md:text-xl hover:bg-blood hover:text-ash transition-colors duration-300 relative overflow-hidden group"
        >
          <span className="relative z-10 block group-hover:scale-[1.02] transition-transform duration-300">
            Unlock the full roast — $5
          </span>
        </button>
      </div>
    </div>
  );
}
