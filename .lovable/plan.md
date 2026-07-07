
# Smart Import/Export Contract Registry

Turn PiTrade from a one-off drafter into a full **registry + signing room** for Pi-settled cross-border trade contracts, supporting individuals, companies, and government agencies as parties.

## What ships

### 1. Contracts registry (Lovable Cloud)
- New route `/contracts` — list of contracts the signed-in Pi user is a party to (as author, exporter, importer, or witness), with status pills: `draft`, `awaiting_signatures`, `signed`, `executed`, `cancelled`.
- New route `/contracts/new` — enhanced draft form (existing draft flow moves here) with:
  - Party type selector for each side: Individual / Company·Institution / Government agency (different required fields per type: personal ID, company reg# + tax ID, or ministry + official reference).
  - Goods, quantity, Incoterm 2020, price in π, delivery window, notes.
  - **HS code + duty lookup** button (AI-assisted, gateway call).
  - **Sanctions / OFAC pre-flight** button (AI-assisted screening summary against public consolidated lists — surfaces score + flags, never a legal guarantee).
  - **Required docs checklist** auto-generated from Incoterm + commodity (B/L, CO, phytosanitary, insurance, etc.).
- New route `/contracts/$id` — signing room:
  - Rendered contract (Markdown → styled view).
  - Party cards with signature status.
  - **Multilingual view** toggle (side-by-side original + AI translation, EN/ZH/ES/AR/FR).
  - Actions: invite counterparty (share link + Pi username), sign, download PDF, mark executed, cancel.

### 2. Signing (three methods, all recorded)
- **Pi wallet signature** — sign a canonical hash of the contract with the user's Pi identity; store `access_token` proof + hash + timestamp.
- **Typed e-signature** — full name + timestamp + IP, appended to audit trail.
- **Drawn signature** — canvas → PNG data URL, stored on the signature row.
- Every signature stores: `party_role`, `signer_uid`, `method`, `signed_hash`, `ip`, `user_agent`, `signed_at`. Contract becomes `signed` when both required parties have signed; `executed` on manual mark.

### 3. Compliance helpers (server functions, AI gateway)
- `lookupHsCode(commodity, destinationCountry)` → HS heading + estimated duty band + notes.
- `screenSanctions(partyName, country)` → risk level + list matches summary.
- `requiredDocs(incoterm, commodity)` → structured checklist.
- `translateContract(markdown, targetLang)` → translated markdown, cached per (contract_id, lang).

### 4. PDF export
- Server function renders contract + party block + full signature audit trail to PDF (title, parties, body, signatures with method/timestamp, hash footer for tamper-evidence).
- Available from `/contracts/$id`.

### 5. Chatbot upgrades
- Add tools: `lookupHsCode`, `screenSanctions`, `requiredDocs` so Copilot can answer compliance Qs inline.
- "Draft contract" tool already CTAs to the form — update CTA to `/contracts/new`.

## Data model (new tables, RLS scoped to Pi `uid`)

```text
contracts
  id, author_uid, status, commodity, quantity, incoterm, price_pi,
  delivery_window, notes, exporter_json, importer_json, body_markdown,
  content_hash, created_at, updated_at

contract_parties
  id, contract_id, role (exporter|importer|witness), party_type
  (individual|company|government), name, country, identifier (tax id /
  reg# / ministry ref), pi_username (nullable), email (nullable),
  invited_at, joined_uid (nullable)

contract_signatures
  id, contract_id, party_id, signer_uid, method (pi|typed|drawn),
  signed_hash, signature_image (nullable), ip, user_agent, signed_at

contract_translations
  id, contract_id, lang, body_markdown, created_at

contract_compliance
  id, contract_id, kind (hs|sanctions|docs), payload_json, created_at
```

RLS: read/write only when `auth.uid()` (Pi uid stored in JWT claim) matches `author_uid` or appears in `contract_parties.joined_uid`. Share link uses a signed token that grants a specific counterparty write access once, which then binds their `joined_uid`.

## Files

**New**
- `src/routes/contracts.tsx` (layout with `<Outlet />`)
- `src/routes/contracts.index.tsx` (list)
- `src/routes/contracts.new.tsx` (draft form)
- `src/routes/contracts.$id.tsx` (signing room)
- `src/lib/contracts.functions.ts` (create/list/get/sign/mark-executed/cancel)
- `src/lib/compliance.functions.ts` (HS, sanctions, docs, translate)
- `src/lib/pdf.functions.ts` (server-side PDF via `pdf-lib`)
- `src/components/contracts/PartyForm.tsx`
- `src/components/contracts/SignatureCapture.tsx` (canvas + typed + Pi tabs)
- `src/components/contracts/ComplianceBadges.tsx`
- Supabase migration for the 5 tables + policies + grants

**Edited**
- `src/routes/index.tsx` — hero CTAs point to `/contracts/new` and `/contracts`; the inline draft form stays as a quick preview but "Save & sign" routes into the registry.
- `src/routes/api/chat.ts` — add compliance tools.
- `src/components/SettingsMenu.tsx` — add "My contracts" link.
- `src/lib/mcp/index.ts` + one new MCP tool `list_recent_contracts` (public metadata only).

## Technical notes

- All AI calls go through the existing `createLovableAiGatewayProvider` on `google/gemini-3-flash-preview`; structured outputs use `Output.object` with schemas kept minimal (limits stated in prompt, clamped in code).
- Every mutating server fn calls `verifyPiToken(accessToken)` first (same pattern as `generateContract`), and uses the returned `uid` as `author_uid` / `signer_uid` — never trusts client-supplied identity.
- Content hash = SHA-256 of canonical JSON `{body_markdown, parties, price_pi, incoterm, delivery_window}`; recomputed at each signature so a post-signature edit invalidates prior signatures (status auto-reverts to `awaiting_signatures`).
- PDF: `pdf-lib` (pure JS, Worker-safe). No native deps.
- Share link: `/contracts/$id?invite=<jwt>` where JWT is signed with `LOVABLE_APP_SIGNING_SECRET` (auto-generated if missing) and carries `{contract_id, party_id, exp}`.

Confirm this plan and I'll build it end-to-end, enabling Lovable Cloud for the registry.
