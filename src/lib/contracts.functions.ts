import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash } from "crypto";
import { generateText } from "ai";

import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { verifyPiToken } from "./pi-auth.functions";

const PartySchema = z.object({
  role: z.enum(["exporter", "importer", "witness"]),
  party_type: z.enum(["individual", "company", "government"]),
  name: z.string().min(1).max(200),
  country: z.string().min(1).max(120),
  identifier: z.string().max(200).optional().default(""),
  pi_username: z.string().max(80).optional().nullable(),
  email: z.string().max(200).optional().nullable(),
});

const CreateInput = z.object({
  accessToken: z.string().min(10).max(4000),
  commodity: z.string().min(1).max(200),
  quantity: z.string().min(1).max(120),
  incoterm: z.string().min(2).max(40),
  priceInPi: z.string().min(1).max(80),
  deliveryWindow: z.string().min(1).max(120),
  notes: z.string().max(2000).optional().default(""),
  parties: z.array(PartySchema).min(2).max(6),
  generateBody: z.boolean().optional().default(true),
});

function canonicalHash(input: Record<string, unknown>) {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

async function draftBody(data: z.infer<typeof CreateInput>): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  const gateway = createLovableAiGatewayProvider(key);
  const model = gateway("google/gemini-3-flash-preview");

  const exporter = data.parties.find((p) => p.role === "exporter");
  const importer = data.parties.find((p) => p.role === "importer");

  const system = `You are a trade-law drafting engine producing borderless, Pi-network-settled smart contracts for international import/export. Output signature-ready Markdown with numbered sections: Parties (incl. type — individual / company / government agency), Recitals, Goods & Specifications, Quantity & Inspection, Price & Pi Settlement (on-chain escrow, milestone releases on B/L + inspection), Incoterms 2020, Delivery & Documentation (B/L, CO, phytosanitary, insurance), Customs & Compliance (HS classification, sanctions, dual-use), Risk & Title, Force Majeure, Dispute Resolution (Pi DAO arbitration, ICC fallback), Termination, Smart Contract Execution Clause (Pi mainnet, oracles, multisig), Signature blocks. Concrete and concise. Mark unknowns [TBD].`;

  const partyBlock = data.parties
    .map(
      (p) =>
        `- ${p.role.toUpperCase()} · ${p.party_type} · ${p.name} (${p.country})${p.identifier ? ` · ID ${p.identifier}` : ""}`,
    )
    .join("\n");

  const prompt = `Draft the contract:
${partyBlock}
- Commodity: ${data.commodity}
- Quantity: ${data.quantity}
- Incoterm 2020: ${data.incoterm}
- Price (π): ${data.priceInPi}
- Delivery window: ${data.deliveryWindow}
- Additional notes: ${data.notes || "none"}
${exporter && importer ? `- Primary flow: ${exporter.country} → ${importer.country}` : ""}`;

  const { text } = await generateText({ model, system, prompt });
  return text;
}

export const createContract = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => CreateInput.parse(i))
  .handler(async ({ data }) => {
    const me = await verifyPiToken(data.accessToken);
    const body = data.generateBody ? await draftBody(data) : "";
    const hash = canonicalHash({
      body,
      parties: data.parties,
      priceInPi: data.priceInPi,
      incoterm: data.incoterm,
      deliveryWindow: data.deliveryWindow,
    });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: contract, error } = await supabaseAdmin
      .from("contracts")
      .insert({
        author_uid: me.uid,
        author_username: me.username,
        status: "awaiting_signatures",
        commodity: data.commodity,
        quantity: data.quantity,
        incoterm: data.incoterm,
        price_pi: data.priceInPi,
        delivery_window: data.deliveryWindow,
        notes: data.notes ?? "",
        body_markdown: body,
        content_hash: hash,
      })
      .select()
      .single();
    if (error || !contract) throw new Error(error?.message ?? "Failed to create contract");

    const partyRows = data.parties.map((p) => ({
      contract_id: contract.id,
      role: p.role,
      party_type: p.party_type,
      name: p.name,
      country: p.country,
      identifier: p.identifier ?? "",
      pi_username: p.pi_username ?? null,
      email: p.email ?? null,
      invited_at: p.pi_username ? new Date().toISOString() : null,
      joined_uid: p.pi_username === me.username ? me.uid : null,
    }));
    const { error: pErr } = await supabaseAdmin.from("contract_parties").insert(partyRows);
    if (pErr) throw new Error(pErr.message);

    return { id: contract.id };
  });

const ListInput = z.object({ accessToken: z.string().min(10).max(4000) });

