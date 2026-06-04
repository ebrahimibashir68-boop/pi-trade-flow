import { verifyPiAccessToken } from "./pi-auth.functions";

type PiUser = { uid: string; username: string };
type PiAuthResult = {
  accessToken: string;
  user: { uid: string; username: string };
};

export type PiPaymentData = {
  amount: number;
  memo: string;
  metadata: Record<string, unknown>;
};

export type PiPaymentCallbacks = {
  onReadyForServerApproval: (paymentId: string) => void;
  onReadyForServerCompletion: (paymentId: string, txid: string) => void;
  onCancel: (paymentId: string) => void;
  onError: (error: Error, payment?: unknown) => void;
};

type PiSdk = {
  init: (opts: { version: string; sandbox?: boolean }) => Promise<void> | void;
  authenticate: (
    scopes: string[],
    onIncompletePaymentFound: (payment: unknown) => void,
  ) => Promise<PiAuthResult>;
  createPayment: (
    payment: PiPaymentData,
    callbacks: PiPaymentCallbacks,
  ) => Promise<unknown>;
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

import { approvePiPayment, completePiPayment } from "./pi-payments.functions";

const TOKEN_KEY = "pi.accessToken";

export function getCachedPiAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function requireToken(): string {
  const t = getCachedPiAccessToken();
  if (!t) throw new Error("Not signed in with Pi");
  return t;
}

async function handleIncompletePayment(payment: unknown) {
  const p = payment as { identifier?: string; transaction?: { txid?: string } } | null;
  if (!p?.identifier || !p.transaction?.txid) return;
  try {
    const accessToken = getCachedPiAccessToken();
    if (!accessToken) return;
    await completePiPayment({
      data: { paymentId: p.identifier, txid: p.transaction.txid, accessToken },
    });
  } catch (e) {
    console.error("Failed to complete incomplete Pi payment", e);
  }
}

export async function signInWithPi(): Promise<PiUser> {
  const Pi = await ensureInit();
  const auth = await Pi.authenticate(
    ["username", "payments"],
    handleIncompletePayment,
  );
  try {
    sessionStorage.setItem(TOKEN_KEY, auth.accessToken);
  } catch {
    /* ignore */
  }
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

export type PiPaymentResult = {
  paymentId: string;
  txid: string;
};

export async function payAppWithPi(
  payment: PiPaymentData,
): Promise<PiPaymentResult> {
  const Pi = await ensureInit();
  const accessToken = requireToken();
  return new Promise<PiPaymentResult>((resolve, reject) => {
    let approvedId: string | null = null;
    Pi.createPayment(payment, {
      onReadyForServerApproval: async (paymentId) => {
        try {
          await approvePiPayment({ data: { paymentId, accessToken } });
          approvedId = paymentId;
        } catch (e) {
          reject(e instanceof Error ? e : new Error("Server approval failed"));
        }
      },
      onReadyForServerCompletion: async (paymentId, txid) => {
        try {
          await completePiPayment({ data: { paymentId, txid, accessToken } });
          resolve({ paymentId, txid });
        } catch (e) {
          reject(e instanceof Error ? e : new Error("Server completion failed"));
        }
      },
      onCancel: (paymentId) => {
        reject(new Error(`Payment cancelled (${paymentId || approvedId || "n/a"})`));
      },
      onError: (error) => {
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    }).catch((e: unknown) => {
      reject(e instanceof Error ? e : new Error(String(e)));
    });
  });
}