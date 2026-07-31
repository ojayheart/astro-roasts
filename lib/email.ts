import { Resend } from "resend";

let _resend: Resend | null = null;
let _warnedMissingKey = false;

// Returns null when RESEND_API_KEY is not configured. Constructing
// `new Resend(undefined)` throws "Missing API key", which previously crashed
// the paid flow. Email is best-effort delivery; the on-page /roast/[id] route
// is the source of truth, so a missing key must degrade to a no-op, not throw.
function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    if (!_warnedMissingKey) {
      console.warn(
        "RESEND_API_KEY not set — skipping roast email (roast still available on-page).",
      );
      _warnedMissingKey = true;
    }
    return null;
  }
  if (!_resend) {
    _resend = new Resend(key);
  }
  return _resend;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function sendRoastEmail(
  to: string,
  name: string,
  roastText: string,
  roastId: string,
): Promise<boolean> {
  const resend = getResend();
  if (!resend) return false;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://astroroast.com";

  // Roast prose marks emphasis with *asterisks*. Escape first, then convert —
  // otherwise the email leaks raw asterisks the website renders as italics.
  const paragraphs = roastText
    .split("\n\n")
    .filter((p) => p.trim())
    .map(
      (p) =>
        `<p style="line-height: 1.7; margin: 0 0 16px;">${escapeHtml(p).replace(
          /\*([^*\n]+)\*/g,
          "<em>$1</em>",
        )}</p>`,
    )
    .join("");

  const { error } = await resend.emails.send({
    from: "Astro Roast <roast@astroroast.com>",
    to,
    // Searchable and unambiguous — "Astro Roast" plus the subject's name, so
    // it can be found again months later by either term.
    subject: `Your Astro Roast — ${name}'s set, in full`,
    html: `
      <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #E5E5E5; background: #030303;">
        <h1 style="font-family: sans-serif; font-size: 14px; letter-spacing: 4px; text-transform: uppercase; color: #FF2A00; margin: 0 0 24px;">YOUR SET</h1>
        <p style="font-family: sans-serif; font-size: 14px; line-height: 1.6; color: #999; margin: 0 0 32px;">
          The whole set, ${escapeHtml(name)} — every planet, house and aspect,
          said out loud. Keep this email, it&rsquo;s your copy. The
          <a href="${baseUrl}/roast/${roastId}" style="color: #FF2A00;">live version</a>
          has the chart wheel too.
        </p>
        ${paragraphs}
        <hr style="border: none; border-top: 1px solid #333; margin: 40px 0;" />
        <p style="font-family: sans-serif; font-size: 15px; line-height: 1.6; color: #E5E5E5; margin: 0 0 16px;">
          <strong>Who&rsquo;s next on the mic?</strong>
        </p>
        <p style="font-family: sans-serif; font-size: 14px; line-height: 1.6; color: #999; margin: 0 0 24px;">
          Forward this to whoever you were thinking about the whole way through,
          then put their birth details in and let them have a turn.
        </p>
        <p style="margin: 0 0 32px;">
          <a href="${baseUrl}#mic" style="display: inline-block; background: #FF2A00; color: #030303; font-family: sans-serif; font-size: 13px; font-weight: bold; letter-spacing: 2px; text-transform: uppercase; text-decoration: none; padding: 14px 24px;">Pass the mic</a>
        </p>
        <p style="font-family: sans-serif; font-size: 12px; color: #666; margin: 0;">
          <a href="${baseUrl}/roast/${roastId}" style="color: #FF2A00;">View online</a> &middot;
          <a href="${baseUrl}/pricing" style="color: #FF2A00;">Pricing</a><br /><br />
          Entertainment only &middot; satire &middot; not advice.
        </p>
      </div>
    `,
  });

  // Resend's SDK returns {data, error} instead of throwing on API errors.
  // Without this check a failed send reports success upstream, emailSent
  // gets set, and the dedupe logic suppresses any later retry.
  if (error) {
    throw new Error(`Resend send failed: ${error.name ?? ""} ${error.message}`);
  }
  return true;
}
