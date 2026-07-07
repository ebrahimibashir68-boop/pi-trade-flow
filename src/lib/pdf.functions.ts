import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { verifyPiToken } from "./pi-auth.functions";

const Input = z.object({
  accessToken: z.string().min(10).max(4000),
  id: z.string().uuid(),
});

function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^#+\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1 ($2)");
}

function wrap(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  for (const raw of text.split("\n")) {
    if (raw.length <= maxChars) {
      lines.push(raw);
      continue;
    }
    const words = raw.split(/\s+/);
    let cur = "";
    for (const w of words) {
      if ((cur + " " + w).trim().length > maxChars) {
        if (cur) lines.push(cur);
        cur = w;
      } else {
        cur = cur ? cur + " " + w : w;
      }
    }
    if (cur) lines.push(cur);
  }
  return lines;
}

export const generateContractPdf = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(async ({ data }) => {
    const me = await verifyPiToken(data.accessToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: contract } = await supabaseAdmin
      .from("contracts")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!contract) throw new Error("Contract not found");

    const { data: parties } = await supabaseAdmin
      .from("contract_parties")
      .select("*")
      .eq("contract_id", data.id);
    if (contract.author_uid !== me.uid) {
      const ok = (parties ?? []).some(
        (p) => p.joined_uid === me.uid || p.pi_username === me.username,
      );
      if (!ok) throw new Error("Not authorized");
    }

    const { data: sigs } = await supabaseAdmin
      .from("contract_signatures")
      .select("*")
      .eq("contract_id", data.id)
      .order("signed_at");

    const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const PAGE_W = 595.28;
    const PAGE_H = 841.89;
    const MARGIN = 50;
    const LINE_H = 13;
    let page = pdf.addPage([PAGE_W, PAGE_H]);
    let y = PAGE_H - MARGIN;

    const newPage = () => {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    };

    const draw = (text: string, size = 10, useBold = false) => {
      const f = useBold ? bold : font;
      const lines = wrap(text, Math.floor((PAGE_W - 2 * MARGIN) / (size * 0.5)));
      for (const line of lines) {
        if (y < MARGIN + LINE_H) newPage();
        page.drawText(line, { x: MARGIN, y, size, font: f, color: rgb(0.1, 0.1, 0.1) });
        y -= size + 3;
      }
    };
    const gap = (h = 8) => (y -= h);

    draw("PiTrade — Borderless Trade Contract", 18, true);
    gap(4);
    draw(`Contract ID: ${contract.id}`, 9);
    draw(`Status: ${contract.status.toUpperCase()}`, 9);
    draw(`Content hash (SHA-256): ${contract.content_hash}`, 8);
    gap();

    draw("Parties", 13, true);
    for (const p of parties ?? []) {
      draw(
        `- ${p.role.toUpperCase()} · ${p.party_type} · ${p.name} (${p.country})${p.identifier ? ` · ID ${p.identifier}` : ""}${p.pi_username ? ` · @${p.pi_username}` : ""}`,
        10,
      );
    }
    gap();

    draw("Deal Terms", 13, true);
    draw(`Commodity: ${contract.commodity}`);
    draw(`Quantity: ${contract.quantity}`);
    draw(`Incoterm 2020: ${contract.incoterm}`);
    draw(`Price: ${contract.price_pi}`);
    draw(`Delivery window: ${contract.delivery_window}`);
    if (contract.notes) draw(`Notes: ${contract.notes}`);
    gap();

    draw("Contract Body", 13, true);
    draw(stripMarkdown(contract.body_markdown || "[No body drafted]"));
    gap();

    draw("Signatures & Audit Trail", 13, true);
    if (!sigs?.length) draw("No signatures yet.");
    for (const s of sigs ?? []) {
      const label = `${s.method.toUpperCase()} · @${s.signer_username ?? s.signer_uid} · ${new Date(s.signed_at).toISOString()}`;
      draw(label, 10, true);
      draw(`Signed hash: ${s.signed_hash}`, 8);
      if (s.typed_name) draw(`Typed name: ${s.typed_name}`);
      if (s.user_agent) draw(`User-Agent: ${s.user_agent}`, 8);
      gap(4);
    }

    const bytes = await pdf.save();
    const base64 = Buffer.from(bytes).toString("base64");
    return { base64, filename: `pitrade-${contract.id}.pdf` };
  });