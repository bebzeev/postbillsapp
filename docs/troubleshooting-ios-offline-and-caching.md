# Troubleshooting: iOS Offline Image Caching, Firestore Persistence & CORS

Resolved on branch `feature/case-insensitive-slugs-and-notifications` (PR #3, merged to main).

---

## WKWebView CORS and fetch()

**Problem:** `fetch()` from WKWebView to Firebase Storage URLs is blocked by CORS. Images fail to cache with `{}` errors in the console.

**Root cause:** WKWebView enforces CORS strictly. Firebase Storage URLs don't include CORS headers for arbitrary origins. The Capacitor global fetch patch (`CapacitorHttp: { enabled: true }`) was considered as a fix but introduces worse problems.

**What did NOT work:**

1. **`CapacitorHttp: { enabled: true }`** (global fetch patch) — This patches the global `fetch()` to route through Capacitor's native HTTP layer, bypassing CORS. However, it **breaks Firebase/Firestore SDK** internals which rely on standard `fetch()` behavior. Known bugs include blob handling failures and SDK errors. See [capacitor#6534](https://github.com/ionic-team/capacitor/issues/6534) and [capacitor#6126](https://github.com/ionic-team/capacitor/issues/6126).

2. **Regular `fetch()` for image downloads on native** — CORS blocks these requests in WKWebView.

**What finally worked:**

Use `CapacitorHttp.get()` **direct API** from `@capacitor/core` for specific requests that need to bypass CORS (e.g., image downloads), while leaving `CapacitorHttp: { enabled: false }` in `capacitor.config.json` so Firebase's own `fetch()` remains untouched.

```typescript
import { Capacitor, CapacitorHttp } from '@capacitor/core';

// On native: use CapacitorHttp.get() to bypass CORS
if (Capacitor.isNativePlatform()) {
  const resp = await CapacitorHttp.get({ url: imageUrl, responseType: 'blob' });
  // process response...
} else {
  // On web: use regular fetch()
  const resp = await fetch(imageUrl);
}
```

**Key takeaway:** Never enable the global CapacitorHttp fetch patch. Use the direct API selectively for specific requests that need CORS bypass.

---

## Firestore Offline Persistence

**Problem:** Board data disappears after force-quitting the app. Images and items added while offline are lost on restart.

**Root cause:** `getFirestore(app)` only provides a **memory cache** — all cached data is lost when the app process is terminated.

**What did NOT work:**

1. **`getFirestore(app)`** (default initialization) — Only gives in-memory cache. Data survives tab refreshes but not force-quits.

2. **Saving board to IndexedDB only from Firestore snapshot callbacks** — Locally-added items (not yet synced to Firestore) weren't being saved to IndexedDB because the snapshot callback only fires with server data.

3. **Merging sync queue operations into Firestore snapshots** — Attempted to re-apply queued operations on top of snapshot data. This broke deletion: items that were deleted locally kept coming back because the sync queue would re-insert them.

**What finally worked:**

1. Use `initializeFirestore()` with `persistentLocalCache` for IndexedDB-backed persistence:
```typescript
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});
```

2. **Debounced board save to IndexedDB** on every state change (500ms debounce), not just on Firestore snapshots. This ensures locally-added items survive force-quit even before they sync.

3. **Empty snapshot guard:** When `onSnapshot` fires with 0 items but the board was previously loaded (`dataLoaded === true`), skip the update to prevent overwriting cached data when offline.

4. **Merge strategy for Firestore snapshots:** Instead of replacing the board with snapshot data, merge it — preserve any items in the current in-memory state that have `data:` base64 URLs (locally-added, not yet uploaded to Firebase Storage) and aren't present in the Firestore snapshot.

**Key takeaway:** Use `persistentLocalCache` for Firestore, save board state to IndexedDB on every mutation (not just snapshots), and merge rather than replace when snapshots arrive.

---

## iOS Notification Attachments

**Problem:** Local notifications on iOS don't show image thumbnails. Images appear blank or missing in the notification.

**Root cause:** iOS notification attachments require **local `file://` URIs**. HTTPS URLs and `data:` URIs do not work for notification image attachments on iOS.

**What did NOT work:**

1. **HTTPS URLs** (Firebase Storage URLs) as notification attachment URLs — iOS doesn't download remote images for local notification attachments.

2. **`data:` base64 URIs** as attachment URLs — iOS doesn't accept data URIs for notification attachments.

**What finally worked:**

Use `@capacitor/filesystem` to write the base64 image data to a local cache file, then pass the `file://` URI to the notification:

```typescript
import { Filesystem, Directory } from '@capacitor/filesystem';

// Write base64 to local file
const result = await Filesystem.writeFile({
  path: `notification-images/${itemId}.jpg`,
  data: base64Data, // from IndexedDB image cache
  directory: Directory.Cache,
});

// Use the file URI for the notification attachment
const attachment = { id: itemId, url: result.uri };
```

Using base64 data from the IndexedDB image cache (already in memory from offline caching) avoids network fetch issues entirely.

**Key takeaway:** Always use local `file://` URIs for iOS notification attachments. Use Filesystem plugin to write cached base64 data to a temp file.
