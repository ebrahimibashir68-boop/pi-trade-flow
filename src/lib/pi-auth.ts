import { verifyPiAccessToken } from "./pi-auth.functions";

type PiUser = { uid: string; username: string };
type PiAuthResult = {
  accessToken: string;
  user: { uid: string; username: string };
};
type PiSdk = {
  init: (opts: { version: string; sandbox?: boolean }) => Promise<void> | void;
  authenticate: (
    scopes: string[],
    onIncompletePaymentFound: (payment: unknown) => void,
  ) => Promise<PiAuthResult>;
};

declare global {
  interface Window {
    Pi?: PiSdk;
  }
}

const SDK_URL = "https://sdk.minepi.com/pi-sdk.js";
let sdkPromise: Promise<PiSdk> | null = null;
let initPromise: Promise<void> | null = null;

function loadSdk(): Promise<PiSdk> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Pi SDK only available in browser"));
  }
  if (window.Pi) return Promise.resolve(window.Pi);
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<PiSdk>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SDK_URL}"]`,
    );
    const script = existing ?? document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    script.onload = () => {
      if (window.Pi) resolve(window.Pi);
      else reject(new Error("Pi SDK failed to expose window.Pi"));
    };
    script.onerror = () => reject(new Error("Failed to load Pi SDK"));
    if (!existing) document.head.appendChild(script);
  });
  return sdkPromise;
}

async function ensureInit(): Promise<PiSdk> {
  const Pi = await loadSdk();
  if (!initPromise) {
    initPromise = Promise.resolve(Pi.init({ version: "2.0", sandbox: false }));
  }
  await initPromise;
  return Pi;
}

export async function signInWithPi(): Promise<PiUser> {
  const Pi = await ensureInit();
  const auth = await Pi.authenticate(["username"], () => {
    // No payment flow in this app; ignore incomplete payments.
  });
  const verified = await verifyPiAccessToken({
    data: { accessToken: auth.accessToken },
  });
  try {
    sessionStorage.setItem("pi.user", JSON.stringify(verified));
  } catch {
    /* ignore */
  }
  return verified;
}

export function getCachedPiUser(): PiUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem("pi.user");
    return raw ? (JSON.parse(raw) as PiUser) : null;
  } catch {
    return null;
  }
}