import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  serverTimestamp,
  writeBatch,
  onSnapshot,
  collection,
  doc,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import {
  ref as sRef,
  uploadString,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { saveBoard, getBoard, queueOperation, cacheImage, getCachedImages } from './db';
import { processSyncQueue, onSyncStatusChange, type SyncStatus } from './syncQueue';
import { db, storage, firebaseReady } from './constants/firebase';
import { DESIGN, FAVICON_DATA_URL, DAY_MS } from './constants/design';
import { todayAtMidnight, fmtKey, genRange } from './utils/date';
import { fileToDataUrlCompressed } from './utils/file';
import { uid, isTouch as getIsTouch } from './utils/helpers';
import { useColW } from './hooks';
import { scheduleEventNotifications, requestNotificationPermission } from './notifications';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Header, DayColumn, GapSeparator } from './components';
import {
  ImageViewer,
  DeleteConfirm,
  SlugPrompt,
  Help,
  CopyFeedback,
} from './components/modals';
import type {
  Board,
  Viewer,
  ImageItem,
  DeleteConfirmState,
  CopyFeedback as CopyFeedbackType,
  ExternalHover,
} from './types';

export default function PostBills() {
  const [futureShown, setFutureShown] = useState(60);
  const [pastShown, setPastShown] = useState(30);
  const days = useMemo(() => genRange(futureShown, pastShown), [futureShown, pastShown]);
  const todayKey = fmtKey(todayAtMidnight());

  const initialSlug = useMemo(() => {
    const p = window.location.pathname.replace(/^\/+|\/+$/g, '');
    return p && p !== 'index.html' ? p.toLowerCase() : '';
  }, []);

  const hasVisitedBefore = useMemo(() => {
    try {
      const lastSlug = localStorage.getItem('eventi-last-slug');
      return !!lastSlug;
    } catch {
      return false;
    }
  }, []);

  const [slug, setSlug] = useState(() => {
    if (initialSlug) return initialSlug;
    if (hasVisitedBefore) {
      try {
        return localStorage.getItem('eventi-last-slug') || '';
      } catch {
        return '';
      }
    }
    return '';
  });
  const [slugDraft, setSlugDraft] = useState(() => {
    if (initialSlug) return initialSlug;
    if (hasVisitedBefore) {
      try {
        return localStorage.getItem('eventi-last-slug') || '';
      } catch {
        return '';
      }
    }
    return '';
  });
  const [showSlugPrompt, setShowSlugPrompt] = useState(
    !initialSlug && !hasVisitedBefore
  );

  const [board, setBoard] = useState<Board>({});
  const [dataLoaded, setDataLoaded] = useState(false);
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [fileOver, setFileOver] = useState<string | null>(null);
  const [externalHover, setExternalHover] = useState<ExternalHover>({
    dayKey: null,
    index: null,
  });
  const [hideEmpty, setHideEmpty] = useState(false);
  const [showFavOnly, setShowFavOnly] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<CopyFeedbackType>({
    show: false,
    type: '',
    x: 0,
    y: 0,
  });
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncMessage, setSyncMessage] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [expandedDay, setExpandedDay] = useState<{ dayKey: string; level: number } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const lastScrollLeft = useRef<number>(0);
  const columnRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const listRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerH, setHeaderH] = useState(96);
  const anchorRef = useRef<string | null>(null);
  const hasScrolledToToday = useRef(false);
  const [isPositioned, setIsPositioned] = useState(false);

  const isTouch = useMemo(() => getIsTouch(), []);

  // Network status detection
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (firebaseReady && db && storage && slug) {
        processSyncQueue(slug, db, storage).catch(console.error);
      }
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [slug]);

  // Subscribe to sync status updates
  useEffect(() => {
    const unsubscribe = onSyncStatusChange((event) => {
      setSyncStatus(event.status);
      if (event.message) {
        setSyncMessage(event.message);
      }
    });
    return unsubscribe;
  }, []);

  // Load cached board data from IndexedDB on mount
  useEffect(() => {
    if (!slug) return;

    getBoard(slug).then(async (cachedBoard) => {
      if (cachedBoard) {
        // Collect all image IDs and apply cached base64 images
        const allIds: string[] = [];
        for (const dayKey in cachedBoard) {
          for (const item of cachedBoard[dayKey]) {
            allIds.push(item.id);
          }
        }

        // Get cached base64 images
        const cachedImages = await getCachedImages(allIds);

        // Apply cached images to board
        for (const dayKey in cachedBoard) {
          for (const item of cachedBoard[dayKey]) {
            const cached = cachedImages.get(item.id);
            if (cached) {
              item.dataUrl = cached;
            }
          }
        }

        setBoard((prev) => {
          const merged = { ...prev };
          for (const dayKey in cachedBoard) {
            merged[dayKey] = cachedBoard[dayKey];
          }
          return merged;
        });
        setDataLoaded(true);
      }
    }).catch((err) => {
      console.warn('Failed to load cached board:', err);
    });
  }, [slug]);

  useEffect(() => {
    // Load fonts
    const fonts = [
      'https://fonts.googleapis.com/css2?family=Allerta+Stencil&display=swap',
      'https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&display=swap',
      'https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;500;700&display=swap',
    ];
    fonts.forEach((href) => {
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = href;
      document.head.appendChild(l);
    });
    document.title = 'POSTBILLS';
    let link = document.querySelector("link[rel='icon']") as HTMLLinkElement;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.type = 'image/svg+xml';
    link.href = FAVICON_DATA_URL;
  }, []);

  // Request notification permission on first load (iOS only)
  useEffect(() => {
    requestNotificationPermission().catch(() => {});
  }, []);

  useEffect(() => {
    if (slug) {
      try {
        localStorage.setItem('eventi-last-slug', slug);
      } catch {}
    }
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    const u = new URL(window.location.href);
    u.pathname = `/${slug}`;
    u.searchParams.delete('b');
    window.history.replaceState(null, '', u.toString());
  }, [slug]);

  const { populated, empty, isNarrow } = useColW();

  const visibleDays = useMemo(() => {
    const f = (d: Date) => {
      const k = fmtKey(d),
        a = board[k] || [],
        today = k === todayKey,
        future = k >= todayKey;
      return { k, a, today, future };
    };
    if (showFavOnly)
      return days.filter((d) => {
        const { a, today, future } = f(d);
        return future && (today || a.some((x) => x.fav));
      });
    if (!hideEmpty) return days;
    return days.filter((d) => {
      const { a, today, future } = f(d);
      return future && (today || a.length > 0);
    });
  }, [showFavOnly, hideEmpty, days, board, todayKey]);

  useEffect(() => {
    setBoard((p) => {
      const n = { ...p };
      for (const d of days) {
        const k = fmtKey(d);
        if (!n[k]) n[k] = [];
      }
      return n;
    });
  }, [days]);

  useEffect(() => {
    if (!firebaseReady || !slug || !db) return;
    const boardRef = doc(db, 'boards', slug);
    setDoc(
      boardRef,
      { createdAt: serverTimestamp(), public: true, title: slug },
      { merge: true }
    ).catch(() => {});

    const unsub = onSnapshot(
      collection(boardRef, 'items'),
      async (snap) => {
        const by: Board = {};
        const allItems: { id: string; imageURL: string }[] = [];

        snap.forEach((ds) => {
          const it = ds.data();
          (by[it.dayKey] || (by[it.dayKey] = [])).push({
            id: it.id,
            name: it.name,
            dataUrl: it.imageURL,
            imageURL: it.imageURL || '',
            fav: !!it.fav,
            note: it.note || '',
            _order: it.order,
          });
          if (it.imageURL) {
            allItems.push({ id: it.id, imageURL: it.imageURL });
          }
        });

        // If Firestore returns empty but we already have cached data, skip
        // (this happens offline when Firestore has no persistence enabled)
        if (allItems.length === 0 && dataLoaded) {
          console.log('[firestore] empty snapshot ignored — using cached board data');
          return;
        }

        for (const k in by)
          by[k].sort((a, b) => (a._order ?? 0) - (b._order ?? 0));

        // Get cached base64 images
        const imageIds = allItems.map((item) => item.id);
        const cachedImages = await getCachedImages(imageIds);

        // Apply cached images to board data
        for (const dayKey in by) {
          for (const item of by[dayKey]) {
            const cached = cachedImages.get(item.id);
            if (cached) {
              item.dataUrl = cached;
            }
          }
        }

        const newBoard: Board = {};
        const firestoreIds = new Set(allItems.map((item) => item.id));
        for (const d of days) newBoard[fmtKey(d)] = by[fmtKey(d)] || [];

        // Preserve locally-added items that Firestore doesn't know about yet.
        // These are items added offline that haven't been synced.
        // They have dataUrl starting with "data:" (base64) and no imageURL.
        setBoard((prevBoard) => {
          for (const dk in prevBoard) {
            for (const item of prevBoard[dk]) {
              if (!firestoreIds.has(item.id) && item.dataUrl?.startsWith('data:')) {
                if (!newBoard[dk]) newBoard[dk] = [];
                newBoard[dk].push(item);
              }
            }
          }
          return newBoard;
        });
        setDataLoaded(true);

        // Background: fetch and cache images that aren't cached yet
        if (navigator.onLine) {
          const uncachedItems = allItems.filter((item) => !cachedImages.has(item.id));
          if (uncachedItems.length > 0) {
            console.log(`[image-cache] caching ${uncachedItems.length} uncached images`);
          }
          for (const item of uncachedItems) {
            try {
              let dataUrl: string;
              if (Capacitor.isNativePlatform()) {
                // Use native HTTP to bypass WKWebView CORS restrictions
                const resp = await CapacitorHttp.get({
                  url: item.imageURL,
                  responseType: 'blob',
                });
                // CapacitorHttp returns blob responses as base64 string
                const contentType = resp.headers?.['Content-Type'] || resp.headers?.['content-type'] || 'image/jpeg';
                dataUrl = `data:${contentType};base64,${resp.data}`;
              } else {
                // Web: use regular fetch
                const res = await fetch(item.imageURL);
                const blob = await res.blob();
                dataUrl = await new Promise<string>((resolve) => {
                  const reader = new FileReader();
                  reader.onloadend = () => resolve(reader.result as string);
                  reader.readAsDataURL(blob);
                });
              }
              if (dataUrl) {
                await cacheImage(item.id, dataUrl);
                // Update in-memory board state so the image shows immediately
                setBoard((prev) => {
                  const updated = { ...prev };
                  for (const dk in updated) {
                    updated[dk] = updated[dk].map((it) =>
                      it.id === item.id ? { ...it, dataUrl } : it
                    );
                  }
                  return updated;
                });
                console.log(`[image-cache] cached ${item.id}`);
              }
            } catch (err) {
              console.warn(`[image-cache] failed to cache ${item.id}:`, err);
            }
          }
        }
      },
      (err) => console.warn('firestore snapshot error', err)
    );
    return () => unsub();
  }, [slug, days]);

  // Persist board to IndexedDB on every change (debounced)
  // This ensures offline adds, deletes, reorders, etc. survive force-quit
  useEffect(() => {
    if (!slug || !dataLoaded) return;

    const timer = setTimeout(() => {
      saveBoard(slug, board).catch((err) => {
        console.warn('Failed to save board to IndexedDB:', err);
      });
    }, 500);

    return () => clearTimeout(timer);
  }, [board, slug, dataLoaded]);

  // Schedule local notifications for favorited events (iOS only)
  useEffect(() => {
    if (!slug || !dataLoaded) return;

    const timer = setTimeout(() => {
      scheduleEventNotifications(board, slug).catch((err) => {
        console.warn('Failed to schedule notifications:', err);
      });
    }, 2000);

    return () => clearTimeout(timer);
  }, [board, slug, dataLoaded]);

  // Handle notification tap — scroll to the event's day (iOS only)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const listener = LocalNotifications.addListener(
      'localNotificationActionPerformed',
      (action) => {
        const extra = action.notification.extra;
        if (extra?.dayKey) {
          setTimeout(() => scrollTo(extra.dayKey, true), 500);
        }
      },
    );

    return () => {
      listener.then((l) => l.remove());
    };
  }, []);

  // Position scroll to today after columns are rendered and images have loaded
  useEffect(() => {
    if (dataLoaded && !hasScrolledToToday.current) {
      hasScrolledToToday.current = true;

      // Wait for images to load from cache (affects column widths)
      // Then use the same scrollIntoView as the Today button
      const scrollToToday = () => {
        const todayEl = columnRefs.current[todayKey];
        if (todayEl) {
          todayEl.scrollIntoView({
            behavior: 'instant',
            inline: 'center',
            block: 'nearest',
          });
          setIsPositioned(true);
        }
      };

      // Give images time to load from IndexedDB cache before scrolling
      setTimeout(scrollToToday, 300);
    }
  }, [dataLoaded, todayKey]);

  useEffect(() => {
    const u = () => setHeaderH(headerRef.current?.offsetHeight || 96);
    u();
    window.addEventListener('resize', u);
    return () => window.removeEventListener('resize', u);
  }, []);

  useEffect(() => {
    setShowNotes(false);
  }, [viewer?.id]);

  useEffect(() => {
    if (!viewer) return;
    const on = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setViewer(null);
        setShowNotes(false);
      }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [viewer]);

  useEffect(() => {
    const stop = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes('Files')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const clear = () => {
      setFileOver(null);
      setExternalHover({ dayKey: null, index: null });
    };
    const onDrop = (e: DragEvent) => {
      stop(e);
      clear();
    };
    window.addEventListener('dragover', stop);
    window.addEventListener('drop', onDrop);
    window.addEventListener('drop', () => setTimeout(clear, 0));
    window.addEventListener('dragend', clear);
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('dragover', stop);
      window.removeEventListener('drop', onDrop);
      window.removeEventListener('dragend', clear);
      window.removeEventListener('blur', clear);
    };
  }, []);

  useEffect(() => {
    const s = scrollRef.current;
    if (!s) return;
    const h = (e: TouchEvent) => {
      if (isDragging) e.preventDefault();
    };
    s.addEventListener('touchmove', h, { passive: false });
    return () => s.removeEventListener('touchmove', h);
  }, [isDragging]);

  // Detect horizontal scroll to collapse expanded day
  useEffect(() => {
    const s = scrollRef.current;
    if (!s || !expandedDay) return;

    const handleScroll = () => {
      const currentScrollLeft = s.scrollLeft;
      const scrollDelta = Math.abs(currentScrollLeft - lastScrollLeft.current);

      // If scrolled more than 50px, collapse the expanded day
      if (scrollDelta > 50) {
        setExpandedDay(null);
      }

      lastScrollLeft.current = currentScrollLeft;
    };

    s.addEventListener('scroll', handleScroll);
    lastScrollLeft.current = s.scrollLeft;

    return () => s.removeEventListener('scroll', handleScroll);
  }, [expandedDay]);

  const prevFilters = useRef({ hideEmpty, showFavOnly });
  useEffect(() => {
    const was = prevFilters.current;
    if (was.hideEmpty && !hideEmpty) setTimeout(() => scrollTo(todayKey, true), 0);
    if (was.showFavOnly && !showFavOnly)
      setTimeout(() => scrollTo(todayKey, true), 0);
    prevFilters.current = { hideEmpty, showFavOnly };
  }, [hideEmpty, showFavOnly, todayKey]);

  const isPast = (k: string) => k < todayKey;
  const isToday = (k: string) => k === todayKey;

  const scrollTo = (k: string, center = false, instant = false) => {
    const el = columnRefs.current[k];
    el?.scrollIntoView({
      behavior: instant ? 'instant' : 'smooth',
      inline: center ? 'center' : 'start',
      block: 'nearest',
    });
  };

  async function removeImage(dayKey: string, id: string) {
    setBoard((p) => ({
      ...p,
      [dayKey]: (p[dayKey] || []).filter((x) => x.id !== id),
    }));
    setDeleteConfirm(null);

    if (!isOnline) {
      await queueOperation({
        type: 'delete',
        slug,
        timestamp: Date.now(),
        data: { id },
      });
    } else if (firebaseReady && db && storage) {
      try {
        await deleteDoc(doc(db, 'boards', slug, 'items', id));
      } catch {}
      try {
        await deleteObject(sRef(storage, `boards/${slug}/${id}.jpg`));
      } catch {}
    }
  }

  async function updateImageNote(dayKey: string, id: string, note: string) {
    setBoard((p) => {
      const a = Array.from(p[dayKey] || []);
      const i = a.findIndex((x) => x.id === id);
      if (i < 0) return p;
      a[i] = { ...a[i], note };
      return { ...p, [dayKey]: a };
    });

    if (!isOnline) {
      await queueOperation({
        type: 'update',
        slug,
        timestamp: Date.now(),
        data: { id, dayKey, note },
      });
    } else if (firebaseReady && db) {
      try {
        await setDoc(
          doc(db, 'boards', slug, 'items', id),
          { note, dayKey },
          { merge: true }
        );
      } catch (e) {
        console.warn('updateImageNote failed', e);
      }
    }
  }

  async function toggleFav(dayKey: string, id: string, next: boolean) {
    const cur = board[dayKey] || [];
    const arr = cur.map((x) => (x.id === id ? { ...x, fav: next } : x));
    const fav = arr.filter((x) => x.fav);
    const rest = arr.filter((x) => !x.fav);
    const fin = [...fav, ...rest];

    setBoard((p) => {
      return { ...p, [dayKey]: fin };
    });

    if (!isOnline) {
      await queueOperation({
        type: 'toggleFav',
        slug,
        timestamp: Date.now(),
        data: { id, dayKey, fav: next, reorderedItems: fin },
      });
    } else if (firebaseReady && db) {
      try {
        const b = writeBatch(db);
        b.update(doc(db, 'boards', slug, 'items', id), { fav: next, dayKey });
        fin.forEach((it, i) =>
          b.update(doc(db, 'boards', slug, 'items', it.id), {
            order: i,
            dayKey,
          })
        );
        await b.commit();
      } catch (e) {
        console.warn('toggleFav failed', e);
      }
    }
  }

  async function addFilesToDay(dayKey: string, files: FileList, insertIndex: number | null = null) {
    const list = Array.from(files || []).filter((f) =>
      f.type?.startsWith('image/')
    );
    if (!list.length) return;

    const urls = await Promise.all(list.map((f) => fileToDataUrlCompressed(f)));
    const entries: ImageItem[] = list.map((f, i) => ({
      id: uid(),
      name: f.name,
      dataUrl: urls[i],
      fav: false,
      note: '',
    }));

    // Cache images for offline access
    for (const entry of entries) {
      cacheImage(entry.id, entry.dataUrl).catch(() => {});
    }

    const cur = board[dayKey] || [];
    const from =
      insertIndex == null
        ? cur.length
        : Math.max(0, Math.min(insertIndex, cur.length));

    setBoard((p) => {
      const n = Array.from(p[dayKey] || []);
      n.splice(from, 0, ...entries);
      return { ...p, [dayKey]: n };
    });

    if (!isOnline) {
      await queueOperation({
        type: 'add',
        slug,
        timestamp: Date.now(),
        data: { entries, dayKey, startOrder: from },
      });
    } else if (firebaseReady && db && storage) {
      try {
        if (cur.length && from < cur.length) {
          const sh = writeBatch(db);
          for (let i = from; i < cur.length; i++) {
            const it = cur[i];
            sh.update(doc(db, 'boards', slug, 'items', it.id), {
              order: i + entries.length,
              dayKey,
            });
          }
          await sh.commit();
        }
        for (let i = 0; i < entries.length; i++) {
          const e = entries[i];
          const rf = sRef(storage, `boards/${slug}/${e.id}.jpg`);
          await uploadString(rf, e.dataUrl, 'data_url', {
            contentType: 'image/jpeg',
          });
          const imageURL = await getDownloadURL(rf);
          await setDoc(doc(db, 'boards', slug, 'items', e.id), {
            id: e.id,
            name: e.name,
            dayKey,
            order: from + i,
            imageURL,
            fav: false,
            note: '',
            createdAt: serverTimestamp(),
          });
        }
      } catch (err) {
        console.warn('cloud upload failed; local only', err);
      }
    }
  }

  async function copyImageToClipboard(item: ImageItem | Viewer, event?: React.MouseEvent) {
    try {
      // Handle both ImageItem (has dataUrl) and Viewer (has url)
      const dataUrl = 'dataUrl' in item ? item.dataUrl : item.url;
      if (!dataUrl) throw new Error('No image data available');

      try {
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        await navigator.clipboard.write([
          new ClipboardItem({ [blob.type]: blob }),
        ]);

        if (event) {
          const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
          setCopyFeedback({
            show: true,
            type: 'image',
            x: rect.right + 10,
            y: rect.top,
          });
          setTimeout(
            () => setCopyFeedback({ show: false, type: '', x: 0, y: 0 }),
            2000
          );
        }
        return;
      } catch {
        // Fallback: trigger download
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = item.name || 'image.jpg';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        if (event) {
          const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
          setCopyFeedback({
            show: true,
            type: 'image',
            x: rect.right + 10,
            y: rect.top,
          });
          setTimeout(
            () => setCopyFeedback({ show: false, type: '', x: 0, y: 0 }),
            2000
          );
        }
      }
    } catch (err) {
      console.error('Failed to copy/download image:', err);
      alert('Failed to copy image to clipboard');
    }
  }

  async function downloadImage(item: ImageItem | Viewer, event?: React.MouseEvent) {
    try {
      // Handle both ImageItem (has dataUrl) and Viewer (has url)
      const dataUrl = 'dataUrl' in item ? item.dataUrl : item.url;
      if (!dataUrl) throw new Error('No image data available');

      // Create a temporary link and trigger download
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = item.name || 'postbills-image.jpg';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      if (event) {
        const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
        setCopyFeedback({
          show: true,
          type: 'download',
          x: rect.right + 10,
          y: rect.top,
        });
        setTimeout(
          () => setCopyFeedback({ show: false, type: '', x: 0, y: 0 }),
          2000
        );
      }
    } catch (err) {
      console.error('Failed to download image:', err);
      alert('Failed to download image');
    }
  }

  function getImageLink(dayKey: string, id: string) {
    const u = new URL(window.location.href);
    u.searchParams.set('img', `${dayKey}:${id}`);
    return u.toString();
  }

  async function copyImageLink(dayKey: string, id: string, event?: React.MouseEvent) {
    const link = getImageLink(dayKey, id);
    try {
      await navigator.clipboard.writeText(link);
      if (event) {
        const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
        setCopyFeedback({
          show: true,
          type: 'link',
          x: rect.right + 10,
          y: rect.top,
        });
        setTimeout(
          () => setCopyFeedback({ show: false, type: '', x: 0, y: 0 }),
          2000
        );
      }
    } catch {
      window.prompt('Copy this link:', link);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const imgParam = params.get('img');
    if (imgParam) {
      const [dayKey, id] = imgParam.split(':');
      setTimeout(() => {
        const item = board[dayKey]?.find((x) => x.id === id);
        if (item) {
          setViewer({
            url: item.dataUrl,
            name: item.name,
            dayKey,
            id: item.id,
            fav: !!item.fav,
            note: item.note || '',
          });
          scrollTo(dayKey);
        }
      }, 500);
    }
  }, [board]);

  const computeInsert = (e: React.DragEvent, dayKey: string) => {
    let at = (board[dayKey] || []).length;
    const list = listRefs.current[dayKey];
    if (list) {
      const rect = list.getBoundingClientRect();
      const y = e.clientY - rect.top + list.scrollTop;
      const kids = Array.from(list.querySelectorAll('[data-item-id]')) as HTMLElement[];
      const idx = kids.findIndex(
        (ch) => y < ch.offsetTop + ch.offsetHeight / 2
      );
      at = idx === -1 ? kids.length : idx;
    }
    return at;
  };

  function onExtOver(e: React.DragEvent, dayKey: string) {
    if (e.dataTransfer?.types?.includes('Files')) {
      e.preventDefault();
      e.stopPropagation();
      const idx = computeInsert(e, dayKey);
      if (fileOver !== dayKey) setFileOver(dayKey);
      setExternalHover({ dayKey, index: idx });
    }
  }

  function onExtLeave(_: React.DragEvent, dayKey: string) {
    if (fileOver === dayKey) setFileOver(null);
    if (externalHover.dayKey === dayKey)
      setExternalHover({ dayKey: null, index: null });
  }

  async function onExtDrop(e: React.DragEvent, dayKey: string) {
    const clear = () => {
      setFileOver(null);
      setExternalHover({ dayKey: null, index: null });
    };
    const has = e.dataTransfer?.files?.length;
    if (has) {
      e.preventDefault();
      e.stopPropagation();
      const at =
        externalHover.dayKey === dayKey && externalHover.index != null
          ? externalHover.index
          : computeInsert(e, dayKey);
      try {
        await addFilesToDay(dayKey, e.dataTransfer.files, at);
      } finally {
        clear();
      }
    } else clear();
  }

  async function onDragEnd(result: any) {
    setIsDragging(false);
    const { source, destination } = result;
    if (!destination) return;

    const sKey = source.droppableId;
    const dKey = destination.droppableId;
    if (sKey === dKey && source.index === destination.index) return;

    const moved = (board[sKey] || [])[source.index];
    if (!moved) return;

    const sArr = Array.from(board[sKey] || []);
    sArr.splice(source.index, 1);
    const dArr = sKey === dKey ? sArr : Array.from(board[dKey] || []);
    dArr.splice(destination.index, 0, moved);

    setBoard((p) => {
      const n = { ...p };
      n[sKey] = sArr;
      n[dKey] = dArr;
      return n;
    });

    if (!isOnline) {
      await queueOperation({
        type: 'reorder',
        slug,
        timestamp: Date.now(),
        data: {
          sourceKey: sKey,
          destKey: dKey,
          sourceItems: sArr,
          destItems: dArr,
        },
      });
    } else if (firebaseReady && db) {
      const b = writeBatch(db);
      const write = (k: string, arr: ImageItem[]) =>
        arr.forEach((it, idx) =>
          b.update(doc(db, 'boards', slug, 'items', it.id), {
            order: idx,
            dayKey: k,
          })
        );
      if (sKey === dKey) write(dKey, dArr);
      else {
        write(sKey, sArr);
        write(dKey, dArr);
      }
      await b.commit().catch(() => {});
    }
  }

  async function copyShare() {
    const s = (slug || slugDraft || 'demo').trim();
    if (s && slug !== s) setSlug(s);
    const u = new URL(window.location.href);
    u.pathname = `/${s}`;
    u.searchParams.delete('b');
    const text = u.toString();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      window.prompt('copy this link:', text);
    }
  }

  function setExpandLevel(dayKey: string, level: number) {
    if (level === 0) {
      setExpandedDay(null);
    } else {
      setExpandedDay({ dayKey, level });
      // Scroll the expanded column into view
      setTimeout(() => scrollTo(dayKey, true), 100);
    }
  }

  return (
    <div
      className="w-full fixed inset-0 overflow-hidden flex flex-col"
      style={{
        backgroundColor: DESIGN.colors.mainBlue,
        fontFamily: DESIGN.fonts.body,
      }}
    >
      {/* Header */}
      <Header
        isOnline={isOnline}
        syncStatus={syncStatus}
        syncMessage={syncMessage}
        copied={copied}
        showFavOnly={showFavOnly}
        hideEmpty={hideEmpty}
        onShowSlugPrompt={() => setShowSlugPrompt(true)}
        onCopyShare={copyShare}
        onToggleFavOnly={() => setShowFavOnly((v) => !v)}
        onToggleHideEmpty={() => {
          anchorRef.current = null;
          setHideEmpty((v) => !v);
        }}
        onScrollToToday={() => scrollTo(todayKey, true)}
        headerRef={headerRef}
      />

      {/* Calendar area */}
      <DragDropContext
        onDragStart={() => {
          setIsDragging(true);
          setFileOver(null);
          setExternalHover({ dayKey: null, index: null });
          if ('vibrate' in navigator) {
            try {
              navigator.vibrate(10);
            } catch {}
          }
        }}
        onDragEnd={onDragEnd}
      >
        <div
          ref={scrollRef}
          style={{
            height: `calc(100dvh - ${headerH}px)`,
            touchAction: isDragging ? 'none' : 'pan-x',
            overscrollBehaviorX: 'contain',
            overscrollBehaviorY: 'none',
            opacity: isPositioned ? 1 : 0,
          }}
          onTouchMove={(e) => {
            if (isDragging) e.preventDefault();
          }}
          className="overflow-x-auto overflow-y-hidden scrollbar-hide pt-2 pb-2"
        >
          <div
            className="h-full flex items-start gap-[8px] px-2"
          >
            {/* Load past days button */}
            {pastShown < 365 && (
              <div className="h-full flex items-center pl-4">
                <button
                  onClick={() => setPastShown((v) => Math.min(365, v + 30))}
                  className="p-3 rounded-full bg-white text-[#0037ae] shadow-lg hover:bg-white/90"
                  title="load 30 more days in the past"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              </div>
            )}
            {visibleDays.map((d, i) => {
              const key = fmtKey(d);
              const items = board[key] || [];
              const has = items.length > 0;
              const w = has ? populated : empty;

              let sep = null;
              if ((hideEmpty || showFavOnly) && i > 0) {
                const pk = fmtKey(visibleDays[i - 1]);
                const gap = Math.max(
                  0,
                  (+new Date(key) - +new Date(pk)) / DAY_MS - 1
                );
                if (gap >= 1)
                  sep = <GapSeparator thin={isNarrow} key={`${key}-sep`} />;
              }

              return (
                <React.Fragment key={key}>
                  {sep}
                  <DayColumn
                    date={d}
                    dayKey={key}
                    items={items}
                    width={w}
                    isToday={isToday(key)}
                    isPast={isPast(key)}
                    isDragging={isDragging}
                    isTouch={isTouch}
                    fileOver={fileOver}
                    externalHover={externalHover}
                    showFavOnly={showFavOnly}
                    expandLevel={expandedDay?.dayKey === key ? expandedDay.level : 0}
                    onSetExpandLevel={setExpandLevel}
                    onExtOver={onExtOver}
                    onExtLeave={onExtLeave}
                    onExtDrop={onExtDrop}
                    onFilesAdded={addFilesToDay}
                    onViewImage={(item, dayKey) => {
                      setViewer({
                        url: item.dataUrl,
                        name: item.name,
                        dayKey,
                        id: item.id,
                        fav: !!item.fav,
                        note: item.note || '',
                      });
                    }}
                    onDeleteImage={(dayKey, id) => {
                      setDeleteConfirm({ dayKey, id });
                    }}
                    onToggleFav={toggleFav}
                    onCopyImage={copyImageToClipboard}
                    onCopyLink={copyImageLink}
                    columnRef={(el) => {
                      columnRefs.current[key] = el;
                    }}
                    listRef={(el) => {
                      listRefs.current[key] = el;
                    }}
                  />
                </React.Fragment>
              );
            })}
            {futureShown < 365 && (
              <div className="h-full flex items-center pr-4">
                <button
                  onClick={() => setFutureShown((v) => Math.min(365, v + 60))}
                  className="p-3 rounded-full bg-white text-[#0037ae] shadow-lg hover:bg-white/90"
                  title="load 60 more days"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </DragDropContext>

      {/* Image Viewer Modal */}
      {viewer && (
        <ImageViewer
          viewer={viewer}
          showNotes={showNotes}
          isTouch={isTouch}
          onClose={() => {
            setViewer(null);
            setShowNotes(false);
          }}
          onDelete={() => {
            setDeleteConfirm({ dayKey: viewer.dayKey, id: viewer.id });
          }}
          onToggleFav={() => {
            toggleFav(viewer.dayKey, viewer.id, !viewer.fav);
            setViewer((v) => (v ? { ...v, fav: !v.fav } : v));
          }}
          onCopyLink={(e) => copyImageLink(viewer.dayKey, viewer.id, e)}
          onToggleNotes={() => setShowNotes((prev) => !prev)}
          onUpdateNote={(note) => {
            setViewer((v) => (v ? { ...v, note } : v));
            updateImageNote(viewer.dayKey, viewer.id, note);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <DeleteConfirm
          onCancel={() => setDeleteConfirm(null)}
          onConfirm={() => {
            removeImage(deleteConfirm.dayKey, deleteConfirm.id);
            if (
              viewer &&
              viewer.dayKey === deleteConfirm.dayKey &&
              viewer.id === deleteConfirm.id
            ) {
              setViewer(null);
              setShowNotes(false);
            }
          }}
        />
      )}

      {/* Slug Prompt Modal */}
      {showSlugPrompt && (
        <SlugPrompt
          slugDraft={slugDraft}
          isTouch={isTouch}
          onSlugChange={setSlugDraft}
          onContinue={() => {
            if (slugDraft) {
              setSlug(slugDraft);
              setShowSlugPrompt(false);
            }
          }}
          canDismiss={!!slug}
          onDismiss={() => {
            setSlugDraft(slug);
            setShowSlugPrompt(false);
          }}
        />
      )}

      {/* Help Popover */}
      <Help showHelp={showHelp} onToggleHelp={() => setShowHelp((v) => !v)} />

      {/* Copy Feedback Toast */}
      <CopyFeedback copyFeedback={copyFeedback} />
    </div>
  );
}
