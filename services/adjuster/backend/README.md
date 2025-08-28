### LLM Adjuster Backend

NestJS monorepo providing the backend for the Dataspecer Validation & Adjustment workflow. It exposes HTTP APIs and RabbitMQ microservices to:

- Detect schema changes between API versions
- Generate change suggestions and rationales
- Orchestrate maintainer workflows (review, accept/reject, share)
- Provide LLM-powered chat for change analysis
- Integrate with Dataspecer (PSM export, ZIP export)

### Architecture

This monorepo contains four applications and a shared library:

- dialogs-handler (HTTP + RMQ): Orchestrates maintainer workflows and provides the LLM chat API. Uses Postgres via Prisma.
- changes-detector (HTTP + RMQ): Detects changes from raw schemas, from IRIs via Data Specification Validator, and hybrid modes.
- changes-suggester (HTTP + RMQ): Generates suggestions/rationales based on detected changes and PSM.
- dataspecer-adapter (HTTP + RMQ): Adapter for Dataspecer backend (ZIP export, PSM fetch).
- libs/common: Shared DTOs for requests/responses.

All HTTP apps use a global prefix `api`.

### Services and Ports

- dialogs-handler: 3100 (configurable via `PORT`)
- changes-detector: 3101
- changes-suggester: 3102
- dataspecer-adapter: 3000 (exposed as 3104 in Docker)
- Postgres: 5432 (Docker)
- RabbitMQ: 5672 (AMQP), 15672 (management UI)

See `services/adjuster/docker-compose.yml` for end‑to‑end topology and port mappings.

### Environment Variables

Required/commonly used across apps:

- RABBITMQ_URL: amqp://user:pass@host:5672
- CORS_ORIGIN: Allowed origin (default `http://localhost:3001`)
- OPENAI_API_KEY: Required for LLM chat and suggestion generation

Per service:

