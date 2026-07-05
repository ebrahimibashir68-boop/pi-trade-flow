import { getCachedPiAccessToken } from "./pi-auth";
import { verifyRewardedAd } from "./pi-ads.functions";

export type AdType = "interstitial" | "rewarded";

type ShowAdResult =
  | { type: AdType; result: "AD_CLOSED" | "AD_DISPLAY_ERROR" | "AD_NETWORK_ERROR" | "AD_NOT_AVAILABLE" }
  | { type: "rewarded"; result: "AD_REWARDED"; adId: string };

type IsAdReadyResult = { type: AdType; ready: boolean };
type RequestAdResult = { type: AdType; result: "AD_LOADED" | "AD_FAILED_TO_LOAD" | "AD_NOT_AVAILABLE" };

type PiAds = {
  showAd: (adType: AdType) => Promise<ShowAdResult>;
  isAdReady: (adType: AdType) => Promise<IsAdReadyResult>;
  requestAd: (adType: AdType) => Promise<RequestAdResult>;
};

type PiSdkWithAds = { Ads?: PiAds };

declare global {
  interface Window {
    Pi?: Window["Pi"] & PiSdkWithAds;
  }
}

function getAds(): PiAds {
  if (typeof window === "undefined") throw new Error("Pi SDK only available in browser");
  const ads = (window.Pi as unknown as PiSdkWithAds | undefined)?.Ads;
  if (!ads) throw new Error("Pi Ads unavailable. Open this app inside the Pi Browser.");
  return ads;
}

async function ensureReady(type: AdType): Promise<void> {
  const ads = getAds();
  const status = await ads.isAdReady(type);
  if (status.ready) return;
  const req = await ads.requestAd(type);
  if (req.result !== "AD_LOADED") {
    throw new Error(
      req.result === "AD_NOT_AVAILABLE"
        ? "Ads are not available on this device yet."
        : "Failed to load ad. Please try again.",
    );
  }
}

export async function showInterstitialAd(): Promise<void> {
  await ensureReady("interstitial");
  const res = await getAds().showAd("interstitial");
  if (res.result !== "AD_CLOSED") {
    throw new Error("Interstitial ad could not be displayed.");
  }
}

export type RewardedResult = { adId: string; verified: boolean };

export async function showRewardedAd(): Promise<RewardedResult> {
  await ensureReady("rewarded");
  const res = await getAds().showAd("rewarded");
  if (res.result !== "AD_REWARDED" || !("adId" in res)) {
    throw new Error("Reward not granted. Ad was not fully watched.");
  }
  const accessToken = getCachedPiAccessToken();
  if (!accessToken) {
    return { adId: res.adId, verified: false };
  }
  try {
    const v = await verifyRewardedAd({ data: { adId: res.adId, accessToken } });
    return { adId: res.adId, verified: v.granted };
  } catch {
    return { adId: res.adId, verified: false };
  }
}