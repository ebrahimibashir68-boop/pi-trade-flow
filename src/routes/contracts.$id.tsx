import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { getContract, signContract, setContractStatus } from "@/lib/contracts.functions";
import { translateContract } from "@/lib/compliance.functions";
import { generateContractPdf } from "@/lib/pdf.functions";
import { getCachedPiAccessToken, signInWithPi } from "@/lib/pi-auth";

export const Route = createFileRoute("/contracts/$id")({ component: SigningRoom });

const LANGS = [["en","English"],["zh","中文"],["es","Español"],["ar","العربية"],["fr","Français"]];

function SigningRoom() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const get = useServerFn(getContract);
  const sign = useServerFn(signContract);
  const setStatus = useServerFn(setContractStatus);
  const translate = useServerFn(translateContract);
  const pdf = useServerFn(generateContractPdf);

  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    const t = getCachedPiAccessToken();
    if (t) setToken(t);
    else signInWithPi().then(() => setToken(getCachedPiAccessToken())).catch(() => {});
  }, []);
  const q = useQuery({
    queryKey: ["contract", id, token],
    queryFn: () => get({ data: { accessToken: token!, id } }),
    enabled: !!token,
  });

  const [selectedParty, setSelectedParty] = useState<string>("");
  const [method, setMethod] = useState<"pi" | "typed" | "drawn">("typed");
  const [typedName, setTypedName] = useState("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const [lang, setLang] = useState("en");
  const [tx, setTx] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (q.data && !selectedParty) {
      const me = q.data.me;
      const mine = q.data.parties.find(
        (p) => p.joined_uid === me.uid || p.pi_username === me.username,
      );
      if (mine) setSelectedParty(mine.id);
      if (mine?.name) setTypedName(mine.name);
    }
  }, [q.data, selectedParty]);

  const signMut = useMutation({
    mutationFn: async () => {
      if (!token || !selectedParty) throw new Error("Pick a party to sign as");
      let signatureImage: string | null = null;
      if (method === "drawn" && canvasRef.current) signatureImage = canvasRef.current.toDataURL("image/png");
      return sign({ data: {
        accessToken: token, id, partyId: selectedParty, method,
        typedName: method === "typed" ? typedName : null,
        signatureImage,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 400) : "",
      }});
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contract", id] }),
  });

  const doTranslate = async () => {
    if (!token) return;
    setBusy("tx");
    try {
      const r = await translate({ data: { accessToken: token, contractId: id, lang } });
      setTx(r.body_markdown);
    } finally { setBusy(null); }
  };

  const downloadPdf = async () => {
    if (!token) return;
    setBusy("pdf");
    try {
      const r = await pdf({ data: { accessToken: token, id } });
      const blob = new Blob([Uint8Array.from(atob(r.base64), (c) => c.charCodeAt(0))], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = r.filename; a.click();
      URL.revokeObjectURL(url);
    } finally { setBusy(null); }
  };

  const changeStatus = async (s: "executed" | "cancelled") => {
    if (!token) return;
    setBusy("status");
    try { await setStatus({ data: { accessToken: token, id, status: s } }); qc.invalidateQueries({ queryKey: ["contract", id] }); }
    finally { setBusy(null); }
  };

  // canvas drawing
  useEffect(() => {
    const c = canvasRef.current; if (!c || method !== "drawn") return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    ctx.strokeStyle = "#0b1c3a"; ctx.lineWidth = 2; ctx.lineCap = "round";
    const pos = (e: PointerEvent) => { const r = c.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const down = (e: PointerEvent) => { drawingRef.current = true; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
    const move = (e: PointerEvent) => { if (!drawingRef.current) return; const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); };
    const up = () => { drawingRef.current = false; };
    c.addEventListener("pointerdown", down); c.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
    return () => { c.removeEventListener("pointerdown", down); c.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, [method]);

  if (!token || q.isLoading) return <div className="mx-auto max-w-5xl p-8 text-sm text-muted-foreground">Loading…</div>;
  if (q.error) return <div className="mx-auto max-w-5xl p-8 text-sm text-destructive">{(q.error as Error).message}</div>;
  if (!q.data) return null;
  const { contract, parties, signatures } = q.data;
  const signedIds = new Set(signatures.map((s) => s.party_id));
  const clearCanvas = () => { const c = canvasRef.current; c?.getContext("2d")?.clearRect(0,0,c.width,c.height); };

  return (
    <section className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-primary">{contract.status.replaceAll("_"," ")}</p>
          <h1 className="font-display text-3xl">{contract.commodity}</h1>
          <p className="text-sm text-muted-foreground">{contract.quantity} · {contract.incoterm} · {contract.price_pi} · {contract.delivery_window}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={downloadPdf} disabled={busy === "pdf"} className="rounded-sm border border-border px-3 py-2 text-sm hover:bg-secondary disabled:opacity-50">{busy === "pdf" ? "Building PDF…" : "Download PDF"}</button>
          {contract.author_uid === q.data.me.uid && contract.status === "signed" && (
            <button onClick={() => changeStatus("executed")} disabled={busy !== null} className="rounded-sm bg-primary px-3 py-2 text-sm text-primary-foreground">Mark executed</button>
          )}
          {contract.author_uid === q.data.me.uid && contract.status !== "executed" && contract.status !== "cancelled" && (
            <button onClick={() => changeStatus("cancelled")} disabled={busy !== null} className="rounded-sm border border-destructive px-3 py-2 text-sm text-destructive hover:bg-destructive/10">Cancel</button>
          )}
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <article className="rounded-sm border border-border bg-card p-6">
          <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-border pb-3">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">View in</span>
            {LANGS.map(([code, label]) => (
              <button key={code} onClick={() => { setLang(code); if (code === "en") setTx(null); }} className={`rounded-sm border px-2 py-1 text-xs ${lang === code ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>{label}</button>
            ))}
            {lang !== "en" && (
              <button onClick={doTranslate} disabled={busy === "tx"} className="ml-auto rounded-sm bg-primary px-3 py-1 text-xs text-primary-foreground">{busy === "tx" ? "Translating…" : "Translate"}</button>
            )}
          </div>
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{tx && lang !== "en" ? tx : contract.body_markdown}</pre>
          <p className="mt-4 border-t border-border pt-3 text-[10px] text-muted-foreground">Content hash (SHA-256): {contract.content_hash}</p>
        </article>

        <aside className="space-y-4">
          <div className="rounded-sm border border-border bg-card p-5">
            <h3 className="font-display text-lg">Parties</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {parties.map((p) => (
                <li key={p.id} className="rounded-sm border border-border p-3">
                  <p className="font-medium">{p.name || <span className="text-muted-foreground">[unnamed]</span>} <span className="text-xs text-muted-foreground">· {p.role} · {p.party_type}</span></p>
                  <p className="text-xs text-muted-foreground">{p.country}{p.pi_username ? ` · @${p.pi_username}` : ""}</p>
                  <p className="mt-1 text-xs">{signedIds.has(p.id) ? <span className="text-primary">✓ Signed</span> : <span className="text-muted-foreground">Awaiting signature</span>}</p>
                </li>
              ))}
            </ul>
          </div>

          {contract.status !== "cancelled" && (
            <div className="rounded-sm border border-border bg-card p-5">
              <h3 className="font-display text-lg">Sign</h3>
              <select value={selectedParty} onChange={(e) => setSelectedParty(e.target.value)} className="mt-3 w-full rounded-sm border border-border bg-background px-2 py-2 text-sm">
                <option value="">Select a party to sign as…</option>
                {parties.map((p) => (<option key={p.id} value={p.id}>{p.role}: {p.name || "[unnamed]"}</option>))}
              </select>
              <div className="mt-3 flex gap-2 text-xs">
                {(["typed","drawn","pi"] as const).map((m) => (
                  <button key={m} onClick={() => setMethod(m)} className={`rounded-sm border px-2 py-1 ${method === m ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>{m === "pi" ? "Pi wallet" : m}</button>
                ))}
              </div>
              {method === "typed" && (
                <input value={typedName} onChange={(e) => setTypedName(e.target.value)} placeholder="Type your full legal name" className="mt-3 w-full rounded-sm border border-border bg-background px-2 py-2 text-sm" />
              )}
              {method === "drawn" && (
                <div className="mt-3">
                  <canvas ref={canvasRef} width={280} height={100} className="w-full rounded-sm border border-border bg-white" />
                  <button onClick={clearCanvas} className="mt-1 text-xs text-muted-foreground">Clear</button>
                </div>
              )}
              {method === "pi" && <p className="mt-3 text-xs text-muted-foreground">Signs with your verified Pi identity ({q.data.me.username}). No further input needed.</p>}
              <button onClick={() => signMut.mutate()} disabled={signMut.isPending || !selectedParty} className="mt-3 w-full rounded-sm bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50">
                {signMut.isPending ? "Signing…" : "Sign contract"}
              </button>
              {signMut.error && <p className="mt-2 text-xs text-destructive">{(signMut.error as Error).message}</p>}
            </div>
          )}

          <div className="rounded-sm border border-border bg-card p-5">
            <h3 className="font-display text-lg">Audit trail</h3>
            <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
              {signatures.length === 0 && <li>No signatures yet.</li>}
              {signatures.map((s) => (
                <li key={s.id} className="rounded-sm border border-border p-2">
                  <p className="text-foreground">@{s.signer_username} · {s.method}</p>
                  <p>{new Date(s.signed_at).toLocaleString()}</p>
                  {s.typed_name && <p>Typed: {s.typed_name}</p>}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </section>
  );
}