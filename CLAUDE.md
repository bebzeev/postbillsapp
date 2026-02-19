# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
npm run dev      # Start development server (Vite)
npm run build    # Build for production
npm run preview  # Preview production build
```

## Architecture Overview

PostBills is a collaborative event flyer calendar built with React + TypeScript + Vite. It allows users to organize images by date on a horizontally-scrolling kanban-style board.

### Key Technologies
- **React 18** with TypeScript
- **Vite** for build tooling with PWA support (vite-plugin-pwa)
- **Firebase** - Firestore for data, Storage for images
- **Tailwind CSS** for styling
- **@hello-pangea/dnd** for drag-and-drop
- **Capacitor** for iOS native app packaging

### Core Architecture

**Single-Page App (`src/App.tsx`)**: The main component manages all state including board data, UI state (viewer, modals), and sync status. No router is used.

**Slug-Based Access Model**: Boards are accessed via URL slugs (e.g., `/my-board`). No user authentication - anyone with the slug can view/edit. The slug is stored in localStorage as `eventi-last-slug`.

**Offline-First Data Layer**:
- `src/db.ts` - IndexedDB wrapper for local caching and operation queue
- `src/syncQueue.ts` - Processes queued operations when back online
- `src/constants/firebase.ts` - Firebase initialization (Firestore + Storage)

**Data Flow**:
1. On load: Try IndexedDB cache first, then set up Firestore real-time listener
2. On changes: Update local state immediately, sync to Firebase if online, else queue operation
3. On reconnect: Process queued operations via `processSyncQueue()`

### File Structure

```
src/
├── App.tsx              # Main component with all business logic
├── db.ts                # IndexedDB operations
├── syncQueue.ts         # Offline sync queue processor
├── constants/
│   ├── firebase.ts      # Firebase config and initialization
│   └── design.ts        # Design tokens (colors, fonts)
├── components/
│   ├── Header.tsx       # Top navigation with sync status
│   ├── DayColumn.tsx    # Individual day column
│   ├── ImageCard.tsx    # Card within a column
│   └── modals/          # Modal components (SlugPrompt, ImageViewer, etc.)
├── hooks/               # Custom hooks (useColumnWidth)
├── types/               # TypeScript interfaces
└── utils/               # Date formatting, file handling, helpers
```

### Firestore Data Model

```
boards/{slug}
  ├── createdAt, public, title
  └── items/{itemId}
        ├── id, name, dayKey, order
        ├── imageURL, fav, note
        └── createdAt
```

### UI Patterns

- Modal components receive props for state and callbacks
- Tailwind classes used directly in components
- Design tokens in `src/constants/design.ts` (DESIGN.colors, DESIGN.fonts)
- lucide-react for icons, custom SVG icons in `src/icons/`

## iOS / Capacitor Troubleshooting

### WKWebView CORS and fetch()
- `fetch()` from WKWebView to Firebase Storage URLs is blocked by CORS
- **Do NOT use `CapacitorHttp: { enabled: true }`** (global fetch patch) — it breaks Firebase/Firestore SDK and has blob handling bugs (see [#6534](https://github.com/ionic-team/capacitor/issues/6534), [#6126](https://github.com/ionic-team/capacitor/issues/6126))
- **Instead**, use `CapacitorHttp.get()` direct API from `@capacitor/core` for specific requests that need to bypass CORS (e.g., image downloads). This leaves Firebase's own fetch() untouched
- On web, use regular `fetch()` as normal

### Firestore Offline Persistence
- `getFirestore(app)` only gives memory cache — data lost on force-quit
- Must use `initializeFirestore(app, { localCache: persistentLocalCache(...) })` for IndexedDB persistence
- With persistence enabled, `onSnapshot` fires from local cache even offline after force-quit
- Guard against empty snapshots overwriting cached board data when offline

### iOS Notification Attachments
- iOS notification attachments require local `file://` URIs, not HTTPS URLs or `data:` URIs
- Use `@capacitor/filesystem` to write base64 data to a local cache file, then use the file URI
- Base64 data from IndexedDB image cache (already in memory) avoids network fetch issues

### iOS Safe Area / Status Bar
- Set WKWebView and root view background color in `AppDelegate.swift` to match app blue (#0037ae) — prevents white strips in safe area
- Subclass `CAPBridgeViewController` as `LightStatusBarViewController` with `preferredStatusBarStyle = .lightContent` for white status bar text
- Reference the subclass in `Main.storyboard` with `customModule="App"`

### iOS PWA Standalone Mode — Bottom Gap Fix

**Problem:** When running as a standalone PWA (Add to Home Screen) on iOS via Safari or Chrome, a visible gap appears at the bottom of the screen. The app's `position: fixed; inset: 0` container doesn't reach the screen bottom. This affects both the main app layout and any full-screen modal overlays.

**Root cause:** The combination of `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">` and `<meta name="viewport" content="viewport-fit=cover">` causes iOS to shift the entire web content **up** underneath the status bar so the app can render behind it. However, the viewport height (`100vh`, `100dvh`, `window.innerHeight`) does **not** grow to compensate for this upward shift. The result is that `position: fixed; bottom: 0` reaches the bottom of the *viewport*, which is now shorter than the actual screen by approximately `env(safe-area-inset-top)` pixels (~54px on Face ID iPhones).

**What finally worked:**
```css
body {
  min-height: calc(100% + env(safe-area-inset-top, 0px));
}
```
This extends the document body downward to fill the gap at the bottom. Fixed-position elements then have a viewport that covers the full screen. Additionally, the scroll container was changed from `height: calc(100dvh - headerH)` to `flex: 1; minHeight: 0` to avoid depending on viewport units entirely.

**What did NOT work (tried and failed):**

1. **`paddingBottom: env(safe-area-inset-bottom)`** on the root container — Made the gap **worse** by pushing content UP instead of filling the gap. The safe-area-inset-bottom is for the home indicator, not the status bar shift.

2. **CSS `-webkit-fill-available`** on html/body (`min-height: -webkit-fill-available; height: -webkit-fill-available`) — Did not fix the gap and in some cases conflicted with other height calculations.

3. **JS-driven `--app-height` CSS variable** using `window.innerHeight` updated on resize — Did not work because `window.innerHeight` already reflects the shortened viewport, not the actual screen height. The gap exists below what JS thinks is the viewport.

4. **Replacing `fixed inset-0` with `fixed top-0 left-0` + explicit `height: var(--app-height)`** on all components (root + every modal) — Same issue as #3; the JS-measured height is wrong.

5. **`height: calc(100% + env(safe-area-inset-top))` on the fixed container itself** — Conflicts with `bottom: 0` constraint in fixed positioning. Setting both height and top/bottom creates over-constrained positioning.

**Key takeaway:** The fix must be applied at the **document level** (`body` min-height), not on the fixed-position elements. The viewport itself is the problem, and the body height adjustment is what tells iOS to extend the renderable area down to fill the screen.

### Build & Deploy
- After any config or plugin change: `npm run build && npx cap sync ios`
- Always clean build in Xcode after Capacitor changes (Product → Clean Build Folder → Run)
- `npx cap sync ios` copies web assets AND updates native plugin config
