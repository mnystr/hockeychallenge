/**
 * Minimal Resend client using fetch — no SDK dependency.
 *
 * Envs:
 *   RESEND_API_KEY       required to actually send mail
 *   EMAIL_FROM           e.g. "hockey <noreply@yourdomain.com>"
 *                        If absent, uses Resend's sandbox address.
 *
 * Behaviour without RESEND_API_KEY: logs the email + returns success.
 * This keeps local dev and the e2e tests working without external
 * setup.
 */

export type EmailMessage = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
};

export async function sendEmail(msg: EmailMessage): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "onboarding@resend.dev";

  if (!key) {
    console.info(
      "[email] RESEND_API_KEY absent — skipping send. Would have sent:",
      { to: msg.to, subject: msg.subject, preview: msg.text.slice(0, 80) },
    );
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: Array.isArray(msg.to) ? msg.to : [msg.to],
      subject: msg.subject,
      text: msg.text,
      ...(msg.html ? { html: msg.html } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend send failed: ${res.status} ${body}`);
  }
}
