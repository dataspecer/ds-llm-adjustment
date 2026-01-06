import type { Request, Response } from "express";
import crypto from "crypto";

export interface McpServerOptions {
  basePath: string;
  authSecret?: string;
}

export interface McpServerDeps {
  /**
   * Absolute base URL to the backend API (apiBasename), e.g. http://127.0.0.1:3100/data-specification/api
   */
  apiBaseUrl?: string;
}

/**
 * Register MCP endpoints using the official SDK and server-http transport when available.
 * Falls back to a minimal SSE+JSON-RPC shim if the packages are unavailable.
 */
export function registerMcpHandlers(app: any, options: McpServerOptions, deps?: McpServerDeps) {
  const ssePath = options.basePath + "/sse";
  const msgPath = options.basePath + "/message";

  // Authorization helper
  const authorize = (req: Request): boolean => {
    if (!options.authSecret) return true;
    const header = req.header("authorization") || req.header("Authorization");
    if (!header) return false;
    const expected = `Bearer ${options.authSecret}`;
    if (header === expected) return true;
    const date = req.header("x-date");
    const signature = req.header("x-signature");
    if (date && signature) {
      const hmac = crypto.createHmac("sha256", options.authSecret);
      hmac.update(date);
      const digest = `sha256=${hmac.digest("hex")}`;
      return signature === digest;
    }
    return false;
  };

  // Shim-based SSE + message endpoints implementing needed tools
  (async () => {
    // Minimal shim with built-in tools
    const connections = new Set<Response>();
    const plans = new Map<string, { id: string; createdAt: number; expiresAt: number; operations: any[] }>();

    const emit = (event: { type: string; data?: any }) => {
      const payload = `event: ${event.type}\n` + (event.data ? `data: ${JSON.stringify(event.data)}\n` : "") + "\n";
      for (const res of connections) {
        res.write(payload);
      }
    };

    app.get(ssePath, (req: Request, res: Response) => {
      if (!authorize(req)) return res.status(401).end();
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders?.();
      connections.add(res);
      emit({
        type: "mcp.hello",
        data: {
          tools: [
            {
              name: "health",
              description: "Health check tool returning 'ok'",
              inputSchema: { type: "object", properties: {}, additionalProperties: false },
            },
            { name: "dataspecer.list_specs", description: "List root specs/packages", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
            {
              name: "dataspecer.list_resources",
              description: "List resources in a package",
              inputSchema: {
                type: "object",
                properties: { parentIri: { type: "string" } },
                required: ["parentIri"],
                additionalProperties: false,
              },
            },
            {
              name: "dataspecer.get_psm",
              description: "Fetch PSM JSON for IRI (alias of get_resource_blob)",
              inputSchema: {
                type: "object",
                properties: { iri: { type: "string" } },
                required: ["iri"],
                additionalProperties: false,
              },
            },
            {
              name: "dataspecer.get_resource_blob",
              description: "Get resource blob (text) by IRI",
              inputSchema: {
                type: "object",
                properties: { iri: { type: "string" } },
                required: ["iri"],
                additionalProperties: false,
              },
            },
            {
              name: "dataspecer.get_zip_export",
              description: "Get package export.zip (base64)",
              inputSchema: {
                type: "object",
                properties: { iri: { type: "string" } },
                required: ["iri"],
                additionalProperties: false,
              },
            },
            {
              name: "dataspecer.preview_file",
              description: "Preview generated file under /preview/*",
              inputSchema: {
                type: "object",
                properties: { path: { type: "string" } },
                required: ["path"],
                additionalProperties: false,
              },
            },
            {
              name: "dataspecer.get_json_schema",
              description: "Get JSON Schema via preview endpoint",
              inputSchema: {
                type: "object",
                properties: {
                  dataSpecificationIri: { type: "string" },
                  psmIri: { type: "string" },
                },
                required: ["dataSpecificationIri"],
                additionalProperties: false,
              },
            },
            {
              name: "dataspecer.validate_spec",
              description: "Validate generated JSON Schema (parse-only)",
              inputSchema: {
                type: "object",
                properties: { dataSpecificationIri: { type: "string" }, psmIri: { type: "string" } },
                required: ["dataSpecificationIri"],
                additionalProperties: false,
              },
            },
            {
              name: "dataspecer.import_zip",
              description: "Import a package from base64 zip",
              inputSchema: {
                type: "object",
                properties: { base64Zip: { type: "string" }, targetParentIri: { type: "string" } },
                required: ["base64Zip"],
                additionalProperties: false,
              },
            },
            {
              name: "dataspecer.copy_recursively",
              description: "Copy resource/package recursively",
              inputSchema: {
                type: "object",
                properties: { iri: { type: "string" }, parentIri: { type: "string" } },
                required: ["iri", "parentIri"],
                additionalProperties: false,
              },
            },
            { name: "dataspecer.get_default_configuration", description: "Fetch default generator configuration", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
            {
              name: "dataspecer.get_system_data",
              description: "Download database as zip (dev only)",
              inputSchema: { type: "object", properties: {}, additionalProperties: false },
            },
            {
              name: "dataspecer.get_simplified_model",
              description: "Get simplified semantic model by IRI",
              inputSchema: {
                type: "object",
                properties: { iri: { type: "string" } },
                required: ["iri"],
                additionalProperties: false,
              },
            },
            {
              name: "dataspecer.set_simplified_model",
              description: "Set simplified semantic model by IRI (mutating)",
              inputSchema: {
                type: "object",
                properties: { iri: { type: "string" }, modelJson: { type: "string" } },
                required: ["iri", "modelJson"],
                additionalProperties: false,
              },
            },
            {
              name: "dataspecer.generate_lightweight_owl",
              description: "Generate lightweight OWL (TTL) from simplified model JSON",
              inputSchema: {
                type: "object",
                properties: { simplifiedJson: { type: "string" } },
                required: ["simplifiedJson"],
                additionalProperties: false,
              },
            },
            {
              name: "dataspecer.generate_lightweight_owl_from_iri",
              description: "Generate lightweight OWL (TTL) from simplified model by IRI",
              inputSchema: {
                type: "object",
                properties: { iri: { type: "string" } },
                required: ["iri"],
                additionalProperties: false,
              },
            },
            {
              name: "dataspecer.generate_app",
              description: "Generate application zip for a model IRI",
              inputSchema: {
                type: "object",
                properties: { iri: { type: "string" } },
                required: ["iri"],
                additionalProperties: false,
              },
            },
            {
              name: "dataspecer.preview_apply",
              description: "Validate a set of planned changes without mutating",
              inputSchema: {
                type: "object",
                properties: {
                  operations: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        op: { type: "string" },
                        args: { type: "object" },
                      },
                      required: ["op", "args"],
                      additionalProperties: false,
                    },
                  },
                  token: { type: "string" },
                },
                required: ["operations"],
                additionalProperties: false,
              },
            },
            {
              name: "dataspecer.apply_changes",
              description: "Apply a previously previewed plan",
              inputSchema: {
                type: "object",
                properties: {
                  planId: { type: "string" },
                  confirm: { type: "boolean" },
                  token: { type: "string" },
                },
                required: ["planId", "confirm"],
                additionalProperties: false,
              },
            },
          ],
        },
      });
      req.on("close", () => {
        connections.delete(res);
      });
    });

    app.post(msgPath, (req: Request, res: Response) => {
      if (!authorize(req)) return res.status(401).json({ error: "unauthorized" });
      const body = req.body as any;
      const processOneSync = (msg: any) => {
        if (!msg || msg.jsonrpc !== "2.0") {
          return { jsonrpc: "2.0", id: msg?.id ?? null, error: { code: -32600, message: "Invalid Request" } };
        }
        if (msg.method === "tools/call") {
          const name = msg?.params?.name as string | undefined;
          const args = (msg?.params?.arguments as any) ?? {};
          if (name === "health") {
            return { jsonrpc: "2.0", id: msg.id ?? null, result: { content: [{ type: "text", text: "ok" }] } };
          }
          if (
            name === "dataspecer.get_resource_blob" ||
            name === "dataspecer.get_zip_export" ||
            name === "dataspecer.get_json_schema" ||
            name === "dataspecer.list_specs" ||
            name === "dataspecer.list_resources" ||
            name === "dataspecer.get_psm" ||
            name === "dataspecer.preview_file" ||
            name === "dataspecer.validate_spec" ||
            name === "dataspecer.import_zip" ||
            name === "dataspecer.copy_recursively" ||
            name === "dataspecer.get_default_configuration" ||
            name === "dataspecer.get_system_data" ||
            name === "dataspecer.get_simplified_model" ||
            name === "dataspecer.set_simplified_model" ||
            name === "dataspecer.generate_lightweight_owl" ||
            name === "dataspecer.generate_app" ||
            name === "dataspecer.preview_apply" ||
            name === "dataspecer.apply_changes"
          ) {
            // handled asynchronously below
            return null as any;
          }
          return { jsonrpc: "2.0", id: msg.id ?? null, error: { code: -32601, message: "Unknown tool" } };
        }
        if (msg.method === "ping") {
          return { jsonrpc: "2.0", id: msg.id ?? null, result: { pong: true } };
        }
        return { jsonrpc: "2.0", id: msg.id ?? null, error: { code: -32601, message: "Method not found" } };
      };
      const handleAsync = async () => {
        const base = deps?.apiBaseUrl?.replace(/\/+$/, "");
        const handleOne = async (msg: any) => {
          const sync = processOneSync(msg);
          if (sync !== null && sync !== undefined) return sync;
          if (!base) return { jsonrpc: "2.0", id: msg?.id ?? null, error: { code: -32602, message: "Missing apiBaseUrl" } };
          const name = msg?.params?.name as string | undefined;
          const args = (msg?.params?.arguments as any) ?? {};
          // Preview/apply gated operations
          if (name === "dataspecer.preview_apply") {
            if (options.authSecret && args.token !== options.authSecret) {
              return { jsonrpc: "2.0", id: msg.id ?? null, error: { code: 401, message: "invalid token" } };
            }
            const operations = Array.isArray(args.operations) ? args.operations : [];
            const issues: Array<{ level: string; message: string }> = [];
            for (const op of operations) {
              if (!op || typeof op !== "object" || typeof op.op !== "string" || typeof op.args !== "object") {
                issues.push({ level: "error", message: "Invalid operation shape" });
                continue;
              }
              switch (op.op) {
                case "update_blob_json": {
                  const j = op.args?.json;
                  if (typeof j !== "string") issues.push({ level: "error", message: "update_blob_json.json must be string" });
                  else {
                    try { JSON.parse(j); } catch (e: any) { issues.push({ level: "error", message: `Invalid JSON: ${e?.message ?? "parse error"}` }); }
                  }
                  if (!op.args?.iri) issues.push({ level: "error", message: "update_blob_json.iri required" });
                  break;
                }
                case "update_metadata": {
                  if (!op.args?.iri) issues.push({ level: "error", message: "update_metadata.iri required" });
                  if (typeof op.args?.userMetadata !== "object") issues.push({ level: "error", message: "update_metadata.userMetadata must be object" });
                  break;
                }
                case "create_package": {
                  if (!op.args?.parentIri) issues.push({ level: "error", message: "create_package.parentIri required" });
                  break;
                }
                case "create_resource": {
                  if (!op.args?.parentIri) issues.push({ level: "error", message: "create_resource.parentIri required" });
                  if (typeof op.args?.type !== "string" || !op.args.type) issues.push({ level: "error", message: "create_resource.type required" });
                  break;
                }
                case "delete_resource": {
                  if (!op.args?.iri) issues.push({ level: "error", message: "delete_resource.iri required" });
                  break;
                }
                case "copy_recursively": {
                  if (!op.args?.iri || !op.args?.parentIri) issues.push({ level: "error", message: "copy_recursively.iri and parentIri required" });
                  break;
                }
                default:
                  issues.push({ level: "error", message: `Unsupported op: ${op.op}` });
              }
            }
            const ok = issues.filter(i => i.level === "error").length === 0;
            const planId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
            plans.set(planId, { id: planId, createdAt: Date.now(), expiresAt: Date.now() + 10 * 60 * 1000, operations });
            return {
              jsonrpc: "2.0",
              id: msg.id ?? null,
              result: {
                planId,
                report: { ok, issues },
              },
            };
          }
          if (name === "dataspecer.apply_changes") {
            if (options.authSecret && args.token !== options.authSecret) {
              return { jsonrpc: "2.0", id: msg.id ?? null, error: { code: 401, message: "invalid token" } };
            }
            if (args.confirm !== true) {
              return { jsonrpc: "2.0", id: msg.id ?? null, error: { code: 400, message: "confirm=true required" } };
            }
            const planId = String(args.planId ?? "");
            const plan = plans.get(planId);
            if (!plan) {
              return { jsonrpc: "2.0", id: msg.id ?? null, error: { code: 404, message: "plan not found" } };
            }
            if (Date.now() > plan.expiresAt) {
              plans.delete(planId);
              return { jsonrpc: "2.0", id: msg.id ?? null, error: { code: 410, message: "plan expired" } };
            }
            const changed: string[] = [];
            for (const op of plan.operations) {
              switch (op.op) {
                case "update_blob_json": {
                  const iri = String(op.args.iri);
                  const name = op.args.name ? String(op.args.name) : "model";
                  const j = JSON.parse(String(op.args.json));
                  const r = await fetch(`${base}/resources/blob?iri=${encodeURIComponent(iri)}&name=${encodeURIComponent(name)}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(j),
                  });
                  if (!r.ok) return { jsonrpc: "2.0", id: msg.id ?? null, error: { code: r.status, message: `update_blob_json failed: ${r.statusText}` } };
                  changed.push(iri);
                  break;
                }
                case "update_metadata": {
                  const iri = String(op.args.iri);
                  const md = op.args.userMetadata || {};
                  const r = await fetch(`${base}/resources?iri=${encodeURIComponent(iri)}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userMetadata: md }),
                  });
                  if (!r.ok) return { jsonrpc: "2.0", id: msg.id ?? null, error: { code: r.status, message: `update_metadata failed: ${r.statusText}` } };
                  changed.push(iri);
                  break;
                }
                case "create_package": {
                  const parentIri = String(op.args.parentIri);
                  const iri = op.args.iri ? String(op.args.iri) : undefined;
                  const md = op.args.userMetadata || {};
                  const r = await fetch(`${base}/resources/packages?parentIri=${encodeURIComponent(parentIri)}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ iri, userMetadata: md }),
                  });
                  if (!r.ok) return { jsonrpc: "2.0", id: msg.id ?? null, error: { code: r.status, message: `create_package failed: ${r.statusText}` } };
                  changed.push(parentIri);
                  break;
                }
                case "create_resource": {
                  const parentIri = String(op.args.parentIri);
                  const iri = op.args.iri ? String(op.args.iri) : undefined;
                  const type = String(op.args.type);
                  const md = op.args.userMetadata || {};
                  const r = await fetch(`${base}/resources?parentIri=${encodeURIComponent(parentIri)}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ iri, type, userMetadata: md }),
                  });
                  if (!r.ok) return { jsonrpc: "2.0", id: msg.id ?? null, error: { code: r.status, message: `create_resource failed: ${r.statusText}` } };
                  changed.push(parentIri);
                  break;
                }
                case "delete_resource": {
                  const iri = String(op.args.iri);
                  const r = await fetch(`${base}/resources?iri=${encodeURIComponent(iri)}`, { method: "DELETE" });
                  if (!r.ok && r.status !== 204) return { jsonrpc: "2.0", id: msg.id ?? null, error: { code: r.status, message: `delete_resource failed: ${r.statusText}` } };
                  changed.push(iri);
                  break;
                }
                case "copy_recursively": {
                  const iri = String(op.args.iri);
                  const parentIri = String(op.args.parentIri);
                  const r = await fetch(`${base}/repository/copy-recursively?iri=${encodeURIComponent(iri)}&parentIri=${encodeURIComponent(parentIri)}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userMetadata: {} }),
                  });
                  if (!r.ok) return { jsonrpc: "2.0", id: msg.id ?? null, error: { code: r.status, message: `copy_recursively failed: ${r.statusText}` } };
                  changed.push(parentIri);
                  break;
                }
                default:
                  return { jsonrpc: "2.0", id: msg.id ?? null, error: { code: -32601, message: `Unsupported op: ${op.op}` } };
              }
            }
            plans.delete(planId);
            return { jsonrpc: "2.0", id: msg.id ?? null, result: { applied: true, changedIris: changed } };
          }
          if (name === "dataspecer.list_specs") {
            //http://localhost:3002/api/resources/packages?iri=http%3A%2F%2Fdataspecer.com%2Fpackages%2Flocal-root
            const url = `${base}/resources/packages?iri=${encodeURIComponent("http://dataspecer.com/packages/local-root")}`;
            const r = await fetch(url);
            if (!r.ok) return { jsonrpc: "2.0", id: msg.id ?? null, error: { code: r.status, message: r.statusText } };
            const text = await r.text();
            return { jsonrpc: "2.0", id: msg.id ?? null, result: { content: [{ type: "text", text }] } };
          }
          if (name === "dataspecer.list_resources") {
            const parentIri = String(args.parentIri ?? "");
            const url = `${base}/resources/packages?iri=${encodeURIComponent(parentIri)}`;
            const r = await fetch(url);
            if (!r.ok) return { jsonrpc: "2.0", id: msg.id ?? null, error: { code: r.status, message: r.statusText } };
            const text = await r.text();
            return { jsonrpc: "2.0", id: msg.id ?? null, result: { content: [{ type: "text", text }] } };
          }
          if (name === "dataspecer.get_psm") {
            const iri = String(args.iri ?? "");
            const url = `${base}/resources/blob?iri=${encodeURIComponent(iri)}`;
            const r = await fetch(url);
            if (!r.ok) return { jsonrpc: "2.0", id: msg.id ?? null, error: { code: r.status, message: r.statusText } };
            const text = await r.text();
            return { jsonrpc: "2.0", id: msg.id ?? null, result: { content: [{ type: "text", text }] } };
          }
          if (name === "dataspecer.get_resource_blob") {
            const iri = String(args.iri ?? "");
            const url = `${base}/resources/blob?iri=${encodeURIComponent(iri)}`;
            const r = await fetch(url);
            if (!r.ok) return { jsonrpc: "2.0", id: msg.id ?? null, error: { code: r.status, message: r.statusText } };
            const text = await r.text();
            return { jsonrpc: "2.0", id: msg.id ?? null, result: { content: [{ type: "text", text }] } };
          }
          if (name === "dataspecer.get_zip_export") {
            const iri = String(args.iri ?? "");
            const url = `${base}/resources/export.zip?iri=${encodeURIComponent(iri)}`;
            const r = await fetch(url);
            if (!r.ok) return { jsonrpc: "2.0", id: msg.id ?? null, error: { code: r.status, message: r.statusText } };
            const arrayBuf = await r.arrayBuffer();
            const b64 = Buffer.from(arrayBuf).toString("base64");
            return { jsonrpc: "2.0", id: msg.id ?? null, result: { content: [{ type: "bytes", data: b64, mimeType: "application/zip" }] } };
          }
          if (name === "dataspecer.preview_file") {
            const path = String(args.path ?? "").replace(/^\/+/, "");
            const url = `${base}/preview/${path}`;
            const r = await fetch(url);
            if (!r.ok) return { jsonrpc: "2.0", id: msg.id ?? null, error: { code: r.status, message: r.statusText } };
            const ct = r.headers.get("content-type") || "";
            if (ct.startsWith("text/") || ct.includes("json") || ct.includes("xml") || ct.includes("html")) {
              const text = await r.text();
              return { jsonrpc: "2.0", id: msg.id ?? null, result: { content: [{ type: "text", text }] } };
            }
            const arrayBuf = await r.arrayBuffer();
            const b64 = Buffer.from(arrayBuf).toString("base64");
            return { jsonrpc: "2.0", id: msg.id ?? null, result: { content: [{ type: "bytes", data: b64, mimeType: ct || "application/octet-stream" }] } };
          }
          if (name === "dataspecer.get_json_schema") {
            const dataSpecificationIri = String(args.dataSpecificationIri ?? "");
            const psmIri = args.psmIri ? String(args.psmIri) : undefined;
            const baseUrl = `${base}/preview/schema.json?iri=${encodeURIComponent(dataSpecificationIri)}`;
            const url = psmIri ? `${baseUrl}&psm=${encodeURIComponent(psmIri)}` : baseUrl;
            const r = await fetch(url);
            if (!r.ok) return { jsonrpc: "2.0", id: msg.id ?? null, error: { code: r.status, message: r.statusText } };
            const text = await r.text();
            return { jsonrpc: "2.0", id: msg.id ?? null, result: { content: [{ type: "text", text }] } };
          }
          if (name === "dataspecer.validate_spec") {
            const dataSpecificationIri = String(args.dataSpecificationIri ?? "");
            const psmIri = args.psmIri ? String(args.psmIri) : undefined;
            const baseUrl = `${base}/preview/schema.json?iri=${encodeURIComponent(dataSpecificationIri)}`;
            const url = psmIri ? `${baseUrl}&psm=${encodeURIComponent(psmIri)}` : baseUrl;
            const r = await fetch(url);
            if (!r.ok) return { jsonrpc: "2.0", id: msg.id ?? null, result: { valid: false, issues: [{ level: "error", message: `${r.status} ${r.statusText}` }] } };
            const text = await r.text();
            try {
              JSON.parse(text);
              return { jsonrpc: "2.0", id: msg.id ?? null, result: { valid: true, issues: [] } };
            } catch (e: any) {
              return { jsonrpc: "2.0", id: msg.id ?? null, result: { valid: false, issues: [{ level: "error", message: e?.message ?? "Invalid JSON" }] } };
            }
          }
          if (name === "dataspecer.import_zip") {
            const base64Zip = String(args.base64Zip ?? "");
            const targetParentIri = args.targetParentIri ? String(args.targetParentIri) : undefined;
            const form = new FormData();
            const blob = new Blob([Buffer.from(base64Zip, "base64")], { type: "application/zip" });
            form.append("file", blob, "import.zip");
            const url = `${base}${`/resources/import-zip`}${targetParentIri ? `?parentIri=${encodeURIComponent(targetParentIri)}` : ""}`;
            const r = await fetch(url, { method: "POST", body: form as any });
            if (!r.ok) return { jsonrpc: "2.0", id: msg.id ?? null, error: { code: r.status, message: r.statusText } };
            const text = await r.text();
            return { jsonrpc: "2.0", id: msg.id ?? null, result: { content: [{ type: "text", text }] } };
          }
          if (name === "dataspecer.copy_recursively") {
            const iri = String(args.iri ?? "");
            const parentIri = String(args.parentIri ?? "");
            const url = `${base}/repository/copy-recursively?iri=${encodeURIComponent(iri)}&parentIri=${encodeURIComponent(parentIri)}`;
            const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userMetadata: {} }) });
            if (!r.ok) return { jsonrpc: "2.0", id: msg.id ?? null, error: { code: r.status, message: r.statusText } };
            const text = await r.text();
            return { jsonrpc: "2.0", id: msg.id ?? null, result: { content: [{ type: "text", text }] } };
          }
          if (name === "dataspecer.get_default_configuration") {
            const r = await fetch(`${base}/default-configuration`);
            if (!r.ok) return { jsonrpc: "2.0", id: msg.id ?? null, error: { code: r.status, message: r.statusText } };
            const text = await r.text();
            return { jsonrpc: "2.0", id: msg.id ?? null, result: { content: [{ type: "text", text }] } };
          }
          if (name === "dataspecer.get_system_data") {
            const r = await fetch(`${base}/system/data`);
            if (!r.ok) return { jsonrpc: "2.0", id: msg.id ?? null, error: { code: r.status, message: r.statusText } };
            const arrayBuf = await r.arrayBuffer();
            const b64 = Buffer.from(arrayBuf).toString("base64");
            return { jsonrpc: "2.0", id: msg.id ?? null, result: { content: [{ type: "bytes", data: b64, mimeType: "application/zip" }] } };
          }
          if (name === "dataspecer.get_simplified_model") {
            const iri = String(args.iri ?? "");
            const r = await fetch(`${base}/simplified-semantic-model?iri=${encodeURIComponent(iri)}`);
            if (!r.ok) return { jsonrpc: "2.0", id: msg.id ?? null, error: { code: r.status, message: r.statusText } };
            const text = await r.text();
            return { jsonrpc: "2.0", id: msg.id ?? null, result: { content: [{ type: "text", text }] } };
          }
          if (name === "dataspecer.set_simplified_model") {
            const iri = String(args.iri ?? "");
            const modelJson = String(args.modelJson ?? "");
            let parsed: any;
            try {
              parsed = JSON.parse(modelJson);
            } catch (e: any) {
              return { jsonrpc: "2.0", id: msg.id ?? null, error: { code: -32602, message: "modelJson must be valid JSON" } };
            }
            const r = await fetch(`${base}/simplified-semantic-model?iri=${encodeURIComponent(iri)}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(parsed),
            });
            if (!r.ok) return { jsonrpc: "2.0", id: msg.id ?? null, error: { code: r.status, message: r.statusText } };
            return { jsonrpc: "2.0", id: msg.id ?? null, result: { ok: true } };
          }
          if (name === "dataspecer.generate_lightweight_owl") {
            const simplifiedJson = String(args.simplifiedJson ?? "");
            let parsed: any;
            try {
              parsed = JSON.parse(simplifiedJson);
            } catch (e: any) {
              return { jsonrpc: "2.0", id: msg.id ?? null, error: { code: -32602, message: "simplifiedJson must be valid JSON" } };
            }
            const r = await fetch(`${base}/experimental/lightweight-owl-from-simplified.ttl`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(parsed),
            });
            if (!r.ok) return { jsonrpc: "2.0", id: msg.id ?? null, error: { code: r.status, message: r.statusText } };
            const ttl = await r.text();
            return { jsonrpc: "2.0", id: msg.id ?? null, result: { content: [{ type: "text", text: ttl }] } };
          }
          if (name === "dataspecer.generate_lightweight_owl_from_iri") {
            const iri = String(args.iri ?? "");
            // Fetch simplified model first
            const sm = await fetch(`${base}/simplified-semantic-model?iri=${encodeURIComponent(iri)}`);
            if (!sm.ok) return { jsonrpc: "2.0", id: msg.id ?? null, error: { code: sm.status, message: sm.statusText } };
            const simplified = await sm.text();
            let parsed: any;
            try { parsed = JSON.parse(simplified); } catch (e: any) {
              return { jsonrpc: "2.0", id: msg.id ?? null, error: { code: -32603, message: "Invalid simplified model JSON" } };
            }
            const r = await fetch(`${base}/experimental/lightweight-owl-from-simplified.ttl`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(parsed),
            });
            if (!r.ok) return { jsonrpc: "2.0", id: msg.id ?? null, error: { code: r.status, message: r.statusText } };
            const ttl = await r.text();
            return { jsonrpc: "2.0", id: msg.id ?? null, result: { content: [{ type: "text", text: ttl }] } };
          }
          if (name === "dataspecer.generate_app") {
            const iri = String(args.iri ?? "");
            const r = await fetch(`${base}/generate/application?iri=${encodeURIComponent(iri)}`);
            if (!r.ok) return { jsonrpc: "2.0", id: msg.id ?? null, error: { code: r.status, message: r.statusText } };
            const arrayBuf = await r.arrayBuffer();
            const b64 = Buffer.from(arrayBuf).toString("base64");
            return { jsonrpc: "2.0", id: msg.id ?? null, result: { content: [{ type: "bytes", data: b64, mimeType: "application/zip" }] } };
          }
          return { jsonrpc: "2.0", id: msg.id ?? null, error: { code: -32601, message: "Unknown tool" } };
        };
        try {
          if (Array.isArray(body)) {
            const results = await Promise.all(body.map(handleOne));
            return res.json(results);
          }
          const result = await handleOne(body);
          return res.json(result);
        } catch (e: any) {
          console.error("[MCP] fallback message error", e);
          return res.status(500).json({ error: e?.message ?? "internal_error" });
        }
      };
      handleAsync().catch((e) => {
        console.error("[MCP] fallback error", e);
        return res.status(500).json({ error: "internal_error" });
      });
    });
    console.log(`[MCP] Shim enabled at ${options.basePath} (SSE: ${ssePath}, POST: ${msgPath})`);
  })();
}



