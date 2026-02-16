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
