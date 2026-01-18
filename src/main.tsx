import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { StatusBar, Style } from '@capacitor/status-bar'
import { Capacitor } from '@capacitor/core'

// Register service worker for PWA offline functionality
// Made optional for environments like Stackblitz that don't support it
if ('serviceWorker' in navigator && typeof window !== 'undefined') {
  // Dynamically import PWA register to avoid build errors in unsupported environments
  import('virtual:pwa-register')
    .then(({ registerSW }) => {
      registerSW({
        immediate: true,
        onNeedRefresh() {
          console.log('New version available. Refresh to update.');
        },
        onOfflineReady() {
          console.log('App is ready to work offline');
        },
        onRegistered(registration) {
          console.log('Service Worker registered:', registration);
          // Check for updates every hour
          if (registration) {
            setInterval(() => {
              registration.update();
            }, 60 * 60 * 1000);
          }
        },
        onRegisterError(error) {
          console.error('Service Worker registration failed:', error);
        },
      });
    })
    .catch((error) => {
      // Silently fail in environments that don't support PWA (like Stackblitz)
      console.log('PWA features not available in this environment');
    });
}

// Configure status bar for iOS/Android
if (Capacitor.isNativePlatform()) {
  StatusBar.setStyle({ style: Style.Light }).catch(console.error);
  StatusBar.setBackgroundColor({ color: '#0037ae' }).catch(console.error);
  StatusBar.setOverlaysWebView({ overlay: false }).catch(console.error);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
