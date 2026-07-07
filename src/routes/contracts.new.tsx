import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { createContract } from "@/lib/contracts.functions";
import { lookupHsCode, screenSanctions, requiredDocs } from "@/lib/compliance.functions";
import { getCachedPiAccessToken, signInWithPi } from "@/lib/pi-auth";

export const Route = createFileRoute("/contracts/new")({ component: NewContract });

type PartyType = "individual" | "company" | "government";
type Role = "exporter" | "importer" | "witness";

type Party = {
  role: Role;
  party_type: PartyType;
  name: string;
  country: string;
  identifier: string;
  pi_username: string;
  email: string;
};

const DEFAULT_PARTIES: Party[] = [
  { role: "exporter", party_type: "company", name: "", country: "", identifier: "", pi_username: "", email: "" },
  { role: "importer", party_type: "company", name: "", country: "", identifier: "", pi_username: "", email: "" },
];

function NewContract() {
  const navigate = useNavigate();
  const create = useServerFn(createContract);
  const hs = useServerFn(lookupHsCode);
  const sx = useServerFn(screenSanctions);
  const docs = useServerFn(requiredDocs);

  const [parties, setParties] = useState<Party[]>(DEFAULT_PARTIES);
  const [form, setForm] = useState({
    commodity: "",
    quantity: "",
    incoterm: "FOB",
    priceInPi: "",
    deliveryWindow: "",
    notes: "",
  });
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    const t = getCachedPiAccessToken();
    if (t) setToken(t);
    else signInWithPi().then(() => setToken(getCachedPiAccessToken())).catch(() => {});
  }, []);

  const [hsResult, setHsResult] = useState<Awaited<ReturnType<typeof hs>> | null>(null);
  const [sxResult, setSxResult] = useState<Awaited<ReturnType<typeof sx>> | null>(null);
  const [docsResult, setDocsResult] = useState<Awaited<ReturnType<typeof docs>> | null>(null);
  const [compBusy, setCompBusy] = useState<string | null>(null);
  const [compErr, setCompErr] = useState<string | null>(null);

  const runHs = async () => {
    if (!token) return;
    const importer = parties.find((p) => p.role === "importer");
    setCompBusy("hs"); setCompErr(null);
    try { setHsResult(await hs({ data: { accessToken: token, commodity: form.commodity, destinationCountry: importer?.country || "" } })); }
    catch (e) { setCompErr((e as Error).message); }
    finally { setCompBusy(null); }
  };
  const runSx = async () => {
    if (!token) return;
    setCompBusy("sx"); setCompErr(null);
    try { setSxResult(await sx({ data: { accessToken: token, parties: parties.map(p => ({ name: p.name, country: p.country })).filter(p => p.name) } })); }
    catch (e) { setCompErr((e as Error).message); }
    finally { setCompBusy(null); }
  };
  const runDocs = async () => {
    if (!token) return;
    const exp = parties.find((p) => p.role === "exporter");
    const imp = parties.find((p) => p.role === "importer");
    setCompBusy("docs"); setCompErr(null);
    try { setDocsResult(await docs({ data: { accessToken: token, incoterm: form.incoterm, commodity: form.commodity, origin: exp?.country || "", destination: imp?.country || "" } })); }
    catch (e) { setCompErr((e as Error).message); }
    finally { setCompBusy(null); }
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error("Sign in with Pi first");
      return create({ data: { accessToken: token, ...form, parties: parties.filter(p => p.name && p.country) } });
    },
    onSuccess: (r) => navigate({ to: "/contracts/$id", params: { id: r.id } }),
  });

  const setP = (i: number, patch: Partial<Party>) =>
    setParties((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));

  return (
    <section className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="font-display text-3xl">New contract</h1>
      <p className="mt-1 text-sm text-muted-foreground">Between individuals, companies, institutions or government agencies. Signed and stored on PiTrade.</p>

      <div className="mt-8 space-y-6">
        <div className="rounded-sm border border-border bg-card p-6">
          <h2 className="font-display text-xl">Parties</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {parties.map((p, i) => (
              <div key={i} className="rounded-sm border border-border p-4">
                <div className="flex flex-wrap gap-2">
                  <select value={p.role} onChange={(e) => setP(i, { role: e.target.value as Role })} className="rounded-sm border border-border bg-background px-2 py-1 text-sm">
                    <option value="exporter">Exporter</option>
                    <option value="importer">Importer</option>
                    <option value="witness">Witness</option>
                  </select>
                  <select value={p.party_type} onChange={(e) => setP(i, { party_type: e.target.value as PartyType })} className="rounded-sm border border-border bg-background px-2 py-1 text-sm">
                    <option value="individual">Individual</option>
                    <option value="company">Company / Institution</option>
                    <option value="government">Government agency</option>
                  </select>
                  {parties.length > 2 && (
                    <button type="button" onClick={() => setParties((prev) => prev.filter((_, idx) => idx !== i))} className="ml-auto text-xs text-muted-foreground hover:text-destructive">Remove</button>
                  )}
                </div>
                <div className="mt-3 grid gap-2">
                  <input placeholder="Legal name" value={p.name} onChange={(e) => setP(i, { name: e.target.value })} className="rounded-sm border border-border bg-background px-3 py-2 text-sm" />
                  <input placeholder="Country" value={p.country} onChange={(e) => setP(i, { country: e.target.value })} className="rounded-sm border border-border bg-background px-3 py-2 text-sm" />
                  <input placeholder={p.party_type === "government" ? "Ministry / official ref" : p.party_type === "company" ? "Registration # / tax ID" : "Personal ID"} value={p.identifier} onChange={(e) => setP(i, { identifier: e.target.value })} className="rounded-sm border border-border bg-background px-3 py-2 text-sm" />
                  <input placeholder="Counterparty Pi username (optional)" value={p.pi_username} onChange={(e) => setP(i, { pi_username: e.target.value })} className="rounded-sm border border-border bg-background px-3 py-2 text-sm" />
                  <input placeholder="Email (optional)" value={p.email} onChange={(e) => setP(i, { email: e.target.value })} className="rounded-sm border border-border bg-background px-3 py-2 text-sm" />
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setParties((p) => [...p, { role: "witness", party_type: "individual", name: "", country: "", identifier: "", pi_username: "", email: "" }])} className="mt-4 text-sm text-primary">+ Add party</button>
        </div>

        <div className="rounded-sm border border-border bg-card p-6 grid gap-4 md:grid-cols-2">
          <input placeholder="Commodity / goods" value={form.commodity} onChange={(e) => setForm({ ...form, commodity: e.target.value })} className="rounded-sm border border-border bg-background px-3 py-2 text-sm md:col-span-2" />
          <input placeholder="Quantity (e.g. 20 MT)" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="rounded-sm border border-border bg-background px-3 py-2 text-sm" />
          <input placeholder="Incoterm 2020 (FOB / CIF / DAP…)" value={form.incoterm} onChange={(e) => setForm({ ...form, incoterm: e.target.value })} className="rounded-sm border border-border bg-background px-3 py-2 text-sm" />
          <input placeholder="Price in Pi (π)" value={form.priceInPi} onChange={(e) => setForm({ ...form, priceInPi: e.target.value })} className="rounded-sm border border-border bg-background px-3 py-2 text-sm" />
          <input placeholder="Delivery window" value={form.deliveryWindow} onChange={(e) => setForm({ ...form, deliveryWindow: e.target.value })} className="rounded-sm border border-border bg-background px-3 py-2 text-sm" />
          <textarea placeholder="Additional notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="rounded-sm border border-border bg-background px-3 py-2 text-sm md:col-span-2" rows={3} />
        </div>

        <div className="rounded-sm border border-border bg-card p-6">
          <h2 className="font-display text-xl">Compliance pre-flight</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={runHs} disabled={compBusy === "hs" || !form.commodity} className="rounded-sm border border-border px-3 py-2 text-sm hover:bg-secondary disabled:opacity-50">{compBusy === "hs" ? "Classifying…" : "HS code + duty"}</button>
            <button type="button" onClick={runSx} disabled={compBusy === "sx"} className="rounded-sm border border-border px-3 py-2 text-sm hover:bg-secondary disabled:opacity-50">{compBusy === "sx" ? "Screening…" : "Sanctions screen"}</button>
            <button type="button" onClick={runDocs} disabled={compBusy === "docs"} className="rounded-sm border border-border px-3 py-2 text-sm hover:bg-secondary disabled:opacity-50">{compBusy === "docs" ? "Loading…" : "Required documents"}</button>
          </div>
          {compErr && <p className="mt-3 text-xs text-destructive">{compErr}</p>}
          {hsResult && <pre className="mt-3 whitespace-pre-wrap rounded-sm bg-background p-3 text-xs">{JSON.stringify(hsResult, null, 2)}</pre>}
          {sxResult && <pre className="mt-3 whitespace-pre-wrap rounded-sm bg-background p-3 text-xs">{JSON.stringify(sxResult, null, 2)}</pre>}
          {docsResult && <pre className="mt-3 whitespace-pre-wrap rounded-sm bg-background p-3 text-xs">{JSON.stringify(docsResult, null, 2)}</pre>}
        </div>

        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">AI drafts the full contract. You'll then invite counterparties to sign.</p>
          <button type="button" disabled={mutation.isPending || !form.commodity || !parties[0].name} onClick={() => mutation.mutate()} className="rounded-sm bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {mutation.isPending ? "Drafting & saving…" : "Draft & save contract"}
          </button>
        </div>
        {mutation.error && <p className="text-sm text-destructive">{(mutation.error as Error).message}</p>}
      </div>
    </section>
  );
}