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
          if (name === "dataspecer.get_resource_blob" || name === "dataspecer.get_zip_export" || name === "dataspecer.get_json_schema") {
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



