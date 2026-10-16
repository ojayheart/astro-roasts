# AstroRoast iOS: build brief

Handoff from the design session (2026-10-16). Everything needed to start building is here; don't re-litigate the design decisions below.

## Sources
- Design canvas (22 screens, live): https://claude.ai/artifact/SbdHXQvAXDLa7Vp4ESNMqB. Read with the Artifact tool, `action: "read"`.
- Local copies of every screen: `docs/ios/design/*.dc.html` (plain HTML + inline styles; `canvas.json` lists titles and order). Treat these as the visual spec.
- Backend: this Next.js repo. Existing routes in `app/api/` (`generate`, `roast/[id]`, `roast-progress`, `chart`, `chart-annotations`, `checkout`, `payment-intent`, `verify-checkout`, `webhooks`, `share-unlock`, `redeem-code`). Chart maths is Swiss Ephemeris (`natal_chart.py`), roast pipeline in `lib/roast-*.ts` + `inngest/`.

## Positioning (the filter for every decision)
Co-Star is cryptic and getting colder (78% of its last 500 reviews are 1–2★: removed free features, generic AI text, paywalls, bleak advice). CHANI is sincere wellness at $11.99/mo. AstroRoast is **the funny friend who shows receipts and helps you act**:
- Funny, never bleak. Roast traits; never tell anyone to dump a partner or that a friend is a traitor.
- Useful: every joke comes with a thing to do and a date.
- Honest: show the chart behind every line ("Why this?") and our own hit rate (Receipts).
- Never take away a free feature once shipped. Never paywall the free widget.
- Max ~2 notifications a week by default; the widget carries the daily line.

## Visual system
- Ground `#030303`, surfaces `#0b0b0b` / `#0e0e0e`, hairlines `#1a1a1a`–`#2a2a2a`.
- Text `#e5e5e5`, secondary `#a8a8a8`, tertiary `#8f8f8f` (don't go darker for text).
- Moonlight `#d9d4cc`: primary buttons (dark text `#0a0a0a`), toggles, selection.
- Ember `#ff4a1c`: sparing accent only (personal-transit dots, one word in a headline, small labels). Never a big fill on interactive controls.
- Type: Syne (800 uppercase for hero moments only; 600–700 sentence case on working screens), DM Mono for labels/data, SF Pro for UI/body.
- Bold display design only where there's room (welcome, roast headlines, share card, widgets); quiet controls where people interact.
- Touch targets ≥44pt, Dynamic Type, VoiceOver labels, reduce-motion respected (the month dial's drift/breathe animations).

## Stack
- SwiftUI, iOS 17+, Swift 6. Xcode 26.6 and the iOS 26.5 simulator ("iPhone 17 Pro") are installed on this Mac.
- App code in `ios/` at repo root (Xcode project `AstroRoast`). WidgetKit extension + ActivityKit (Live Activity) target.
- StoreKit 2: non-consumable "Full roast" ($4.99), consumable "Roast someone" ($2.99), auto-renewable "Roast+" ($5.99/mo, $39.99/yr, 7-day trial). Server-side verification via App Store Server API.
- Auth: Sign in with Apple (no phone numbers, no sign-up wall before value; the first teaser must work before any account).
- Backend: add versioned JSON endpoints under `app/api/ios/v1/` rather than bending the web routes. Back up `.env.local` before any Vercel CLI command.

## Build phases
**Phase 1: MVP (ship to TestFlight)**
1. Welcome (01) → Birth details (02) incl. unknown-time flow (22) → Notification warm-up (18) → Generating with Live Activity (03) → Dossier + paywall (04) → Full roast reader with line-select "Make a card" (05).
2. Today (06): daily line from the user's real transits, Do / Don't / Absolutely not, "Why this?" (15).
3. Share card (08) via ShareLink/ImageRenderer, story-sized.
4. Widgets (09): small + Lock Screen daily line, free.
5. Tab bar: Today · Month · Coven · You.

**Phase 2**
- Month dial (10): drag-to-rotate wheel, synced day carousel, tap the selected card → day sheet → "Roast this day"; friend overlay toggles. Moon phases and transits must be computed, not hard-coded.
- Calendar sync (11): EventKit for the iPhone calendar; ICS subscription URL served by the backend for Google/Outlook.
- Coven (07) + Roast someone not on the app (17).
- Plans / Roast+ paywall (14).

**Phase 3 (Roast+ depth)**
- Draft check (19), Situationships (20), Receipts + hit rate (21), Sunday audio roast (16), Astro map (12), Human Design (13).

## Notes and open items
- Group roast price: unknown, placeholder `[GROUP PRICE]`.
- Web pricing page says "the cosmos doesn't do recurring billing"; that needs new copy before Roast+ launches.
- Apple takes 15% (Small Business Program); price the web and the app accordingly.
- Sample data in the designs (Mara, Sam, Mum, Nov 2026 sky) is illustrative; the Nov 2026 moon phases/stations and the astro-map lines were computed for real, the Human Design chart was not.
- Disk on this Mac was nearly full; check `df -h` before big Xcode builds and keep DerivedData in check.

## Working rules
Conventional commits on a feature branch (`feat/ios-app`), never push to main. Verify on the simulator (screenshots) before calling anything done.
