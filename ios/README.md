# AstroRoast for iOS

SwiftUI app (iOS 17+) that talks to the existing astroroast.com API. Free daily roast from your own chart, moon dial with your transits,
Coven (friends and family), share cards, widgets, Live Activity while a roast is cooking, and Roast+ (subscription).

Design intent and positioning: [`docs/ios/BUILD-BRIEF.md`](../docs/ios/BUILD-BRIEF.md). Original mockups: [`docs/ios/design`](../docs/ios/design).

## Build and run

```bash
brew install xcodegen          # once
cd ios && xcodegen generate    # project.yml is the source of truth; AstroRoast.xcodeproj is generated and git-ignored
open AstroRoast.xcodeproj      # scheme "AstroRoast", run on any iOS 17+ simulator
```

Needs Xcode 26 and an iOS 26 simulator runtime. Free disk space matters: a debug build plus simulator is several GB.

### Targets
| Target | What |
|---|---|
| `AstroKit` (framework) | Everything that isn't UI chrome: ephemeris, chart maths, transits, the voice engine, Human Design, calendar plan, models, persistence, API client, theme, widget views |
| `AstroRoast` (app) | Screens, app state, StoreKit 2, notifications, EventKit, Live Activity |
| `AstroWidgets` (extension) | Home/Lock Screen widgets, Live Activity UI |
| `AstroKitTests` | Engine tests against Swiss Ephemeris reference vectors |
| `AstroRoastUITests` | End-to-end journeys in the simulator |

## How it works
- **Astronomy runs on the device.** `ios/Shared/Resources/ephemeris.bin` is a daily ephemeris 1900-2100 generated from Swiss Ephemeris
  (`scripts/ios/gen_ephemeris.py`) and interpolated with a 4-point cubic (max error 0.0015°). Today, the month dial, the Why screen,
  situationships, Human Design and the widgets all work offline. Re-run the script and `scripts/ios/gen_test_vectors.py` if the range changes.
- **Roasts come from the server.** `POST /api/generate` → poll `GET /api/roast/:id` (same endpoints the website uses). Unpaid roasts only return the teaser.
- **Purchases.** StoreKit 2. A per-roast purchase carries `appAccountToken = roast id`; the app then calls `POST /api/ios/v1/unlock` with the
  signed transaction. The server (`lib/apple-iap.ts`) verifies Apple's chain offline against Apple Root CA G3, checks bundle/product/kind/binding,
  then sets `paid`. An active Roast+ subscription unlocks any roast. Product ids live in `AstroRoast/Products.storekit` (local testing) and `Purchases.ID`.
- **Voice.** Daily lines are written from the real transit (`Voice.swift`), deterministic per day, never the same headline two days running.
- **Draft check** runs rules on the phone; nothing is sent anywhere.
- **Accounts = an email.** `POST /api/ios/v1/auth/start` emails a 6-digit code (HMAC of email + 10-minute window, no table needed), `/auth/verify`
  returns a signed one-year token, `GET /api/ios/v1/roasts` lists every roast owned by that email together with the owner's birth details, so the app restores
  the profile (places are found again on the phone, small towns included). `/roasts/claim` attaches a roast made before sign-in; `DELETE /api/ios/v1/account`
  unlinks the email (in-app account deletion). Tokens live in the Keychain, and several emails can be linked. Server env: `IOS_AUTH_SECRET` (24+ chars),
  `RESEND_API_KEY`; set `IOS_AUTH_DEBUG_CODE=1` on a dev server only to get the code back in the response.

## Launch arguments (design review and tests)
| Argument | Effect |
|---|---|
| `-demo` | Sample profile (Mara) and sample roast, in memory only; nothing is read from or written to disk |
| `-demo -fresh` | Demo mode starting at the welcome screen |
| `-route welcome\|birth\|rising\|warmup\|generating\|teaser\|main` | Jump to a screen |
| `-tab today\|month\|coven\|you` | Open a tab |
| `-open why\|roast\|share\|plans\|calendar\|sunday\|situations\|receipts\|draft\|bodygraph\|anyone\|day\|widgets` | Open a screen |
| `-resetstate -cannedplaces` | Real app path with a clean profile and offline city search (used by the network tests) |
| env `ASTROROAST_API=http://127.0.0.1:3999` | Point at another server (a local mock for the tests; default https://astroroast.com) |

Tap the footer line on the You tab five times for a developer field that overrides the API base.

## Tests
```bash
cd ios
xcodebuild test -project AstroRoast.xcodeproj -scheme AstroRoast -destination 'platform=iOS Simulator,name=iPhone 17 Pro'
cd .. && node --test test/apple-iap.test.ts      # server-side purchase verification
```
`NetworkFlowTests` expect a mock of the roast API on 127.0.0.1:3999 (the response shapes follow `lib/roast-response.ts`); the other tests need nothing.

## Not done / needs you
- **App Store Connect**: create the products in `Purchases.ID` (3 consumables + 1 subscription group with monthly/yearly and a 7-day trial), set the team in `project.yml`, bundle id `com.astroroast.app` (override on the server with `APPLE_BUNDLE_ID`).
- **Deploy** the `/api/ios/v1/*` routes and set `IOS_AUTH_SECRET` before purchases or sign-in work in a real build. Local Xcode StoreKit testing signs with Xcode's own certificate, so use `APPLE_IAP_ALLOW_XCODE=1` and `APPLE_IAP_TEST_ROOT_PEM` on a dev server only.
- **Push when a roast is ready** needs APNs from the pipeline; the Live Activity runs on a timer and the app notifies when it's open.
- **Human Design** uses the standard gate wheel (matches the Rave Mandala order) and rules, but hasn't been compared with an external calculator beyond structural tests. 
- Astrocartography is parked in `docs/ios/parked/Cartography.swift` (engine written and tested ad hoc, no UI).
- Draft check is rules-based; an LLM rewrite would need a new server endpoint.
