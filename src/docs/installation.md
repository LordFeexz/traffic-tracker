# Installation

Traffic Tracker is designed to be installed alongside your database ORM. For the MVP, we support **Drizzle ORM** with Zod for payload validation.

## 1. Install Dependencies

```bash
npm install traffic-tracker zod
```

If you haven't installed Drizzle ORM yet, you will also need:
```bash
npm install drizzle-orm
npm install -D drizzle-kit
```

## 2. Next Steps
Once installed, proceed to the [Server Setup](./server-setup.md) to configure your database schema and initialization.
