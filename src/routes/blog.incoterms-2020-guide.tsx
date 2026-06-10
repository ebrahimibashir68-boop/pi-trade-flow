import { createFileRoute, Link } from "@tanstack/react-router";

const TITLE = "Incoterms 2020 Guide: FCA, CIF & FOB for Pi-Settled Trade Contracts";
const DESCRIPTION =
  "A practical guide to Incoterms 2020 — FCA, CIF and FOB — and how to pick the right term when drafting a Pi-settled import/export smart contract in PiTrade.";
const URL = "https://pi-trade-flow.lovable.app/blog/incoterms-2020-guide";

export const Route = createFileRoute("/blog/incoterms-2020-guide")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "article" },
      { property: "og:url", content: URL },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: TITLE,
          description: DESCRIPTION,
          author: { "@type": "Organization", name: "PiTrade" },
          publisher: { "@type": "Organization", name: "PiTrade" },
          mainEntityOfPage: URL,
        }),
      },
    ],
  }),
  component: IncotermsGuide,
});

function IncotermsGuide() {
  return (
    <main className="min-h-screen bg-background text-foreground font-sans">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-sm bg-primary text-primary-foreground font-display text-xl">π</span>
          <span className="font-display text-2xl tracking-tight">PiTrade</span>
        </Link>
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← Home</Link>
      </header>

      <article className="mx-auto max-w-3xl px-6 py-12 prose-style">
        <p className="text-xs uppercase tracking-[0.18em] text-primary">Guide · Incoterms 2020</p>
        <h1 className="mt-3 font-display text-4xl leading-tight md:text-5xl">
          Incoterms 2020 for Pi-settled trade contracts
        </h1>
        <p className="mt-6 text-lg text-muted-foreground">
          Incoterms 2020 are the eleven three-letter rules published by the ICC that define
          who pays for carriage, who carries the risk, and who handles export and import
          clearance in a cross-border sale. When you draft a Pi-settled smart contract in
          PiTrade, the Incoterm you pick decides when the buyer's π escrow can be released.
        </p>

        <Section title="Why the Incoterm matters in a smart contract">
          <p>
            A traditional sales contract describes risk and cost transfer in prose. A
            Pi-settled smart contract turns that prose into release conditions on an
            on-chain escrow. The Incoterm decides which document — a Bill of Lading, an
            arrival notice, a proof-of-delivery — unlocks the next milestone payment in π.
            Pick the wrong term and the wrong party ends up paying for freight, insurance,
            or import duties.
          </p>
        </Section>

        <Section title="FCA — Free Carrier (2020 update)">
          <p>
            <strong>FCA</strong> is the most flexible rule in Incoterms 2020 and the one the
            ICC quietly recommends for containerised goods. The seller delivers the goods,
            cleared for export, to a carrier nominated by the buyer at a named place — the
            seller's premises, a forwarder's warehouse, or a port terminal.
          </p>
          <ul>
            <li><strong>Risk transfers</strong> when the goods are handed to the carrier.</li>
            <li><strong>Seller pays</strong> pre-carriage and export clearance.</li>
            <li><strong>Buyer pays</strong> main carriage, insurance, import duties.</li>
            <li>
              <strong>2020 change:</strong> the buyer can instruct the carrier to issue an
              on-board Bill of Lading to the seller — useful when the seller needs the B/L
              for a letter of credit, or, in PiTrade, as the escrow-release document.
            </li>
          </ul>
          <p>
            Use FCA when shipping FCL containers and you want the cleanest possible
            risk-transfer point for the smart-contract milestone.
          </p>
        </Section>

        <Section title="FOB — Free On Board">
          <p>
            <strong>FOB</strong> is the classic bulk-shipping term. The seller delivers the
            goods on board the vessel nominated by the buyer at the named port of shipment.
          </p>
          <ul>
            <li><strong>Risk transfers</strong> when the goods are on board the vessel.</li>
            <li><strong>Seller pays</strong> pre-carriage, terminal handling at origin, export clearance.</li>
            <li><strong>Buyer pays</strong> ocean freight, insurance, import duties.</li>
            <li>FOB is for sea and inland-waterway transport only — not containers.</li>
          </ul>
          <p>
            In PiTrade, FOB pairs well with an oracle that confirms B/L issuance at the
            origin port as the first milestone release.
          </p>
        </Section>

        <Section title="CIF — Cost, Insurance and Freight">
          <p>
            <strong>CIF</strong> looks similar to FOB but loads more obligations on the
            seller: the seller pays freight and minimum insurance to the named port of
            destination, yet risk still transfers when the goods are on board at origin.
          </p>
          <ul>
            <li><strong>Risk transfers</strong> on board at the port of shipment (same as FOB).</li>
            <li><strong>Seller pays</strong> freight and minimum cargo insurance (Institute Cargo Clauses C) to the destination port.</li>
            <li><strong>Buyer pays</strong> import clearance, duties, delivery from destination port.</li>
            <li>CIF is sea/inland-waterway only; for containers, switch to <strong>CIP</strong>.</li>
          </ul>
          <p>
            CIF is convenient for buyers who want a single price covering goods, freight,
            and basic insurance — useful when the importer doesn't have a freight account
            in the seller's country.
          </p>
        </Section>

        <Section title="Choosing the right term in PiTrade">
          <ul>
            <li><strong>FCL containers, modern supply chain →</strong> FCA, with B/L instruction so the seller still gets the document.</li>
            <li><strong>Bulk commodities by sea, buyer arranges shipping →</strong> FOB.</li>
            <li><strong>Bulk commodities by sea, seller arranges shipping &amp; insurance →</strong> CIF.</li>
            <li><strong>Containerised, seller arranges shipping &amp; insurance →</strong> CIP (not CIF).</li>
          </ul>
          <p>
            Whichever term you pick, type it into the <em>Incoterm 2020</em> field in the
            PiTrade contract generator with the named place — e.g. <code>FCA Addis Ababa</code>,
            <code> FOB Santos</code>, or <code>CIF Gothenburg</code>. The AI drafter wires the
            right risk-transfer language and the matching π escrow-release milestone into
            the contract.
          </p>
        </Section>

        <Section title="Common Incoterms 2020 mistakes">
          <ul>
            <li>Using <strong>FOB</strong> or <strong>CIF</strong> for container shipments — risk transfers in the wrong place.</li>
            <li>Forgetting that <strong>CIF</strong> only mandates minimum insurance — buyers of high-value cargo should require Institute Cargo Clauses A or switch to CIP with extended cover.</li>
            <li>Leaving the named place vague — "FCA Ethiopia" is not enforceable; "FCA Addis Ababa, Bole logistics terminal" is.</li>
            <li>Mixing Incoterms 2020 with older revisions — always state <em>Incoterms® 2020</em> in the contract.</li>
          </ul>
        </Section>

        <div className="mt-12 rounded-sm border border-border bg-card p-8">
          <h2 className="font-display text-2xl">Draft your contract</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Try one of these Incoterms in a real Pi-settled smart contract — the AI will
            produce a signature-ready draft in seconds.
          </p>
          <Link
            to="/"
            hash="generator"
            className="mt-6 inline-block rounded-sm bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-[var(--shadow-elegant)] hover:opacity-90"
          >
            Open the contract generator
          </Link>
        </div>

        <p className="mt-10 text-xs text-muted-foreground">
          This guide is educational and not legal advice. Always have qualified counsel
          review a trade contract before signing.
        </p>
      </article>

      <footer className="mx-auto max-w-3xl px-6 py-10 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-8">
          <p>© {new Date().getFullYear()} PiTrade — borderless commerce on the Pi Network.</p>
          <p className="font-display italic">π · Trade without borders</p>
        </div>
      </footer>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl md:text-3xl">{title}</h2>
      <div className="mt-4 space-y-4 text-base leading-relaxed text-muted-foreground [&_strong]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-2 [&_code]:rounded [&_code]:bg-secondary [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-xs">
        {children}
      </div>
    </section>
  );
}