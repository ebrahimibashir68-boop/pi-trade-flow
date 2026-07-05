import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { verifyPiToken } from "./pi-auth.functions";

const PI_API_BASE = "https://api.minepi.com/v2";

const Input = z.object({
  adId: z.string().min(1).max(200),
  accessToken: z.string().min(10).max(4000),
});

/**
 * Verify a rewarded ad server-side against the Pi Platform API before
 * granting any in-app reward. Uses the Server API Key (Key auth).
 */
export const verifyRewardedAd = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    try {
      await verifyPiToken(data.accessToken);
    } catch (e) {
      console.error("verifyRewardedAd auth failed", e);
      throw new Error("Unauthorized");
    }
    const key = process.env.PI_API_KEY;
    if (!key) throw new Error("PI_API_KEY is not configured on the server");
    const res = await fetch(
      `${PI_API_BASE}/ads_network/status/${encodeURIComponent(data.adId)}`,
      { headers: { Authorization: `Key ${key}` } },
    );
    if (!res.ok) {
      const body = await res.text();
      console.error(`Pi ad verify failed (${res.status}): ${body}`);
      throw new Error("Ad verification failed.");
    }
    const json = (await res.json()) as {
      identifier?: string;
      mediaUrl?: string;
      status?: string;
    };
    const granted = (json.status ?? "").toUpperCase() === "GRANTED";
    return { granted, adId: data.adId };
  });