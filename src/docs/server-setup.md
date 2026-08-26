# Server Setup

## 1. Database Schema

Traffic Tracker provides its schema out-of-the-box. Export it in your main `schema.ts` file so Drizzle can generate migrations:

```typescript
// src/lib/server/db/schema.ts
import { trafficSchema } from 'traffic-tracker/schema/pg'; // Or your respective dialect

export const { trafficSessions, trafficPageviews, trafficEvents } = trafficSchema;
```

Run your migration generation and apply it:
```bash
npx drizzle-kit generate
npx drizzle-kit push
```

## 2. Initialize the Server Instance

Create an instance of the tracker in your server codebase.

```typescript
// src/lib/server/traffic.ts
import { createTrafficTracker, drizzleAdapter } from 'traffic-tracker';
import { db } from './db';

// Example: Drizzle ORM
export const traffic = createTrafficTracker({
  database: drizzleAdapter(db, { provider: 'pg' }),
  internalHosts: ['mywebsite.com', 'localhost'],
});
```

*Using MongoDB?* See the [MongoDB Adapter Guide](./mongodb-adapter.md) for initialization instructions.

## 3. Expose the Collect Endpoint

The client tracker sends batched events to an endpoint (default: `/api/traffic/collect`). Use the built-in integrations to set this up quickly.

**SvelteKit** (`src/routes/api/traffic/collect/+server.ts`):
```typescript
import { createSvelteKitTrafficHandler } from 'traffic-tracker/integrations/sveltekit';
import { traffic } from '$lib/server/traffic';

export const POST = createSvelteKitTrafficHandler(traffic);
```

**Hono**:
```typescript
import { createHonoTrafficHandler } from 'traffic-tracker/integrations/hono';
import { traffic } from './traffic';
import { Hono } from 'hono';

const app = new Hono();

app.post('/api/traffic/collect', createHonoTrafficHandler(traffic));
```

## Next Steps
With the server running, proceed to the [Client Setup](./client-setup.md) to start tracking users.
