import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";

import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { verifyPiToken } from "./pi-auth.functions";

const ContractInput = z.object({
  commodity: z.string().min(1).max(200),
  quantity: z.string().min(1).max(120),
  exporter: z.string().min(1).max(200),
  exporterCountry: z.string().min(1).max(120),
  importer: z.string().min(1).max(200),
  importerCountry: z.string().min(1).max(120),
  incoterm: z.string().min(2).max(20),
  priceInPi: z.string().min(1).max(80),
  deliveryWindow: z.string().min(1).max(120),
  notes: z.string().max(2000).optional().default(""),
  accessToken: z.string().min(10).max(4000),
});

export const generateContract = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ContractInput.parse(input))
  .handler(async ({ data }) => {
    try {
      await verifyPiToken(data.accessToken);
    } catch (e) {
      console.error("generateContract auth failed", e);
      throw new Error("Please sign in with Pi to generate contracts.");
    }
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");

    const system = `You are a trade-law drafting engine that produces borderless, Pi-network-settled smart contracts for international import/export of goods and commodities.

Output a complete, signature-ready contract in clean Markdown with:
- Title
- Parties (Exporter / Importer with countries)
- Recitals
- 1. Goods & Specifications
- 2. Quantity, Quality & Inspection
- 3. Price & Pi Settlement (denominate in Pi (π), include on-chain escrow via Pi smart contract, milestone releases on Bill of Lading + inspection)
- 4. Incoterms ${"(use the user-provided Incoterm 2020)"}
- 5. Delivery, Shipping & Documentation (B/L, Certificate of Origin, Phytosanitary if applicable, Insurance)
- 6. Customs, Duties & Borderless Compliance (AI-assisted HS classification, sanctions screening, dual-use check)
- 7. Risk, Title & Insurance
- 8. Force Majeure
- 9. Dispute Resolution (Pi DAO arbitration + ICC fallback, governing law neutral)
- 10. Termination
- 11. Smart Contract Execution Clause (reference Pi Network mainnet, oracle providers for shipment + price feeds, multisig keys)
- Signature blocks

Be concrete, legally credible, and concise. Do not invent counterparties beyond what is given. Mark unknowns with [TBD].`;

    const userPrompt = `Draft the contract using these terms:
- Commodity / Goods: ${data.commodity}
- Quantity: ${data.quantity}
- Exporter: ${data.exporter} (${data.exporterCountry})
- Importer: ${data.importer} (${data.importerCountry})
- Incoterm 2020: ${data.incoterm}
- Price (in Pi, π): ${data.priceInPi}
- Delivery window: ${data.deliveryWindow}
- Additional notes: ${data.notes || "none"}`;

    try {
      const { text } = await generateText({
        model,
        system,
        prompt: userPrompt,
      });
      return { contract: text };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "AI request failed";
      console.error("generateContract AI gateway error:", err);
      if (message.includes("429")) {
        throw new Error("Rate limit reached. Please wait a moment and try again.");
      }
      if (message.includes("402")) {
        throw new Error("AI credits exhausted. Add credits in your Lovable workspace billing.");
      }
      throw new Error("Contract generation failed. Please try again.");
    }
  });