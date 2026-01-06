import type { Request, Response } from "express";
import crypto from "crypto";

export interface McpServerOptions {
  basePath: string;
  authSecret?: string;
}

export function registerMcpHandlers(app: any, options: McpServerOptions) {
  const ssePath = options.basePath + "/sse";
  const msgPath = options.basePath + "/message";

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

  (async () => {
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
      const processOne = (msg: any) => {
        if (!msg || msg.jsonrpc !== "2.0") {
          return { jsonrpc: "2.0", id: msg?.id ?? null, error: { code: -32600, message: "Invalid Request" } };
        }
        if (msg.method === "tools/call") {
          const name = msg?.params?.name as string | undefined;
          if (name === "health") {
            return { jsonrpc: "2.0", id: msg.id ?? null, result: { status: "ok" } };
          }
          return { jsonrpc: "2.0", id: msg.id ?? null, error: { code: -32601, message: "Unknown tool" } };
        }
        if (msg.method === "ping") {
          return { jsonrpc: "2.0", id: msg.id ?? null, result: { pong: true } };
        }
        return { jsonrpc: "2.0", id: msg.id ?? null, error: { code: -32601, message: "Method not found" } };
      };
      try {
        if (Array.isArray(body)) return res.json(body.map(processOne));
        return res.json(processOne(body));
      } catch (e: any) {
        console.error("[MCP] fallback message error", e);
        return res.status(500).json({ error: e?.message ?? "internal_error" });
      }
    });
    console.log(`[MCP] Fallback shim enabled at ${options.basePath} (SSE: ${ssePath}, POST: ${msgPath})`);
  })();
}

