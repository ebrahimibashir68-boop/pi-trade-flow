import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText, Output, NoObjectGeneratedError } from "ai";

import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { verifyPiToken } from "./pi-auth.functions";

function gateway() {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  const g = createLovableAiGatewayProvider(key);
  return g("google/gemini-3-flash-preview");
}

async function auth(token: string) {
  return verifyPiToken(token);
}

// HS code lookup
const HsInput = z.object({
  accessToken: z.string().min(10).max(4000),
  commodity: z.string().min(1).max(300),
  destinationCountry: z.string().min(1).max(120),
});

export const lookupHsCode = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => HsInput.parse(i))
  .handler(async ({ data }) => {
    await auth(data.accessToken);
    try {
      const { output } = await generateText({
        model: gateway(),
        output: Output.object({
          schema: z.object({
            hs_code: z.string(),
            heading: z.string(),
            duty_estimate: z.string(),
            notes: z.string(),
          }),
        }),
        system:
          "You are a customs classification assistant. Return the most likely HS 6-digit code, its heading, a rough duty band for the destination country (as a string like '5-12% MFN, 0% under FTA X if applicable'), and short notes. Not legal advice.",
        prompt: `Commodity: ${data.commodity}\nDestination: ${data.destinationCountry}`,
      });
      return output;
    } catch (err) {
      if (NoObjectGeneratedError.isInstance(err)) {
        return {
          hs_code: "N/A",
          heading: "Could not classify automatically",
          duty_estimate: "Consult a customs broker for the destination country",
          notes: "AI could not produce a structured classification for this commodity.",
        };
      }
      throw err;
    }
  });

// Sanctions screening (best-effort, AI over public consolidated lists)
const SxInput = z.object({
  accessToken: z.string().min(10).max(4000),
  parties: z
    .array(z.object({ name: z.string().min(1).max(200), country: z.string().min(1).max(120) }))
    .min(1)
    .max(6),
});

export const screenSanctions = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => SxInput.parse(i))
  .handler(async ({ data }) => {
    await auth(data.accessToken);
    try {
      const { output } = await generateText({
        model: gateway(),
        output: Output.object({
          schema: z.object({
            overall_risk: z.enum(["low", "medium", "high", "unknown"]),
            summary: z.string(),
            findings: z.array(
              z.object({
                party: z.string(),
                flag: z.string(),
                source: z.string(),
              }),
            ),
          }),
        }),
        system:
          "You are a sanctions pre-flight screener. Consider public consolidated lists (OFAC SDN, EU consolidated, UK OFSI, UN 1267). Return overall risk, a short summary, and specific findings per party. If nothing is known, return risk 'unknown' and say so. Not legal advice; recommend a formal screening service before signing.",
        prompt: JSON.stringify(data.parties),
      });
      return output;
    } catch (err) {
      if (NoObjectGeneratedError.isInstance(err)) {
        return {
          overall_risk: "unknown" as const,
          summary: "Could not complete AI pre-flight. Run formal screening.",
          findings: [],
        };
      }
      throw err;
    }
  });

// Required documents checklist
const DocsInput = z.object({
  accessToken: z.string().min(10).max(4000),
  incoterm: z.string().min(2).max(40),
  commodity: z.string().min(1).max(200),
  origin: z.string().min(1).max(120),
  destination: z.string().min(1).max(120),
});

export const requiredDocs = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => DocsInput.parse(i))
  .handler(async ({ data }) => {
    await auth(data.accessToken);
    try {
      const { output } = await generateText({
        model: gateway(),
        output: Output.object({
          schema: z.object({
            documents: z.array(
              z.object({
                name: z.string(),
                responsible: z.string(),
                purpose: z.string(),
              }),
            ),
          }),
        }),
        system:
          "List the required export/import documents for this shipment (commercial invoice, packing list, B/L or AWB, certificate of origin, phytosanitary/health if applicable, insurance certificate, dangerous-goods declaration if applicable, export/import licenses if applicable). For each: responsible party (Exporter/Importer/Freight forwarder), and a one-line purpose.",
        prompt: `Incoterm: ${data.incoterm}\nCommodity: ${data.commodity}\nRoute: ${data.origin} → ${data.destination}`,
      });
      return output;
    } catch (err) {
      if (NoObjectGeneratedError.isInstance(err)) {
        return {
          documents: [
            { name: "Commercial invoice", responsible: "Exporter", purpose: "Basis for customs valuation" },
            { name: "Packing list", responsible: "Exporter", purpose: "Itemized contents per package" },
            { name: "Bill of Lading", responsible: "Carrier / Freight forwarder", purpose: "Title & shipment evidence" },
          ],
        };
      }
      throw err;
    }
  });

// Translate contract markdown
const TxInput = z.object({
  accessToken: z.string().min(10).max(4000),
  contractId: z.string().uuid(),
  lang: z.string().min(2).max(10),
});

const LANG_NAMES: Record<string, string> = {
  en: "English",
  zh: "Simplified Chinese",
  es: "Spanish",
  ar: "Arabic",
  fr: "French",
  de: "German",
  ru: "Russian",
  pt: "Portuguese",
};

export const translateContract = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => TxInput.parse(i))
  .handler(async ({ data }) => {
    const me = await verifyPiToken(data.accessToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: contract } = await supabaseAdmin
      .from("contracts")
      .select("id, author_uid, body_markdown")
      .eq("id", data.contractId)
      .maybeSingle();
    if (!contract) throw new Error("Contract not found");
    if (contract.author_uid !== me.uid) {
      const { data: parties } = await supabaseAdmin
        .from("contract_parties")
        .select("joined_uid, pi_username")
        .eq("contract_id", data.contractId);
      const ok = (parties ?? []).some(
        (p) => p.joined_uid === me.uid || p.pi_username === me.username,
      );
      if (!ok) throw new Error("Not authorized");
    }
    const { data: existing } = await supabaseAdmin
      .from("contract_translations")
      .select("body_markdown")
      .eq("contract_id", data.contractId)
      .eq("lang", data.lang)
      .maybeSingle();
    if (existing?.body_markdown) return { body_markdown: existing.body_markdown, cached: true };

    const target = LANG_NAMES[data.lang] ?? data.lang;
    const { text } = await generateText({
      model: gateway(),
      system: `Translate the following international trade contract into ${target}. Preserve all Markdown structure, headings, numbering, party names, HS codes, Incoterms codes, amounts in π, and legal terms of art. Do not summarize. Do not add commentary.`,
      prompt: contract.body_markdown,
    });
    await supabaseAdmin
      .from("contract_translations")
      .upsert({ contract_id: data.contractId, lang: data.lang, body_markdown: text });
    return { body_markdown: text, cached: false };
  });