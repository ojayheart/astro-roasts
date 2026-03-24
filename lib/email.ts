import { Resend } from "resend";

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
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
) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://astroroast.com";

  const paragraphs = roastText
    .split("\n\n")
    .map(
      (p) =>
        `<p style="line-height: 1.7; margin-bottom: 16px;">${escapeHtml(p)}</p>`,
    )
    .join("");

  await getResend().emails.send({
    from: "Astro Roast <roast@astroroast.com>",
    to,
    subject: `${escapeHtml(name)}, the stars have spoken.`,
    html: `
      <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #E5E5E5; background: #030303;">
        <h1 style="font-family: sans-serif; font-size: 14px; letter-spacing: 4px; text-transform: uppercase; color: #FF2A00; margin-bottom: 32px;">YOUR ASTRO ROAST</h1>
        ${paragraphs}
        <hr style="border: none; border-top: 1px solid #333; margin: 40px 0;" />
        <p style="font-size: 13px; color: #666;">
          <a href="${baseUrl}/roast/${roastId}" style="color: #FF2A00;">View online</a> &middot;
          <a href="${baseUrl}" style="color: #FF2A00;">Get another roast</a>
        </p>
      </div>
    `,
  });
}
