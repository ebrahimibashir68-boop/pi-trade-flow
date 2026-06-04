import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({ accessToken: z.string().min(10).max(4000) });

export async function verifyPiToken(accessToken: string): Promise<{ uid: string; username: string }> {
  const res = await fetch("https://api.minepi.com/v2/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error("Unauthorized");
  }
  const me = (await res.json()) as { uid: string; username: string };
  return { uid: me.uid, username: me.username };
}

export const verifyPiAccessToken = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    try {
      return await verifyPiToken(data.accessToken);
    } catch (e) {
      console.error("Pi token verification failed", e);
      throw new Error("Pi sign-in verification failed");
    }
  });