import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { verifyPiToken } from "./pi-auth.functions";

const PIVERIFY_BASE =
  "https://backend.piverify-czgzri81fq2lioqn.staging.piappengine.com";

const CreateInput = z.object({
  accessToken: z.string().min(10).max(4000),
  idempotencyKey: z.string().min(4).max(120).optional(),
});

const GetInput = z.object({
  accessToken: z.string().min(10).max(4000),
  sessionId: z.string().min(3).max(120),
});

type Session = {
  id: string;
  status: string;
  hosted_flow_url: string;
  external_user_id: string;
  rejection_reason?: string | null;
  allowed_action?: string | null;
  created_at?: string;
  updated_at?: string;
};

async function callPiVerify(path: string, init?: RequestInit): Promise<Response> {
  const key = process.env.PIVERIFY_API_KEY;
  if (!key) throw new Error("PIVERIFY_API_KEY is not configured on the server");
  return fetch(`${PIVERIFY_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

export const createKycSession = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => CreateInput.parse(input))
  .handler(async ({ data }): Promise<Session> => {
    let me: { uid: string; username: string };
    try {
      me = await verifyPiToken(data.accessToken);
    } catch (e) {
      console.error("createKycSession auth failed", e);
      throw new Error("Please sign in with Pi to start verification.");
    }
    const idempotency_key =
      data.idempotencyKey ?? `${me.uid}-${Date.now()}`;
    const res = await callPiVerify("/api/v1/kyc_sessions", {
      method: "POST",
      body: JSON.stringify({
        external_user_id: me.uid,
        idempotency_key,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`PiVerify create session failed (${res.status}): ${body}`);
      if (res.status === 402) {
        throw new Error("PiVerify credits exhausted. Contact PiVerify to add credits.");
      }
      throw new Error("Could not start identity verification. Please try again.");
    }
    return (await res.json()) as Session;
  });

export const getKycSession = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => GetInput.parse(input))
  .handler(async ({ data }): Promise<Session> => {
    try {
      await verifyPiToken(data.accessToken);
    } catch (e) {
      console.error("getKycSession auth failed", e);
      throw new Error("Unauthorized");
    }
    const res = await callPiVerify(
      `/api/v1/kyc_sessions/${encodeURIComponent(data.sessionId)}`,
    );
    if (!res.ok) {
      const body = await res.text();
      console.error(`PiVerify get session failed (${res.status}): ${body}`);
      throw new Error("Could not fetch verification status.");
    }
    return (await res.json()) as Session;
  });