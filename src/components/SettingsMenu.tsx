import { useEffect, useState } from "react";
import { Settings, Monitor, Smartphone, Wallet, Type, Contrast, RotateCcw, ExternalLink, Check, ShieldCheck } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { signInWithPi, getCachedPiUser, getCachedPiAccessToken } from "@/lib/pi-auth";
import { createKycSession } from "@/lib/piverify.functions";

type PiUser = { uid: string; username: string };

const DESKTOP_KEY = "pitrade.desktopSite";
const CONTRAST_KEY = "pitrade.highContrast";
const TEXT_KEY = "pitrade.textSize";

function setViewport(desktop: boolean) {
  if (typeof document === "undefined") return;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (!meta) return;
  meta.setAttribute(
    "content",
    desktop
      ? "width=1280, initial-scale=1"
      : "width=device-width, initial-scale=1",
  );
  document.documentElement.classList.toggle("desktop-site", desktop);
}

function setTextSize(size: "sm" | "md" | "lg") {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.fontSize = size === "sm" ? "14px" : size === "lg" ? "18px" : "16px";
}

function setContrast(on: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("high-contrast", on);
}

export function SettingsMenu({
  piUser,
  onPiUserChange,
}: {
  piUser: PiUser | null;
  onPiUserChange: (u: PiUser | null) => void;
}) {
  const [desktop, setDesktop] = useState(false);
  const [contrast, setContrastState] = useState(false);
  const [textSize, setTextSizeState] = useState<"sm" | "md" | "lg">("md");
  const [walletPending, setWalletPending] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [kycPending, setKycPending] = useState(false);
  const [kycError, setKycError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const d = localStorage.getItem(DESKTOP_KEY) === "1";
      const c = localStorage.getItem(CONTRAST_KEY) === "1";
      const t = (localStorage.getItem(TEXT_KEY) as "sm" | "md" | "lg" | null) ?? "md";
      setDesktop(d);
      setContrastState(c);
      setTextSizeState(t);
      setViewport(d);
      setContrast(c);
      setTextSize(t);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleDesktop = (v: boolean) => {
    setDesktop(v);
    setViewport(v);
    try {
      localStorage.setItem(DESKTOP_KEY, v ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  const toggleContrast = (v: boolean) => {
    setContrastState(v);
    setContrast(v);
    try {
      localStorage.setItem(CONTRAST_KEY, v ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  const chooseTextSize = (s: "sm" | "md" | "lg") => {
    setTextSizeState(s);
    setTextSize(s);
    try {
      localStorage.setItem(TEXT_KEY, s);
    } catch {
      /* ignore */
    }
  };

  const connectWallet = async () => {
    setWalletError(null);
    setWalletPending(true);
    try {
      const u = await signInWithPi();
      onPiUserChange(u);
    } catch (e) {
      setWalletError(e instanceof Error ? e.message : "Wallet connection failed");
    } finally {
      setWalletPending(false);
    }
  };

  const disconnectWallet = () => {
    try {
      sessionStorage.removeItem("pi.accessToken");
      sessionStorage.removeItem("pi.user");
    } catch {
      /* ignore */
    }
    onPiUserChange(null);
  };

  const startKyc = async () => {
    setKycError(null);
    const accessToken = getCachedPiAccessToken();
    if (!accessToken) {
      setKycError("Connect your Pi wallet first.");
      return;
    }
    setKycPending(true);
    try {
      const session = await createKycSession({ data: { accessToken } });
      if (typeof window !== "undefined" && session.hosted_flow_url) {
        window.open(session.hosted_flow_url, "_blank", "noopener,noreferrer");
      }
    } catch (e) {
      setKycError(e instanceof Error ? e.message : "Could not start verification.");
    } finally {
      setKycPending(false);
    }
  };

  const resetAll = () => {
    toggleDesktop(false);
    toggleContrast(false);
    chooseTextSize("md");
  };

  // Re-sync piUser if cache changed elsewhere.
  useEffect(() => {
    if (!piUser) {
      const cached = getCachedPiUser();
      if (cached) onPiUserChange(cached);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Open settings"
          className="grid h-9 w-9 place-items-center rounded-sm border border-border text-foreground hover:bg-secondary"
        >
          <Settings className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Pi Wallet</DropdownMenuLabel>
        {piUser ? (
          <>
            <div className="px-2 py-1.5 text-xs">
              <div className="flex items-center gap-2 text-foreground">
                <Wallet className="h-4 w-4 text-primary" />
                <span className="font-medium">@{piUser.username}</span>
              </div>
              <div className="mt-1 truncate text-[10px] text-muted-foreground">
                uid: {piUser.uid}
              </div>
            </div>
            <DropdownMenuItem onSelect={disconnectWallet}>
              <ExternalLink className="h-4 w-4" />
              Disconnect wallet
            </DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              void connectWallet();
            }}
            disabled={walletPending}
          >
            <Wallet className="h-4 w-4" />
            {walletPending ? "Connecting…" : "Connect Pi wallet"}
          </DropdownMenuItem>
        )}
        {walletError && (
          <div className="px-2 py-1 text-[11px] text-destructive">
            {walletError}
          </div>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Identity</DropdownMenuLabel>
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            void startKyc();
          }}
          disabled={kycPending || !piUser}
        >
          <ShieldCheck className="h-4 w-4" />
          {kycPending ? "Starting verification…" : "Verify identity (PiVerify)"}
        </DropdownMenuItem>
        {!piUser && (
          <div className="px-2 py-1 text-[11px] text-muted-foreground">
            Connect your Pi wallet to verify.
          </div>
        )}
        {kycError && (
          <div className="px-2 py-1 text-[11px] text-destructive">{kycError}</div>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Display</DropdownMenuLabel>
        <DropdownMenuCheckboxItem
          checked={desktop}
          onCheckedChange={(v) => toggleDesktop(Boolean(v))}
        >
          {desktop ? (
            <Monitor className="mr-2 h-4 w-4" />
          ) : (
            <Smartphone className="mr-2 h-4 w-4" />
          )}
          Desktop site
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={contrast}
          onCheckedChange={(v) => toggleContrast(Boolean(v))}
        >
          <Contrast className="mr-2 h-4 w-4" />
          High contrast
        </DropdownMenuCheckboxItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel>
          <span className="inline-flex items-center gap-2">
            <Type className="h-4 w-4" /> Text size
          </span>
        </DropdownMenuLabel>
        {(["sm", "md", "lg"] as const).map((s) => (
          <DropdownMenuItem
            key={s}
            onSelect={(e) => {
              e.preventDefault();
              chooseTextSize(s);
            }}
          >
            <span className="w-4">
              {textSize === s ? <Check className="h-4 w-4" /> : null}
            </span>
            {s === "sm" ? "Small" : s === "md" ? "Medium" : "Large"}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            resetAll();
          }}
        >
          <RotateCcw className="h-4 w-4" />
          Reset to defaults
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[10px] font-normal text-muted-foreground">
          PiTrade v1.0 · Pi Mainnet
        </DropdownMenuLabel>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}