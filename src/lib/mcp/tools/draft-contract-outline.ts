import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "draft_contract_outline",
  title: "Draft Pi-settled trade contract outline",
  description:
    "Produce a structured outline for a borderless import/export smart contract settled in Pi (π), given the deal terms.",
  inputSchema: {
    commodity: z.string().describe("Goods / commodity being traded."),
    quantity: z.string().describe("Quantity with units, e.g. '10,000 MT'."),
    exporter: z.string().describe("Exporter name and country."),
    importer: z.string().describe("Importer name and country."),
    incoterm: z.string().describe("Incoterms 2020 code, e.g. FOB, CIF."),
    priceInPi: z.string().describe("Total price expressed in Pi (π)."),
    deliveryWindow: z.string().describe("Delivery window / shipment period."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ commodity, quantity, exporter, importer, incoterm, priceInPi, deliveryWindow }) => {
    const summary = `Draft outline for ${quantity} of ${commodity} from ${exporter} to ${importer} under ${incoterm}, priced at ${priceInPi}, delivered within ${deliveryWindow}.`;
    const clauses = [
      "Parties & KYC (verified via Pi Network identity)",
      `Goods & specification: ${commodity}`,
      `Quantity & packaging: ${quantity}`,
      `Price & payment: ${priceInPi} escrowed on Pi mainnet`,
      `Incoterm 2020: ${incoterm}`,
      `Delivery: ${deliveryWindow}`,
      "Documents: Commercial invoice, B/L, packing list, certificate of origin",
      "Inspection & acceptance: SGS or agreed third-party inspector",
      "Force majeure & sanctions clause",
      "Dispute resolution: Pi DAO arbitration with ICC fallback",
    ];
    return {
      content: [{ type: "text", text: `${summary}\n\n- ${clauses.join("\n- ")}` }],
      structuredContent: { summary, clauses },
    };
  },
});