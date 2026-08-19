// Sends the password reset email. Uses Resend when RESEND_API_KEY is set,
// otherwise logs the link to the console for local development.

async function sendWithResend(to: string, resetUrl: string) {
  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.RESEND_FROM || "onboarding@resend.dev";

  await resend.emails.send({
    from,
    to,
    subject: "Reset your Flashcards password",
    html: `
      <p>You requested a password reset for your Flashcards account.</p>
      <p><a href="${resetUrl}">Click here to reset your password</a></p>
      <p>This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>
    `,
  });
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  if (process.env.RESEND_API_KEY) {
    await sendWithResend(to, resetUrl);
  } else {
    // Local development / testing fallback.
    console.log(`\n[DEV] Password reset link for ${to}:\n${resetUrl}\n`);
  }
}
