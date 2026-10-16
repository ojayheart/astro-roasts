# App Store listing: AstroRoast

Everything needed to fill App Store Connect. Screenshots (1320×2868, the 6.9" set) are in `screenshots-6.9in/`, in order. Tone rules: see `../BUILD-BRIEF.md`.

## App
| Field | Value |
|---|---|
| Name | AstroRoast |
| Subtitle (≤30) | Astrology, honestly roasted |
| Bundle ID | com.astroroast.app |
| SKU | astroroast-ios |
| Primary language | English (U.S.) |
| Primary category | Entertainment |
| Secondary category | Lifestyle |
| Age rating | 12+ (infrequent/mild crude humor; no other flags) |
| Price | Free (in-app purchases) |
| Copyright | © 2026 Oliver Hart |
| Support URL | https://astroroast.com |
| Marketing URL | https://astroroast.com |
| Privacy policy URL | https://astroroast.com/privacy |
| Terms of use (EULA) | Apple's standard EULA, or https://astroroast.com/terms |

## Promotional text (≤170)
Astrology and Human Design, read back to you honestly, with jokes. Deeper insight into yourself, lighter mood. Your daily line is free.

## Description
Stop blaming your moon sign.

AstroRoast reads your astrology and Human Design back to you the way a very smart friend would: radically honest, properly funny, and never mean. We tease because we like you.

FREE, EVERY DAY
• A daily line written from the planets actually moving across your chart, with a Do, a Don't and an Absolutely Not
• "Why this?" shows the exact transit behind the joke, when it peaks and when it last happened
• The moon dial: drag through the month and watch your transits arrive
• Home Screen and Lock Screen widgets

YOUR ROAST
• A full written roast of your chart, yours to keep and share
• Share cards that make the best line impossible to ignore
• Bring every roast you've ever bought into one place with your email

ROAST+
• Your transits on the moon dial and calendar sync (Apple Calendar, Google Calendar, Outlook)
• The Sunday roast: your week ahead, read aloud
• Situationships: the long transits you're currently entangled with
• Draft check: paste the text you're about to send and get a calmer version
• Your full Human Design roast
• Coven: see how your charts clash with the people you love, and roast anyone, even if they're not on the app

Everything is calculated on your phone from your birth details, so the daily line works offline. We don't sell your data.

Roast+ is $5.99 a month or $39.99 a year, with 7 days free on the yearly plan. Payment is charged to your Apple Account at confirmation of purchase and renews automatically unless cancelled at least 24 hours before the end of the period. Manage or cancel in Settings.

Terms: https://astroroast.com/terms · Privacy: https://astroroast.com/privacy

## Keywords (≤100, comma-separated, no spaces)
astrology,human design,horoscope,birth chart,moon,zodiac,transits,compatibility,roast,funny,daily,sign

## What's new (1.0)
Hello. Your daily line, the moon dial, your full roast and Roast+ are all here.

## In-app purchases (create these exactly)
| Reference name | Product ID | Type | Price (USD) | Display name | Description |
|---|---|---|---|---|---|
| Full roast | com.astroroast.app.roast | Consumable | 4.99 | Full roast | Your full roast, yours to keep. |
| Roast someone | com.astroroast.app.roast.other | Consumable | 2.99 | Roast someone | Roast a friend who isn't on the app. |
| Couple roast | com.astroroast.app.roast.couple | Consumable | 7.99 | Couple roast | A roast for two charts. |
| Roast+ Monthly | com.astroroast.app.plus.monthly | Auto-renewable, 1 month | 5.99 | Roast+ Monthly | Month dial, calendar sync, Sunday roast and more. |
| Roast+ Yearly | com.astroroast.app.plus.yearly | Auto-renewable, 1 year | 39.99 | Roast+ Yearly | Everything in Roast+, a year at a time. |

Subscription group: **Roast+** (display name "Roast+"). Order in group: Yearly first, Monthly second.
Introductory offer on **Yearly**: free, 1 week, new subscribers.
Each in-app purchase needs a review screenshot: use `screenshots-6.9in/8-plans.png`.

## App Privacy ("nutrition label")
Data not used to track you. Collected, linked to you, for app functionality only:
- Contact info: email address (only if the person links an email)
- User content: other user content (name, birth date, birth time, place of birth, which the roast is written from)
- Purchases: purchase history (which roasts are unlocked)
No analytics or advertising SDKs are in the iOS app.

## Review notes
No sign-in is required. To see everything: tap Let's begin, enter any name, a birth date, any town and tap Get my roast; the roast takes about two minutes. The paid features can be tested with the sandbox account in the App Store Connect "Sandbox Apple Account" field. Optional: "I already have roasts" signs in by emailing a 6-digit code; the reviewer can skip it. Calendar sync only asks for calendar access when the person taps "Connect your calendar" in the Roast+ calendar screen, and only adds events it creates. Account deletion: You tab → your email → Delete my account.

## Export compliance
Uses only standard encryption (HTTPS). `ITSAppUsesNonExemptEncryption` is false in the app.
