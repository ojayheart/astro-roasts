"use client";

interface PaywallCTAProps {
  roastId: string;
}

export default function PaywallCTA({ roastId }: PaywallCTAProps) {
  const storeId = process.env.NEXT_PUBLIC_LEMON_SQUEEZY_STORE_ID;
  const variantId = process.env.NEXT_PUBLIC_LEMON_SQUEEZY_VARIANT_ID;

  const checkoutUrl =
    storeId && variantId
      ? `https://${storeId}.lemonsqueezy.com/checkout/buy/${variantId}?checkout[custom][roast_id]=${roastId}`
      : "#";

  return (
    <div className="paywall-ui fixed bottom-0 left-0 w-full pt-32 pb-8 px-6 paywall-gradient z-50 flex flex-col items-center justify-end pointer-events-none">
      <div className="pointer-events-auto w-full max-w-md flex flex-col items-center">
        <span className="text-[10px] md:text-xs font-mono tracking-[0.15em] text-ash/60 mb-4 uppercase text-center">
          Every planet. Every house. Every pattern.
        </span>
        <a
          href={checkoutUrl}
          className="lemonsqueezy-button interactive w-full bg-ash text-void font-syne font-extrabold uppercase tracking-[0.15em] py-5 px-8 text-center text-lg md:text-xl hover:bg-blood hover:text-ash transition-colors duration-300 relative overflow-hidden group block"
        >
          <span className="relative z-10 block group-hover:scale-[1.02] transition-transform duration-300">
            Unlock full reading — $5
          </span>
        </a>
      </div>
    </div>
  );
}
