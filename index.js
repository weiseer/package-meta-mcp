#!/usr/bin/env node
/** @weiseer/package-meta-mcp — npm/PyPI/Cargo package metadata + downloads + maintainer health. P-007. Apache-2.0 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLED = join(__dirname, "package_meta.json");
const REMOTE = process.env.PKG_META_URL || "https://oracle.weiseer.com/package_meta.json";
const LOCAL_ONLY = !!process.env.PKG_META_LOCAL_ONLY;
const TTL = 10 * 60 * 1000;
let _c = null, _t = 0;
async function load() {
  const now = Date.now();
  if (_c && now - _t < TTL) return _c;
  if (!LOCAL_ONLY) {
    try {
      const ctrl = new AbortController();
      const tt = setTimeout(() => ctrl.abort(), 5000);
      const r = await fetch(REMOTE, { signal: ctrl.signal });
      clearTimeout(tt);
      if (r.ok) { _c = await r.json(); _c._source = "remote"; _t = now; return _c; }
    } catch {}
  }
  _c = JSON.parse(readFileSync(BUNDLED, "utf-8"));
  _c._source = "bundled"; _t = now;
  return _c;
}
function _prov(d) { return { snapshot_as_of: d.as_of, snapshot_source: d._source, served_by: "weiseer/package-meta", served_at: new Date().toISOString() }; }
function _related() { return {
  api_changelog: "npx -y @weiseer/api-changelog-mcp",
  cve_cache:     "npx -y @weiseer/cve-cache-mcp",
  license:       "npx -y @weiseer/license-checker-mcp",
  org_index:     "https://github.com/weiseer"
}; }

async function lookupPackage({ name, ecosystem }) {
  if (!name) return { error: "name required" };
  const d = await load();
  const p = (d.packages || []).find(x => x.name.toLowerCase() === name.toLowerCase() && (!ecosystem || x.ecosystem === ecosystem));
  if (!p) return { error: `package '${name}' not in cache`, available_ecosystems: ["npm","pypi","cargo","maven","go"] };
  return { ...p, ..._prov(d) };
}
async function findByMaintainer({ maintainer }) {
  if (!maintainer) return { error: "maintainer required" };
  const d = await load();
  const ps = (d.packages || []).filter(p => (p.maintainers || []).some(m => m.toLowerCase() === maintainer.toLowerCase()));
  return { ..._prov(d), maintainer, count: ps.length, packages: ps.map(x => ({ name: x.name, ecosystem: x.ecosystem, latest_version: x.latest_version })), related_services: _related() };
}
async function getDownloadStats({ name, ecosystem, period = "weekly" }) {
  if (!name) return { error: "name required" };
  const d = await load();
  const p = (d.packages || []).find(x => x.name.toLowerCase() === name.toLowerCase() && (!ecosystem || x.ecosystem === ecosystem));
  if (!p) return { error: `'${name}' not in cache` };
  return { ..._prov(d), name, ecosystem: p.ecosystem, downloads: (p.downloads || {})[period] || 0, period, source_url: p.source_url };
}
async function getMaintainerHealth({ name, ecosystem }) {
  if (!name) return { error: "name required" };
  const d = await load();
  const p = (d.packages || []).find(x => x.name.toLowerCase() === name.toLowerCase() && (!ecosystem || x.ecosystem === ecosystem));
  if (!p) return { error: `'${name}' not in cache` };
  const h = p.health || {};
  return { ..._prov(d), name, ecosystem: p.ecosystem, last_release_at: p.last_release_at, days_since_release: h.days_since_release, open_issues: h.open_issues, open_prs: h.open_prs, maintainer_count: (p.maintainers || []).length, health_score: h.score, related_services: _related() };
}

const TOOLS = [
  { name: "lookup_package", description: "Full metadata for a package — version, license, maintainers, repo, downloads, health.", inputSchema: { type: "object", properties: { name: { type: "string" }, ecosystem: { type: "string", description: "npm/pypi/cargo/maven/go" } }, required: ["name"] } },
  { name: "find_by_maintainer", description: "All cached packages by a maintainer username. Useful for supply-chain audits.", inputSchema: { type: "object", properties: { maintainer: { type: "string" } }, required: ["maintainer"] } },
  { name: "get_download_stats", description: "Download counts for a package (daily/weekly/monthly).", inputSchema: { type: "object", properties: { name: { type: "string" }, ecosystem: { type: "string" }, period: { type: "string", default: "weekly" } }, required: ["name"] } },
  { name: "get_maintainer_health", description: "Maintainer-health signals: days since release, open issues/PRs, maintainer count, composite score.", inputSchema: { type: "object", properties: { name: { type: "string" }, ecosystem: { type: "string" } }, required: ["name"] } },
];
const HANDLERS = { lookup_package: lookupPackage, find_by_maintainer: findByMaintainer, get_download_stats: getDownloadStats, get_maintainer_health: getMaintainerHealth };
const server = new Server({ name: "package-meta", version: "0.1.0" }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  const h = HANDLERS[name];
  if (!h) return { content: [{ type: "text", text: JSON.stringify({ error: `unknown tool: ${name}` }) }], isError: true };
  try { return { content: [{ type: "text", text: JSON.stringify(await h(args || {}), null, 2) }] }; }
  catch (e) { return { content: [{ type: "text", text: JSON.stringify({ error: e.message }) }], isError: true }; }
});
await server.connect(new StdioServerTransport());
process.stderr.write("package-meta connected via stdio\n");
