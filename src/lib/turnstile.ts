/** Verify a Cloudflare Turnstile token server-side */
export async function verifyTurnstile(token: string, ip?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.error("[Turnstile] TURNSTILE_SECRET_KEY not configured");
    return false;
  }

  const body = new URLSearchParams({
    secret,
    response: token,
    ...(ip ? { remoteip: ip } : {}),
  });

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
    });
    const data = await res.json();
    if (!data.success) {
      console.error("[Turnstile] Cloudflare rejected token. Error codes:", data["error-codes"]);
    }
    return data.success === true;
  } catch (e) {
    console.error("[Turnstile] Verification request failed:", e);
    return false;
  }
}
