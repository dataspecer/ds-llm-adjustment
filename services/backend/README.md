# backend service

The backend service is a Node.js server and a part of the Dataspecer application that manages data specifications and provides access to stores.

## Installation instructions

1. Clone the whole mono repository. `git clone ...`
2. Create copy of `./main.config.sample.js` as `./main.config.js` and modify the configuration.
3. Run `npm install` from the root of the repository to install and link all packages.
5. Run `npm run build` from root of the repository to build `@dataspecer/core` and other packages. All generated files are in the `./build` directory.
6. Run `npm run update-database` from this directory to create empty database or update the current one if the schema changes.
7. Start the server by `npm run start` from this directory. To keep the server running permanently, use `tmux`, for example.

This project uses [Prisma](https://www.prisma.io/) and SQLite database. After updating the package, you need to migrate the database file if the [schema](prisma/schema.prisma) changes.
- To create the migration after a schema update, use `npx prisma migrate dev --name ...`
- To update development database schema, use `npx prisma migrate dev`.

All data are stored in the `database` directory.

## MCP (Model Context Protocol)

Optional MCP endpoints can be enabled to expose Dataspecer capabilities to MCP clients.

### Enable MCP

Set environment variables or configuration:

- `MCP_ENABLED=1` to enable endpoints
- `MCP_BASE_PATH` to override default base path (defaults to `<apiBasename>/mcp`)
- `MCP_AUTH_SECRET` optional bearer token for auth

When enabled, the backend serves:

- `GET <basePath>/sse` Server-Sent Events stream
- `POST <basePath>/message` JSON-RPC 2.0 message endpoint

A minimal `health` tool is available via `tools/call` with `{ name: "health" }`.

Example curl:

```bash
curl -N -H "Accept: text/event-stream" -H "Authorization: Bearer $MCP_AUTH_SECRET" \
  "$BASE_URL/api/mcp/sse"

curl -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $MCP_AUTH_SECRET" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"health"}}' \
  "$BASE_URL/api/mcp/message"
```

Notes:
- The backend attempts to use the official `@modelcontextprotocol/sdk` with `@modelcontextprotocol/server-http` when available. If not installed, it falls back to a minimal shim so the app still runs. To ensure official SDK is used, keep those packages installed.