export const listMyContracts = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => ListInput.parse(i))
  .handler(async ({ data }) => {
    const me = await verifyPiToken(data.accessToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // as author
    const { data: mine } = await supabaseAdmin
      .from("contracts")
      .select("id, status, commodity, quantity, incoterm, price_pi, delivery_window, created_at, updated_at, author_username")
      .eq("author_uid", me.uid)
      .order("updated_at", { ascending: false });
    // as party
    const { data: partyRows } = await supabaseAdmin
      .from("contract_parties")
      .select("contract_id")
      .or(`joined_uid.eq.${me.uid},pi_username.eq.${me.username}`);
    const partyIds = Array.from(new Set((partyRows ?? []).map((r) => r.contract_id)));
    let asParty: NonNullable<typeof mine> = [];
    if (partyIds.length) {
      const { data } = await supabaseAdmin
        .from("contracts")
        .select("id, status, commodity, quantity, incoterm, price_pi, delivery_window, created_at, updated_at, author_username")
        .in("id", partyIds)
        .order("updated_at", { ascending: false });
      asParty = data ?? [];
    }
    const byId = new Map<string, (typeof asParty)[number]>();
    [...(mine ?? []), ...asParty].forEach((c) => byId.set(c.id, c));
    return { contracts: Array.from(byId.values()) };
  });

const GetInput = z.object({
  accessToken: z.string().min(10).max(4000),
  id: z.string().uuid(),
});

async function assertAccess(supa: Awaited<ReturnType<typeof getAdmin>>, id: string, me: { uid: string; username: string }) {
  const { data: contract, error } = await supa.from("contracts").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!contract) throw new Error("Contract not found");
  if (contract.author_uid === me.uid) return contract;
  const { data: rows } = await supa
    .from("contract_parties")
    .select("id, pi_username, joined_uid")
    .eq("contract_id", id);
  const isParty = (rows ?? []).some(
    (r) => r.joined_uid === me.uid || (r.pi_username && r.pi_username === me.username),
  );
  if (!isParty) throw new Error("Not authorized to view this contract");
  return contract;
}

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const getContract = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => GetInput.parse(i))
  .handler(async ({ data }) => {
    const me = await verifyPiToken(data.accessToken);
    const supa = await getAdmin();
    const contract = await assertAccess(supa, data.id, me);
    const [{ data: parties }, { data: signatures }, { data: translations }, { data: compliance }] =
      await Promise.all([
        supa.from("contract_parties").select("*").eq("contract_id", data.id).order("created_at"),
        supa.from("contract_signatures").select("*").eq("contract_id", data.id).order("signed_at"),
        supa.from("contract_translations").select("lang, body_markdown").eq("contract_id", data.id),
        supa.from("contract_compliance").select("*").eq("contract_id", data.id).order("created_at"),
      ]);
    // bind current user to any party matching pi_username but not yet joined
    const bindables = (parties ?? []).filter(
      (p) => !p.joined_uid && p.pi_username && p.pi_username === me.username,
    );
    if (bindables.length) {
      await supa
        .from("contract_parties")
        .update({ joined_uid: me.uid })
        .in("id", bindables.map((b) => b.id));
      bindables.forEach((b) => (b.joined_uid = me.uid));
    }
    return {
      contract,
      parties: parties ?? [],
      signatures: signatures ?? [],
      translations: translations ?? [],
      compliance: compliance ?? [],
      me,
    };
  });

const SignInput = z.object({
  accessToken: z.string().min(10).max(4000),
  id: z.string().uuid(),
  partyId: z.string().uuid(),
  method: z.enum(["pi", "typed", "drawn"]),
  typedName: z.string().max(200).optional().nullable(),
  signatureImage: z.string().max(500000).optional().nullable(),
  userAgent: z.string().max(500).optional().default(""),
});

export const signContract = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => SignInput.parse(i))
  .handler(async ({ data }) => {
    const me = await verifyPiToken(data.accessToken);
    const supa = await getAdmin();
    const contract = await assertAccess(supa, data.id, me);
    const { data: party } = await supa
      .from("contract_parties")
      .select("*")
      .eq("id", data.partyId)
      .eq("contract_id", data.id)
      .maybeSingle();
    if (!party) throw new Error("Party not found");
    const partyMatchesMe =
      party.joined_uid === me.uid ||
      (party.pi_username && party.pi_username === me.username) ||
      contract.author_uid === me.uid;
    if (!partyMatchesMe) throw new Error("You are not the assigned signer for this party");
    if (data.method === "typed" && !data.typedName) throw new Error("Typed name is required");
    if (data.method === "drawn" && !data.signatureImage) throw new Error("Drawn signature required");

    const { error: sErr } = await supa.from("contract_signatures").insert({
      contract_id: data.id,
      party_id: data.partyId,
      signer_uid: me.uid,
      signer_username: me.username,
      method: data.method,
      signed_hash: contract.content_hash,
      signature_image: data.signatureImage ?? null,
      typed_name: data.typedName ?? null,
      ip: null,
      user_agent: data.userAgent ?? "",
    });
    if (sErr) throw new Error(sErr.message);

    if (!party.joined_uid) {
      await supa.from("contract_parties").update({ joined_uid: me.uid }).eq("id", party.id);
    }

    // Check if all required parties (exporter+importer) have signed
    const { data: parties } = await supa
      .from("contract_parties")
      .select("id, role")
      .eq("contract_id", data.id);
    const { data: sigs } = await supa
      .from("contract_signatures")
      .select("party_id")
      .eq("contract_id", data.id)
      .eq("signed_hash", contract.content_hash);
    const signedPartyIds = new Set((sigs ?? []).map((s) => s.party_id));
    const required = (parties ?? []).filter((p) => p.role === "exporter" || p.role === "importer");
    const allSigned = required.length >= 2 && required.every((p) => signedPartyIds.has(p.id));
    if (allSigned && contract.status !== "signed" && contract.status !== "executed") {
      await supa.from("contracts").update({ status: "signed" }).eq("id", contract.id);
    }
    return { ok: true };
  });

const StatusInput = z.object({
  accessToken: z.string().min(10).max(4000),
  id: z.string().uuid(),
  status: z.enum(["executed", "cancelled"]),
});

export const setContractStatus = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => StatusInput.parse(i))
  .handler(async ({ data }) => {
    const me = await verifyPiToken(data.accessToken);
    const supa = await getAdmin();
    const contract = await assertAccess(supa, data.id, me);
    if (contract.author_uid !== me.uid) throw new Error("Only the author can change contract status");
    if (data.status === "executed" && contract.status !== "signed")
      throw new Error("Contract must be fully signed before it can be executed");
    const { error } = await supa.from("contracts").update({ status: data.status }).eq("id", contract.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });