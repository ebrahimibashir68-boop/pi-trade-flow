import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const PI_API_BASE = "https://api.minepi.com/v2";

function authHeaders() {
  const key = process.env.PI_API_KEY;
  if (!key) throw new Error("PI_API_KEY is not configured on the server");
  return {
    Authorization: `Key ${key}`,
    "Content-Type": "application/json",
  };
}

const ApproveInput = z.object({ paymentId: z.string().min(1).max(200) });

export const approvePiPayment = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ApproveInput.parse(input))
  .handler(async ({ data }) => {
    const res = await fetch(
      `${PI_API_BASE}/payments/${encodeURIComponent(data.paymentId)}/approve`,
      { method: "POST", headers: authHeaders() },
    );
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Pi approve failed (${res.status}): ${body}`);
    }
    return { ok: true as const, paymentId: data.paymentId };
  });

const CompleteInput = z.object({
  paymentId: z.string().min(1).max(200),
  txid: z.string().min(1).max(200),
});

export const completePiPayment = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => CompleteInput.parse(input))
  .handler(async ({ data }) => {
    const res = await fetch(
      `${PI_API_BASE}/payments/${encodeURIComponent(data.paymentId)}/complete`,
      {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ txid: data.txid }),
      },
    );
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Pi complete failed (${res.status}): ${body}`);
    }
    return { ok: true as const, paymentId: data.paymentId, txid: data.txid };
  });