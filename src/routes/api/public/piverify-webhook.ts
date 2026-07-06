import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";

type PiVerifyEvent = {
  id: string;
  type: string;
  created_at: string;
  data: {
    session_id: string;
    external_user_id: string;
    status: string;
    rejection_reason?: string | null;
    allowed_action?: "RESUBMIT" | "APPEAL" | null;
  };
};

function verifySignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const expected =
    "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(header);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/api/public/piverify-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.PIVERIFY_WEBHOOK_SECRET;
        if (!secret) {
          console.error("PIVERIFY_WEBHOOK_SECRET is not configured");
          return new Response("Server misconfigured", { status: 500 });
        }
        const raw = await request.text();
        const sig = request.headers.get("x-piverify-signature");
        if (!verifySignature(raw, sig, secret)) {
          return new Response("Invalid signature", { status: 401 });
        }
        let event: PiVerifyEvent;
        try {
          event = JSON.parse(raw) as PiVerifyEvent;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        // Log for now — persistence can be added when Cloud is enabled.
        console.log("[piverify] event", {
          type: event.type,
          session_id: event.data?.session_id,
          external_user_id: event.data?.external_user_id,
          status: event.data?.status,
          rejection_reason: event.data?.rejection_reason,
          allowed_action: event.data?.allowed_action,
        });
        return new Response("ok", { status: 200 });
      },
    },
  },
});