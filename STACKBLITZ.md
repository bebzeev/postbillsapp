# Running in Stackblitz

## 🟢 What Works in Stackblitz

- ✅ Full UI and functionality
- ✅ Firebase integration (add/edit/delete items)
- ✅ IndexedDB local storage
- ✅ Offline operation detection
- ✅ Sync queue functionality
- ✅ All drag-and-drop features
- ✅ Image uploads and viewing

## 🟡 What's Limited in Stackblitz

### Service Worker Caching (Disabled)
The PWA service worker is **automatically disabled** in Stackblitz because:
- Stackblitz doesn't support the `virtual:pwa-register` module
- Service workers require HTTPS or localhost
- The preview environment has sandbox limitations

**What this means:**
- Images and fonts won't be cached by the service worker
- The app won't install as a PWA from Stackblitz preview
- Offline functionality relies only on IndexedDB (which still works!)

### Offline Functionality
The app will still detect online/offline status and:
- ✅ Queue operations when offline
- ✅ Store data in IndexedDB
- ✅ Show the red circle indicator when offline
- ✅ Auto-sync when connection returns

**However:**
- ❌ App shell won't be cached (needs page reload when offline)
- ❌ Images from Firebase Storage won't be cached
- ❌ Fonts won't be cached

## 🚀 For Full PWA Features

To test the complete offline functionality with service worker caching:

### Option 1: Deploy to Hosting
```bash
npm run build
# Deploy dist/ folder to:
# - Netlify
# - Vercel
# - Firebase Hosting
# - GitHub Pages
```

### Option 2: Local Development
```bash
npm install
npm run build
npm run preview
```

Then open in a browser and test:
1. Add to home screen (iOS) or install (desktop)
2. Load the app and navigate around
3. Enable airplane mode
4. Close and reopen app
5. Everything should load instantly!

## 🔧 Technical Details

### What's Conditional:
- **vite.config.ts**: PWA plugin only loads when `process.env.STACKBLITZ !== '1'`
- **main.tsx**: Service worker registration wrapped in try-catch with dynamic import
- **App.tsx**: All offline features work regardless of service worker status

### Environment Detection:
The app checks for Stackblitz using:
```typescript
process.env.STACKBLITZ === '1' || process.env.NODE_ENV === 'stackblitz'
```

### Graceful Degradation:
If service worker fails to register:
1. Error is caught and logged: `"PWA features not available in this environment"`
2. App continues to function normally
3. IndexedDB and sync queue still work
4. Only browser-based caching is unavailable

## 📊 Feature Comparison

| Feature | Stackblitz | Production |
|---------|-----------|-----------|
| Core App | ✅ Full | ✅ Full |
| Firebase Sync | ✅ Full | ✅ Full |
| IndexedDB Storage | ✅ Full | ✅ Full |
| Offline Detection | ✅ Full | ✅ Full |
| Sync Queue | ✅ Full | ✅ Full |
| Service Worker | ❌ Disabled | ✅ Full |
| Asset Caching | ❌ None | ✅ Full |
| PWA Install | ❌ No | ✅ Yes |
| Fully Offline | ⚠️ Partial* | ✅ Full |

*Stackblitz can queue changes offline but needs initial page load online

## 💡 Development Tips

1. **Use Stackblitz for**: UI development, Firebase testing, feature work
2. **Use Local/Production for**: PWA testing, offline testing, iOS testing
3. **Console Logs**: Watch for `"PWA features not available"` message in Stackblitz

## 🐛 Troubleshooting

### "Virtual module not found" Error
**Fixed!** The app now gracefully handles missing PWA modules.

### Service Worker Not Registering
**Expected in Stackblitz.** Check console for confirmation message.

### Images Not Caching
**Expected in Stackblitz.** Service worker caching only works in production.

### Offline Mode Not Working
Check if IndexedDB is enabled in your browser. The sync queue works even without service workers.

---

**Bottom Line:** The app works great in Stackblitz for development and testing, but deploy to a real server to test the full PWA offline experience!

