# Traffic Tracker

An installable, framework-agnostic analytics package with a robust adapter pattern, inspired by better-auth. It gives you full control of your traffic data by storing it directly in your own database.

## Features

- **Adapter Pattern**: Ships with a Drizzle ORM adapter (PostgreSQL, MySQL, SQLite).
- **Framework Agnostic**: Works in any environment (Node, Edge, Serverless). Built-in integrations for **Hono** and **SvelteKit**.
- **Privacy First**: Built-in consent mode (`full` vs `anonymous`). IP hashing and truncation.
- **Client Tracker**: Bundled lightweight browser tracker with automatic batching, session management, and visible-time tracking.
- **Analytics Querying**: Built-in methods to generate aggregates for overview, pages, referrers, and tech breakdowns.

## Documentation

Full documentation is available in the `src/docs/` directory:

1. **[Installation](./src/docs/installation.md)**: Add dependencies to your project.
2. **[Server Setup](./src/docs/server-setup.md)**: Initialize schemas, setup the server instance, and expose the collect endpoint.
3. **[Client Setup](./src/docs/client-setup.md)**: Integrate the bundled browser tracker into SvelteKit or Vanilla JavaScript SPAs.
4. **[Querying Data](./src/docs/querying.md)**: Fetch and aggregate traffic statistics (pageviews, referrers, tech) from your database.
5. **[MongoDB Adapter](./src/docs/mongodb-adapter.md)**: Instructions specifically for users using the native MongoDB adapter.

## Quick Start

```bash
npm install traffic-tracker zod
```

Check out the [Installation](./src/docs/installation.md) guide to get started.