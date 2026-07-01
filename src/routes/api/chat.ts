import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { createFileRoute } from "@tanstack/react-router";
import {
  convertToModelMessages,
  streamText,
  tool,
  stepCountIs,
  type UIMessage,
} from "ai";
import { z } from "zod";

type ChatRequestBody = { messages?: unknown };

const SYSTEM_PROMPT = `You are PiTrade Copilot, an AI assistant embedded inside PiTrade — an app that drafts borderless import & export smart contracts settled in Pi (π).

You help users with two things:
1. Pi-settled trade contract drafting: Incoterms 2020, HS codes, compliance, sanctions screening, Pi Network escrow, DAO arbitration.
2. Keeping users up to date with continuous advances in trade tech, the Pi Network ecosystem, cross-border payments, and AI features PiTrade could ship next.

Rules:
- Be concise and specific. Use bullet lists and short paragraphs.
- When the user wants a contract, call the "draftContract" tool instead of writing the contract inline.
- When the user wants the latest updates or feature ideas, call the "tradeTechUpdates" tool.
- Never invent Pi Network prices or make legal guarantees. Recommend counsel review.
- Always respond in the user's language.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { messages } = (await request.json()) as ChatRequestBody;
        if (!Array.isArray(messages)) {
          return new Response("Messages are required", { status: 400 });
        }

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway("google/gemini-3-flash-preview");

        const result = streamText({
          model,
          system: SYSTEM_PROMPT,
          messages: await convertToModelMessages(messages as UIMessage[]),
          stopWhen: stepCountIs(50),
          tools: {
            draftContract: tool({
              description:
                "Draft the outline of a Pi-settled import/export smart contract for the provided deal terms. Returns a structured summary the user can review before generating the full contract.",
              inputSchema: z.object({
                commodity: z.string(),
                quantity: z.string(),
                exporter: z.string(),
                importer: z.string(),
                incoterm: z.string(),
                priceInPi: z.string(),
                deliveryWindow: z.string(),
              }),
              execute: async (input) => ({
                summary: `Draft outline prepared for ${input.quantity} of ${input.commodity} from ${input.exporter} to ${input.importer} under ${input.incoterm}, priced at ${input.priceInPi}, delivered within ${input.deliveryWindow}.`,
                clauses: [
                  "Parties & KYC (verified via Pi Network identity)",
                  `Goods & specification: ${input.commodity}`,
                  `Quantity & packaging: ${input.quantity}`,
                  `Price & payment: ${input.priceInPi} escrowed on Pi mainnet`,
                  `Incoterm 2020: ${input.incoterm}`,
                  `Delivery: ${input.deliveryWindow}`,
                  "Documents: Commercial invoice, B/L, packing list, certificate of origin",
                  "Inspection & acceptance: SGS or agreed third-party inspector",
                  "Force majeure & sanctions clause",
                  "Dispute resolution: Pi DAO arbitration with ICC fallback",
                ],
                cta: "Open the 'Draft contract' form on the home page to generate the full signature-ready document.",
              }),
            }),
            tradeTechUpdates: tool({
              description:
                "Surface fresh, tailored ideas for how PiTrade could evolve — new features, integrations, or workflow improvements informed by the latest advances in Pi Network, cross-border trade, and AI.",
              inputSchema: z.object({
                topic: z
                  .string()
                  .describe(
                    "Focus area, e.g. 'Pi Network', 'AI drafting', 'compliance', 'logistics oracles'.",
                  ),
              }),
              execute: async ({ topic }) => {
                const ideas = [
                  {
                    title: "Live Pi price oracle in contracts",
                    detail:
                      "Peg π-denominated milestones to an on-chain Pi/USD oracle so payments auto-adjust at settlement time.",
                  },
                  {
                    title: "AI-drafted counter-offers",
                    detail:
                      "One-tap redline suggestions that regenerate specific clauses (price, Incoterm, delivery) instead of the whole contract.",
                  },
                  {
                    title: "Shipment milestone webhooks",
                    detail:
                      "Wire B/L issuance and port arrival events from Maersk / MSC APIs into Pi escrow release triggers.",
                  },
                  {
                    title: "Sanctions & dual-use pre-flight",
                    detail:
                      "Run OFAC + EU consolidated list checks on both parties at draft time and surface a compliance score.",
                  },
                  {
                    title: "Multilingual signing room",
                    detail:
                      "Side-by-side translated contract views with AI-verified equivalence for cross-language deals.",
                  },
                ];
                return { topic, updatedAt: new Date().toISOString(), ideas };
              },
            }),
          },
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages as UIMessage[],
        });
      },
    },
  },
});