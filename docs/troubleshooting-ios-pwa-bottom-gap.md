# Troubleshooting: iOS PWA Standalone Mode — Bottom Gap Fix

Resolved on branch `fix/ios-pwa-bottom-gap` (PR #4).

---

## Problem

When running as a standalone PWA (Add to Home Screen) on iOS via Safari or Chrome, a visible gap appears at the bottom of the screen. The app's `position: fixed; inset: 0` container doesn't reach the screen bottom. This affects both the main app layout and any full-screen modal overlays (e.g., the slug prompt backdrop shows blue background bleeding through at the bottom).

The gap is approximately 54px on Face ID iPhones — the same height as the status bar / top safe area inset.

---

## Root Cause

The combination of two meta tags causes the issue:

```html
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="viewport" content="viewport-fit=cover" />
```

With `black-translucent`, iOS shifts the entire web content **up** underneath the status bar so the app can render behind it and use the full screen. However, the **viewport height does not grow** to compensate for this upward shift. All viewport-relative measurements — `100vh`, `100dvh`, `window.innerHeight`, and crucially `position: fixed; bottom: 0` — still reference the original (shorter) viewport.

The result: `position: fixed; bottom: 0` reaches the bottom of the *viewport*, which is now shorter than the actual screen by `env(safe-area-inset-top)` pixels.

---

## What Finally Worked

**CSS fix on `<body>`:**
```css
body {
  height: 100%;
  min-height: calc(100% + env(safe-area-inset-top, 0px));
}
```

This extends the document body downward to fill the gap at the bottom. The extra height compensates for the upward shift caused by `black-translucent`. Fixed-position elements then have a viewport that covers the full screen.

**Additionally**, the scroll container was changed from a viewport-unit-based height to flexbox:
```typescript
// Before (broken in PWA mode):
style={{ height: `calc(100dvh - ${headerH}px)` }}

// After (works everywhere):
style={{ flex: 1, minHeight: 0 }}
```

This avoids depending on viewport units (`100dvh`) which are unreliable in iOS standalone PWA mode.

---

## What Did NOT Work (5 Failed Approaches)

### Attempt 1: `paddingBottom: env(safe-area-inset-bottom)` on the root container

**Idea:** Add bottom padding to push content away from the home indicator area.

**Result:** Made the gap **worse**. The `safe-area-inset-bottom` is for the home indicator (~34px), not the status bar shift. Adding it as padding pushed content UP, creating even more empty space at the bottom.

**Why it failed:** The gap is caused by the *top* safe area shift, not the bottom safe area. Using the wrong inset value compounds the problem.

### Attempt 2: CSS `-webkit-fill-available`

```css
html, body, #root {
  height: 100%;
  min-height: 100dvh;
  min-height: -webkit-fill-available;
}
html {
  height: -webkit-fill-available;
}
```

**Result:** Did not fix the gap. In some configurations it conflicted with other height calculations and made layout unpredictable.

**Why it failed:** `-webkit-fill-available` tries to fill the available space, but in iOS standalone PWA mode it still references the same (incorrect) viewport height. It doesn't account for the `black-translucent` shift.

### Attempt 3: JS-driven `--app-height` CSS variable

```typescript
useEffect(() => {
  const setVH = () => {
    document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
  };
  setVH();
  window.addEventListener('resize', setVH);
  window.addEventListener('orientationchange', () => setTimeout(setVH, 100));
  return () => window.removeEventListener('resize', setVH);
}, []);
```

Then used `height: var(--app-height, 100dvh)` on the root container.

**Result:** No improvement. The gap remained identical.

**Why it failed:** `window.innerHeight` already reflects the shortened viewport. It returns the same incorrect value as `100dvh`. The gap exists *below* what JavaScript thinks is the bottom of the viewport, so JS can't measure it.

### Attempt 4: Replace `fixed inset-0` with explicit positioning on all components

Changed every `fixed inset-0` usage (root container + 4 modal components) to:
```
className="fixed top-0 left-0 w-full"
style={{ height: 'var(--app-height, 100dvh)' }}
```

**Result:** Same as Attempt 3 — no improvement.

**Why it failed:** Same underlying issue. The JS-measured height was still wrong, so explicitly setting it on every component just propagated the same incorrect value everywhere. More code churn, same bug.

### Attempt 5: `height: calc(100% + env(safe-area-inset-top))` on the fixed container

Tried adding the safe-area-inset-top compensation directly on the `position: fixed` root container:
```typescript
style={{
  position: 'fixed',
  top: 0, left: 0, right: 0, bottom: 0,
  height: 'calc(100% + env(safe-area-inset-top, 0px))',
}}
```

**Result:** Did not work as intended.

**Why it failed:** Setting `top: 0`, `bottom: 0`, AND `height` on a fixed element creates an over-constrained box. The browser resolves the conflict by ignoring the height. Even removing `bottom: 0` didn't work reliably because `100%` in a fixed context refers to the viewport, which is the wrong size.

---

## Key Takeaway

The fix **must** be applied at the **document level** (`body` min-height), not on the fixed-position elements. The viewport itself is the problem — it's shorter than the screen due to the `black-translucent` status bar shift. The `body` height adjustment tells iOS to extend the renderable area downward to fill the full screen. Fixed-position elements then automatically use the corrected viewport.

**Quick reference for future iOS PWA viewport issues:**
- If `position: fixed; inset: 0` doesn't reach the screen edges, check if `black-translucent` + `viewport-fit=cover` is the cause
- Fix at the `body` level with `min-height: calc(100% + env(safe-area-inset-top, 0px))`
- Avoid relying on `100dvh`, `100vh`, or `window.innerHeight` for layout height in iOS standalone PWA mode — use flexbox (`flex: 1`) instead
