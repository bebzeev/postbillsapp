# Offline PWA Implementation Summary

## Overview
This document outlines the offline functionality implementation for the POSTBILLS app, enabling full offline operation on iOS and other platforms.

## What Was Implemented

### 1. PWA Configuration
- **File**: `vite.config.ts`
- Added `vite-plugin-pwa` with Workbox for service worker generation
- Configured caching strategies:
  - Precache: All app assets (JS, CSS, HTML, images)
  - Runtime cache: Google Fonts, Firebase Storage images
  - Cache-first strategy for optimal offline performance

### 2. Web App Manifest
- **File**: `public/manifest.json`
- Updated with proper PWA metadata
- Theme color: `#0037ae` (app blue)
- Standalone display mode for iOS
- Complete icon set for all devices

### 3. iOS PWA Support
- **File**: `index.html`
- Added iOS-specific meta tags
- Configured for full-screen standalone mode
- Added apple-touch-icon references
- Proper viewport configuration for iOS

### 4. IndexedDB Storage Layer
- **File**: `src/db.ts`
- Local database for board data persistence
- Stores complete board state with images (as data URLs)
- Sync queue for offline operations
- Functions:
  - `saveBoard()` - Cache board data locally
  - `getBoard()` - Retrieve cached board
  - `queueOperation()` - Queue Firebase operations when offline
  - `getQueuedOperations()` - Retrieve pending operations
  - `removeQueuedOperation()` - Clear synced operations

### 5. Sync Queue Manager
- **File**: `src/syncQueue.ts`
- Processes queued operations when connection restored
- Handles all operation types:
  - Add images
  - Delete images
  - Update notes
  - Toggle favorites
  - Reorder (drag & drop)
- Retry logic (max 3 retries)
- Event-based status updates

### 6. Network Status Detection
- **File**: `src/App.tsx`
- Online/offline event listeners
- Subtle status indicator in navigation bar:
  - **Red circle**: Offline (pulsing)
  - **Yellow circle**: Syncing (pulsing)
  - **Green circle**: Sync successful
  - **Red circle**: Sync error
- Auto-sync when connection restored

### 7. Offline Data Integration
- **File**: `src/App.tsx`
- Modified all Firebase operations to work offline:
  - `addFilesToDay()` - Queue when offline
  - `removeImage()` - Queue deletion
  - `updateImageNote()` - Queue note updates
  - `toggleFav()` - Queue favorite changes
  - `onDragEnd()` - Queue reorder operations
- Load cached data on mount (instant display)
- Save Firebase snapshots to IndexedDB

### 8. Service Worker Registration
- **File**: `src/main.tsx`
- Auto-register service worker
- Update checks every hour
- Lifecycle event handling

## Dependencies Added

```json
{
  "dependencies": {
    "workbox-window": "^7.0.0"
  },
  "devDependencies": {
    "vite-plugin-pwa": "^0.20.0"
  }
}
```

## Installation Instructions

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the app:
   ```bash
   npm run build
   ```

3. Deploy to your hosting service (the service worker only works in production or HTTPS)

## Testing on iOS

1. Open Safari on iOS device
2. Navigate to your deployed app
3. Tap the Share button
4. Select "Add to Home Screen"
5. Open app from home screen
6. Load a board (images will cache)
7. Enable Airplane Mode
8. Close app completely
9. Reopen from home screen - app loads instantly with cached data
10. Add/edit/delete items while offline
11. Disable Airplane Mode
12. Changes automatically sync to Firebase

## How It Works

### First Visit (Online)
1. Service worker installs and caches app shell
2. User loads a board
3. Board data saved to IndexedDB
4. Images cached by service worker

### Subsequent Visits (Offline)
1. Service worker serves cached app shell (instant load)
2. App loads board data from IndexedDB
3. User can view all cached content
4. User can make changes (add/edit/delete)
5. Operations queued in IndexedDB

### When Connection Restored
1. Network status changes to online
2. Sync queue automatically processes
3. All queued operations sent to Firebase in order
4. Successful operations removed from queue
5. Failed operations retry (max 3 times)
6. Status indicator shows sync progress

## Technical Details

### Caching Strategy
- **App Shell**: Precached (index.html, JS, CSS)
- **Fonts**: Cache-first, 1 year expiration
- **Firebase Images**: Cache-first, 30 days expiration, max 500 images
- **User-Added Images**: Stored as data URLs in IndexedDB

### Storage Limits
- **IndexedDB**: ~50-100MB on iOS Safari (varies by device)
- **Service Worker Cache**: ~50MB recommended
- Images compressed to 1400px width at 88% JPEG quality

### Sync Queue Behavior
- Operations stored with timestamps
- Processed in FIFO order
- Retry with exponential backoff
- Manual retry available for failed operations

## Known Limitations

1. **iOS Background Sync**: Limited support for background sync when app closed
2. **Storage Quotas**: May fill up with many images
3. **Conflict Resolution**: Last write wins (no advanced merge logic)
4. **Network Detection**: Relies on browser navigator.onLine (not always accurate)

## Future Enhancements

1. Manual sync button for debugging
2. Storage usage indicator
3. Selective cache clearing
4. Conflict resolution UI
5. Background sync registration (when iOS supports it)
6. Push notifications for sync completion