- dialogs-handler: PORT (default 3100), DATABASE_URL=postgresql://adjuster:adjuster123@postgres:5432/adjuster
- changes-detector: DATASPECER_BACKEND_URL (e.g. http://dataspecer:80) for DSV JSON Schema fetch via DSV
- dataspecer-adapter: PORT (defaults to 3000 if unset)

For detailed LLM settings, see `LLM_CHAT_SETUP.md`.

### Quick Start (Docker, full stack)

1. Create `services/adjuster/.env` with:

```bash
OPENAI_API_KEY=your_openai_api_key
```

2. From `services/adjuster`, run:

```bash
docker compose up -d --build
```

Services will start on:

- Frontend: http://localhost:3001
- Dataspecer: http://localhost:3002
- Dialogs Handler API: http://localhost:3100/api
- Changes Detector API: http://localhost:3101/api
- Changes Suggester API: http://localhost:3102/api
- Dataspecer Adapter API: http://localhost:3104
- RabbitMQ UI: http://localhost:15672 (guest/guest)

### Local Development (single service)

1. Install dependencies:

```bash
npm install
```

2. Start Postgres and RabbitMQ (use the top-level compose for convenience):

```bash
cd ../
docker compose up -d postgres rabbitmq
```

3. Start any app in watch mode from `services/adjuster/backend`:

```bash
# dialogs-handler
npm run start:dev dialogs-handler

# changes-detector
npm run start:dev changes-detector

# changes-suggester
npm run start:dev changes-suggester

# dataspecer-adapter
npm run start:dev dataspecer-adapter
```

### Database (Prisma)

The dialogs-handler uses Postgres via Prisma. Schema is in `prisma/schema.prisma`.

Initialize/sync schema locally:

```bash
# Push schema to DB (no migrations folder required)
npx prisma db push

# Generate Prisma client (optional; usually auto-generated)
npx prisma generate
```

Ensure `DATABASE_URL` is set and Postgres is running.

### Messaging (RabbitMQ)

Each service also runs as an RMQ microservice on its own queue:

- dialogs-handler: queue `dialogs_handler_queue`
- changes-detector: queue `changes_detector_queue`
- changes-suggester: queue `changes_suggester_queue`
- dataspecer-adapter: queue `dataspecer_adapter_queue`

Message patterns (publish `@MessagePattern`):

- detect.changes → changes-detector
- generate.suggestions → changes-suggester
- get.dataspecer.zip, get.psm → dataspecer-adapter

Events emitted:

- changes.detected, suggestions.generated, dataspecer.zip.exported

### HTTP API

All routes are prefixed with `/api`.

dialogs-handler (http://localhost:3100/api):

- GET /specifications → List mock specifications
- GET /specifications/:id → Get specification
- POST /specifications/analyses → Analyze new schema against a specification
- POST /specifications/changes/apply → Apply accepted changes
- POST /specifications/reports → Export developer report
- POST /specifications/validation-links → Generate validation token+URL
- GET /specifications/validation?token=... → Validate with token
- POST /specifications/analyses/share → Store analysis for sharing
- GET /specifications/analyses/:analysisId → Retrieve shared analysis
- GET /specifications/psm?iri=... → Fetch PSM content by IRI

LLM Chat (dialogs-handler):

- POST /specifications/chats → Start chat about changes
- POST /specifications/chats/message → Send message
- GET /specifications/chats/:conversationId → Get conversation
- POST /specifications/chats/by-changes → Conversations for specific change IDs
- POST /specifications/chats/:conversationId/delete → Delete conversation
- POST /specifications/changes/regenerate-description → Regenerate change description
- POST /specifications/:id/developer-reupload-prompt → Generate developer re-upload prompt and validation link

changes-detector (http://localhost:3101/api):

- POST /changes/detections/raw → Detect from two raw APIs
- POST /changes/detections/from-iri → Detect using PSM/Data Specification IRIs
- POST /changes/detections/hybrid → Detect with PSM IRI and old/new JSON Schemas
- POST /changes/detections/automatic → Automatic detection from IRIs and new schema
- GET /changes/schemas/dsv?dataSpecificationIri=... → Fetch JSON Schema via Data Specification Validator

changes-suggester (http://localhost:3102/api):

- POST /suggestions → Generate suggestions for a set of detected changes

dataspecer-adapter (http://localhost:3104):

- GET / → Health/hello endpoint (main integration is via RMQ patterns `get.dataspecer.zip`, `get.psm`)

Minimal curl examples:

```bash
curl -X POST http://localhost:3101/api/changes/detections/raw \
  -H 'Content-Type: application/json' \
  -d '{
    "dialogId":"dlg-1",
    "oldApi":"{\\"title\\":\\"Old\\"}",
    "newApi":"{\\"title\\":\\"New\\"}",
    "artifactFormat":"json-schema"
  }'

curl -X POST http://localhost:3102/api/suggestions \
  -H 'Content-Type: application/json' \
  -d '{
    "dialogId":"dlg-1",
    "psm":"...",
    "changes":[{"changeId":"c1","type":["addition"],"path":"/a","description":"...","isAcceptable":true}]
  }'

curl -X POST http://localhost:3100/api/specifications/chats \
  -H 'Content-Type: application/json' \
  -d '{
    "message":"What are the risks?",
    "changeIds":["c1","c2"],
    "context":{ "specificationId":"spec-1" }
  }'
```

### CORS

All services enable CORS with `CORS_ORIGIN` (defaults to `http://localhost:3001`). Update as needed in deployments.

### LLM Setup

Configure `OPENAI_API_KEY` and see `LLM_CHAT_SETUP.md` for model configuration, features, and troubleshooting.

### Troubleshooting

- 401/LLM errors: set `OPENAI_API_KEY` and ensure credits.
- Cannot connect to RMQ: verify `RABBITMQ_URL` and that RabbitMQ is up (http://localhost:15672).
- Postgres connection errors: verify `DATABASE_URL`, that Postgres is running, and run `npx prisma db push`.
- CORS: set `CORS_ORIGIN` to your frontend URL.

### Scripts

Common scripts (run from `services/adjuster/backend`):

```bash
npm run start:dev <app>   # dialogs-handler | changes-detector | changes-suggester | dataspecer-adapter
npm run build             # build all apps
npm run lint              # lint all packages
npm run test              # unit tests
```

