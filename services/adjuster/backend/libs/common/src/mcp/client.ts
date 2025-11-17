export interface McpClientOptions {
  baseUrl: string; // e.g. http://dataspecer/api/mcp
  authToken?: string;
}

export class McpHttpClient {
  private readonly baseUrl: string;
  private readonly authToken?: string;
  private idCounter = 1;

  public constructor(options: McpClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.authToken = options.authToken;
  }

  public async callTool<T = any>(name: string, params: any): Promise<T> {
    const id = this.idCounter++;
    const body = {
      jsonrpc: "2.0",
      id,
      method: "tools/call",
      params: { name, arguments: params },
    };
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.authToken) {
      headers["Authorization"] = `Bearer ${this.authToken}`;
    }
    const resp = await fetch(`${this.baseUrl}/message`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      throw new Error(`MCP HTTP ${resp.status} ${resp.statusText}`);
    }
    const json = await resp.json();
    if (Array.isArray(json)) {
      throw new Error("Batch response not supported");
    }
    if (json.error) {
      throw new Error(json.error?.message || "MCP error");
    }
    const result = json.result as any;
    return result;
  }
}


