import { defineMcp } from "@lovable.dev/mcp-js";
import draftContractOutline from "./tools/draft-contract-outline";
import tradeTechIdeas from "./tools/trade-tech-ideas";

export default defineMcp({
  name: "pitrade-mcp",
  title: "PiTrade MCP",
  version: "0.1.0",
  instructions:
    "Tools for PiTrade — borderless import/export smart contracts settled in Pi (π). Use draft_contract_outline to build a structured Pi-settled trade contract outline, and trade_tech_ideas to surface fresh feature ideas informed by Pi Network, cross-border trade, and AI advances.",
  tools: [draftContractOutline, tradeTechIdeas],
});