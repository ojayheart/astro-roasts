# Stripe Account Signup — Nebula Limited

Copy-paste-ready answers for the Stripe onboarding flow at https://dashboard.stripe.com/register.

> **Strategy.** One Nebula-entity Stripe account hosting multiple products (astroroast first, more later). Statement descriptors per charge so customers see the product name on their card statement.

---

## 1. Account creation

| Field     | Value                                                              |
| --------- | ------------------------------------------------------------------ |
| Email     | `devops@nebuladev.io`                                              |
| Full name | `Oliver Hart`                                                      |
| Country   | `New Zealand`                                                      |
| Password  | _choose new, save to keychain as `stripe-nebula-account-password`_ |

After signup, verify the email Stripe sends to `devops@nebuladev.io` (Migadu inbox).

## 2. 2FA / phone

| Field  | Value              |
| ------ | ------------------ |
| Mobile | `+64 20 4001 0020` |

## 3. Business details

| Field                   | Value                                                                                                                                                                                                                                    |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Business type           | **Company**                                                                                                                                                                                                                              |
| Business structure      | **Private company** (NZ Limited Company)                                                                                                                                                                                                 |
| Legal business name     | `Nebula Limited`                                                                                                                                                                                                                         |
| Doing business as (DBA) | `Nebula Dev`                                                                                                                                                                                                                             |
| Company number          | `9419903`                                                                                                                                                                                                                                |
| NZBN                    | `9429053579409`                                                                                                                                                                                                                          |
| Tax (IRD) number        | `148-464-863`                                                                                                                                                                                                                            |
| Industry / MCC          | **Software** → `Computer software stores` (MCC 5734) or **Entertainment** → `Digital goods/games` if Stripe pushes a single MCC. Astroroast itself is entertainment; Nebula parent is software. Choose **Software** at the parent level. |
| Business website        | `https://nebuladev.io` (parent). Astroroast handled at product-level.                                                                                                                                                                    |
| Product description     | `AI automation agency. Builds B2B integrations, internal tooling, and consumer software products (e.g. astroroast.com — comedic personalized essays). Charges customers per product/subscription via Stripe.`                            |
| Incorporation date      | `08 April 2026`                                                                                                                                                                                                                          |
| Registered for GST      | **Yes**                                                                                                                                                                                                                                  |

## 4. Registered office address

```
Nebula Limited
59 Coll Street
Glenorchy 9372
New Zealand
```

## 5. Representative / Director

| Field          | Value                                                                                                           |
| -------------- | --------------------------------------------------------------------------------------------------------------- |
| Role           | Director + Account representative                                                                               |
| Legal name     | `Oliver James Hart`                                                                                             |
| Date of birth  | `21 January 1994`                                                                                               |
| Nationality    | New Zealand                                                                                                     |
| Place of birth | Wellington, New Zealand                                                                                         |
| Home address   | _use your current residential address — Stripe requires the director's home address, NOT the registered office_ |
| Passport       | NZ Passport `RB468371`, issued 24 Mar 2025, expires 24 Mar 2035, authority DIA SYD                              |
| Phone          | `+64 20 4001 0020`                                                                                              |
| Email          | `devops@nebuladev.io` (or your primary)                                                                         |

Upload passport image when Stripe ID Verification prompts. Use the image you sent in chat.

## 6. Bank account for payouts

**Wise NZD business account** (Nebula Limited).

Log in: https://wise.com/login → Business: Nebula Limited → Balances → NZD → Account details.

Fields Stripe needs:

- Account holder name: `Nebula Limited`
- Bank name: `Wise NZ Limited` (or whatever Wise displays — they partner with a local NZ bank for direct NZD)
- NZ bank account number (16-digit format `XX-XXXX-XXXXXXX-XX`)
- _If Stripe asks for SWIFT/BIC instead, Wise has one — copy from Wise account details_

## 7. Statement descriptors

