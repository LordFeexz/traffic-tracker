# Client Setup

Initialize the tracker on the client to start collecting pageviews and sessions. The tracker handles session batching, visible-time tracking, and scroll-depth automatically.

## SvelteKit Setup

The best place to initialize the tracker in SvelteKit is within your root `+layout.svelte`.

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/stores';
  import { createTracker } from 'traffic-tracker/client';

  const tracker = createTracker({
    site: 'my-project',
    environment: 'production',
    consentMode: 'anonymous' // Switch to 'full' if the user accepts cookies
  });

  onMount(() => {
    // Start listening for pagehide, visibility changes, and scrolling
    tracker.start();
  });

  onDestroy(() => {
    // Clean up listeners
    tracker.stop();
  });

  // Track pageviews automatically on navigation
  $effect(() => {
    if ($page.url.pathname) {
      tracker.page($page.url.pathname, document.title, $page.url.search);
    }
  });
</script>

<slot />
```

## Vanilla JavaScript / SPA Setup

If you are using React, Vue, or Vanilla JS, call `createTracker` on mount and `tracker.page()` whenever your router changes.

```typescript
import { createTracker } from 'traffic-tracker/client';

const tracker = createTracker({ 
  site: 'my-project',
  consentMode: 'full' // Enables cross-session tracking via cookies/localStorage
});

// Start global event listeners
tracker.start();

// Call this on route changes if building an SPA
tracker.page(window.location.pathname, document.title, window.location.search);
```

## Custom Events

You can also track custom interaction events:

```typescript
// Anywhere in your app
tracker.track('button_clicked', { buttonId: 'signup', color: 'blue' });
```
