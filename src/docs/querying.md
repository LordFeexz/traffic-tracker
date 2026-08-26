# Querying Data

The `traffic` server instance provides a `query` service to fetch analytical aggregates from your database. Results are automatically cached in-memory (using LRU) for fast retrieval.

## Example Usage

```typescript
import { traffic } from '$lib/server/traffic';

// 1. Get overview totals and timeseries for the last 7 days
const stats = await traffic.query.overview({
  site: 'my-project',
  range: '7d'
});

console.log('Total Pageviews:', stats.totals.pageviews);
console.log('Total Sessions:', stats.totals.sessions);
console.log('Bounce Rate:', (stats.totals.bounceRate * 100).toFixed(2) + '%');


// 2. Get top performing pages
const topPages = await traffic.query.pages({
  site: 'my-project',
  range: '30d',
  limit: 10
});

topPages.forEach(page => {
  console.log(`${page.path}: ${page.pageviews} views, avg dwell: ${page.avgTimeOnPageMs}ms`);
});


// 3. Get referrers (traffic sources)
const referrers = await traffic.query.referrers({
  site: 'my-project',
  range: '7d',
  limit: 10
});

console.log('Top referrers by type:', referrers.byType); // e.g. [{ name: 'search', count: 50 }]
console.log('Top referrers by host:', referrers.byHost); // e.g. [{ name: 'google.com', count: 40 }]


// 4. Get device/browser stats
const tech = await traffic.query.tech({
  site: 'my-project',
  range: '7d'
});

console.log('Device Breakdown:', tech.devices); // e.g. [{ name: 'mobile', count: 35 }, { name: 'desktop', count: 15 }]
```

## Supported Ranges
The `range` parameter accepts the following values out-of-the-box:
- `'today'`
- `'24h'`
- `'7d'`
- `'30d'`
- `'90d'`

You can also pass explicit `from` and `to` ISO strings.
