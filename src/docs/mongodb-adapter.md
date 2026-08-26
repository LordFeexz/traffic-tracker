# MongoDB Adapter

Traffic Tracker supports MongoDB out-of-the-box using the native `mongodb` driver.

## Installation

```bash
npm install mongodb
```

## Setup

Initialize the MongoDB client, connect to it, and pass the `Db` instance to the `mongoAdapter`:

```typescript
import { MongoClient } from 'mongodb';
import { createTrafficTracker } from 'traffic-tracker';
import { mongoAdapter } from 'traffic-tracker/adapters/mongodb';

const client = new MongoClient(process.env.MONGODB_URI!);

// It's recommended to connect before initializing the tracker, or inside your startup logic
await client.connect();
const db = client.db('my_database');

export const traffic = createTrafficTracker({
  database: mongoAdapter(db),
  internalHosts: ['mywebsite.com']
});
```

## Database Schema / Collections

The MongoDB adapter will automatically create the following collections when it inserts the first document (or you can create them manually for indexing):

- `traffic_sessions`
- `traffic_pageviews`
- `traffic_events`

### Recommended Indexes

For optimal query performance on the dashboard, you should apply these indexes in your MongoDB instance:

```javascript
// traffic_sessions
db.traffic_sessions.createIndex({ sessionId: 1 }, { unique: true });
db.traffic_sessions.createIndex({ site: 1, startedAt: -1 });
db.traffic_sessions.createIndex({ site: 1, deviceType: 1, startedAt: -1 });
db.traffic_sessions.createIndex({ site: 1, entryPath: 1, startedAt: -1 });

// traffic_pageviews
db.traffic_pageviews.createIndex({ sessionId: 1, sequence: 1 }, { unique: true });
db.traffic_pageviews.createIndex({ site: 1, startedAt: -1 });
db.traffic_pageviews.createIndex({ site: 1, path: 1, startedAt: -1 });

// traffic_events
db.traffic_events.createIndex({ site: 1, name: 1, occurredAt: -1 });
```

## Usage

Once configured, the MongoDB adapter works identically to the Drizzle adapter. It supports all the same querying and ingestion methods documented in [Querying Data](./querying.md).