| Field                          | Value                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------- |
| Statement descriptor (account) | `NEBULADEV` (≤ 22 chars, max one space)                                               |
| Shortened descriptor           | `NEBULA`                                                                              |
| Customer support phone         | `+64 20 4001 0020`                                                                    |
| Customer support email         | `support@astroroast.com` (or whichever inbox you check; can create per product later) |

Per-charge override done in code: `app/api/checkout/route.ts` sets `statement_descriptor_suffix: "ASTROROAST"`, so customers see `NEBULADEV* ASTROROAST` on their card statement. We override per-product when we add more lines.

## 8. After activation

1. **Stripe Tax** → Settings → Tax → enable. Adds GST/NZ + global VAT auto-collection. Register tax registrations as prompted (NZ GST = already registered, supply IRD).
2. **Radar fraud rules** → Settings → Radar → keep defaults + add custom rule: block disposable email domains.
3. **API keys** → Developers → API keys. Reveal live + test secret keys.
4. **Webhook** → Developers → Webhooks → Add endpoint
   - URL (prod): `https://astroroast.com/api/webhooks/stripe`
   - URL (preview, optional): `https://<vercel-preview>.vercel.app/api/webhooks/stripe`
   - Events to send: `checkout.session.completed` (only)
   - Copy the signing secret (`whsec_...`) — this is `STRIPE_WEBHOOK_SECRET`
5. **Product + Price** → Products → Add product
   - Name: `Astroroast — Personalized Comedic Essay`
   - Description: `Satirical personalized essay using astrological tropes. Entertainment only.`
   - Pricing: NZD or USD, **$5 one-time**
   - Copy the Price ID (`price_...`) — this is `STRIPE_PRICE_ID`

## 9. Keys to save in keychain

Run after activation (replace `<value>`):

```bash
security add-generic-password -a "$USER" -s "stripe-nebula-secret-live" -w "sk_live_<value>"
security add-generic-password -a "$USER" -s "stripe-nebula-secret-test" -w "sk_test_<value>"
security add-generic-password -a "$USER" -s "stripe-nebula-publishable-live" -w "pk_live_<value>"
security add-generic-password -a "$USER" -s "stripe-nebula-publishable-test" -w "pk_test_<value>"
security add-generic-password -a "$USER" -s "stripe-nebula-webhook-secret-prod" -w "whsec_<value>"
security add-generic-password -a "$USER" -s "stripe-nebula-price-astroroast" -w "price_<value>"
security add-generic-password -a "$USER" -s "stripe-nebula-account-id" -w "acct_<value>"
```

## 10. Plug into astro-roasts

Edit `~/Developer/astro-roasts/.env.local`:

```
STRIPE_SECRET_KEY=sk_test_<value>
STRIPE_WEBHOOK_SECRET=whsec_<value>   # from `stripe listen` for local dev; production webhook uses different secret
STRIPE_PRICE_ID=price_<value>
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_<value>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

For Vercel production, set the same vars under Project → Settings → Environment Variables (Production). Use **live** keys + the **production webhook signing secret** there.

Local dev webhook forwarding:

```bash
stripe login   # use the Nebula account, not the LL CLI session
stripe listen --forward-to localhost:3000/api/webhooks/stripe
# Use the printed whsec_... as STRIPE_WEBHOOK_SECRET in .env.local
```

## 11. Risk hygiene (keeps the account un-frozen)

- Site-wide disclaimer: "Entertainment only · satire · not advice". Already in `PaywallCTA`, `terms`, `refund`, `privacy`.
- Refund policy: 14-day no-questions. Already in `app/refund/page.tsx`. Process refunds via Stripe dashboard, never argue.
- Statement descriptor `NEBULADEV* ASTROROAST` (clear merchant + clear product) reduces "I don't recognise this charge" disputes.
- Watch chargeback ratio in Stripe → Radar. Above 0.7% is dangerous. Above 1% triggers review.
- If Stripe ever asks for "more information about your business" → respond in 48h with the product description above + screenshots of disclaimer/refund pages.

---

**Estimated signup time**: 8 minutes if entity details + passport are ready (which they are). Verification turnaround: usually instant for NZ private companies; live payments enabled within a few hours.
