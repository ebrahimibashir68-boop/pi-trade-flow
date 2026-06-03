import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({ accessToken: z.string().min(10).max(4000) });

export const verifyPiAccessToken = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const res = await fetch("https://api.minepi.com/v2/me", {
      headers: { Authorization: `Bearer ${data.accessToken}` },
    });
    if (!res.ok) {
      throw new Error(`Pi token verification failed (${res.status})`);
    }
    const me = (await res.json()) as {
      uid: string;
      username: string;
    };
    return { uid: me.uid, username: me.username };
  });