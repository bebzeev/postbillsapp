import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  HelpCircle,
  Star,
  ChevronRight,
  Trash2,
  Copy,
  Link2,
  FileText,
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  serverTimestamp,
  writeBatch,
  onSnapshot,
  collection,
  doc,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import {
  getStorage,
  ref as sRef,
  uploadString,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { saveBoard, getBoard, queueOperation } from './db';
import { processSyncQueue, onSyncStatusChange, type SyncStatus } from './syncQueue';

// ========== DESIGN SYSTEM - POSTBILLS ==========
const DESIGN = {
  colors: {
    mainBlue: '#0037ae',
    white: '#ffffff',
  },
  fonts: {
    logo: "'Allerta Stencil', sans-serif",
    heading: "'Andale Mono', monospace",
    body: "'DM Mono', monospace",
    nav: "'Roboto Mono', monospace",
  },
};
// ========== END DESIGN SYSTEM ==========

const DAY_MS = 86400000;
const todayAtMidnight = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};
const fmtKey = (d: Date) => d.toISOString().slice(0, 10);
const fmtMD = (d: Date) =>
  `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(
    2,
    '0'
  )}`;
const fmtDOW = (d: Date) => d.toLocaleDateString(undefined, { weekday: 'long' });
const fmtDOWShort = (d: Date) =>
  (d.toLocaleDateString('en-US', { weekday: 'short' }) || '').slice(0, 3).toUpperCase();
const uid = () => `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
const genRange = (future: number) => {
  const s = new Date(todayAtMidnight().getTime() - 30 * DAY_MS),
    e = new Date(todayAtMidnight().getTime() + future * DAY_MS),
    a: Date[] = [];
  for (let t = s.getTime(); t <= e.getTime(); t += DAY_MS) a.push(new Date(t));
  return a;
};

const FAVICON_DATA_URL =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?><svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='14' fill='#0037ae'/><rect x='16' y='20' width='32' height='28' rx='5' fill='#fff'/><rect x='16' y='20' width='32' height='8' rx='5' fill='#e0e7ff'/><circle cx='24' cy='14' r='4' fill='#fff'/><circle cx='40' cy='14' r='4' fill='#fff'/></svg>"
  );

async function fileToDataUrlCompressed(file: File, maxWidth = 1400) {
  const dataUrl = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  return await new Promise<string>((res) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, maxWidth / img.width),
        w = Math.round(img.width * s),
        h = Math.round(img.height * s);
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      c.getContext('2d')!.drawImage(img, 0, 0, w, h);
      res(c.toDataURL('image/jpeg', 0.88));
    };
    img.onerror = () => res(dataUrl);
    img.src = dataUrl;
  });
}

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyB9wuCSs7WVwjpBNsEigAIHYsciZo0wFYc',
  authDomain: 'eventi-72011.firebaseapp.com',
  projectId: 'eventi-72011',
  storageBucket: 'eventi-72011.firebasestorage.app',
  messagingSenderId: '1080772011295',
  appId: '1:1080772011295:web:6341c33fd257799ada7c2a',
};

let app: ReturnType<typeof initializeApp> | undefined,
  db: ReturnType<typeof getFirestore> | undefined,
  storage: ReturnType<typeof getStorage> | undefined,
  firebaseReady = false;
try {
  app = initializeApp(FIREBASE_CONFIG);
  db = getFirestore(app);
  storage = getStorage(app, `gs://${FIREBASE_CONFIG.storageBucket}`);
  firebaseReady = true;
} catch {
  console.warn('firebase not initialized (ok for local)');
}

function useColW() {
  const [w, setW] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );
  useEffect(() => {
    const on = () => setW(window.innerWidth || 1024);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  // Figma shows populated columns at 166px and empty at 117px
  let populated = 166;
  if (w < 640) populated = Math.round(w * 0.42);
  else if (w < 1024) populated = 166;
  else populated = 180;
  const empty = Math.max(Math.round(populated * 0.7), 100);
  return { populated, empty, isNarrow: w < 640 };
}

// SVG Icons matching Figma design
const LinkRotatedIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="rotate-[-45deg]">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const StarIcon = ({ filled = false }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);

const FilterIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
  </svg>
);

const PlusIcon = () => (
  <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
    <rect x="7" y="0" width="3" height="17" fill="white"/>
    <rect x="0" y="7" width="17" height="3" fill="white"/>
  </svg>
);

interface ImageItem {
  id: string;
  name: string;
  dataUrl: string;
  fav: boolean;
  note: string;
  _order?: number;
}

interface Board {
  [key: string]: ImageItem[];
}

interface Viewer {
  url: string;
  name: string;
  dayKey: string;
  id: string;
  fav: boolean;
  note: string;
}

export default function PostBills() {
  const [futureShown, setFutureShown] = useState(60);
  const days = useMemo(() => genRange(futureShown), [futureShown]);
  const todayKey = fmtKey(todayAtMidnight());

  const initialSlug = useMemo(() => {
    const p = window.location.pathname.replace(/^\/+|\/+$/g, '');
    return p && p !== 'index.html' ? p : '';
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
  const [externalHover, setExternalHover] = useState<{
    dayKey: string | null;
    index: number | null;
  }>({
    dayKey: null,
    index: null,
  });
  const [hideEmpty, setHideEmpty] = useState(false);
  const [showFavOnly, setShowFavOnly] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    dayKey: string;
    id: string;
  } | null>(null);
  const [copyFeedback, setCopyFeedback] = useState({
    show: false,
    type: '',
    x: 0,
    y: 0,
  });
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncMessage, setSyncMessage] = useState<string>('');

  const scrollRef = useRef<HTMLDivElement>(null);
  const columnRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const listRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerH, setHeaderH] = useState(96);
  const anchorRef = useRef<string | null>(null);
  const hasScrolledToToday = useRef(false);

  const isTouch = useMemo(
    () =>
      typeof window !== 'undefined' &&
      (window.matchMedia
        ? window.matchMedia('(pointer: coarse)').matches
        : 'ontouchstart' in window),
    []
  );

  // Network status detection
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Process sync queue when coming back online
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
    
    getBoard(slug).then((cachedBoard) => {
      if (cachedBoard) {
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
      (snap) => {
        const by: Board = {};
        snap.forEach((ds) => {
          const it = ds.data();
          (by[it.dayKey] || (by[it.dayKey] = [])).push({
            id: it.id,
            name: it.name,
            dataUrl: it.imageURL,
            fav: !!it.fav,
            note: it.note || '',
            _order: it.order,
          });
        });
        for (const k in by)
          by[k].sort((a, b) => (a._order ?? 0) - (b._order ?? 0));
        
        const newBoard: Board = {};
        for (const d of days) newBoard[fmtKey(d)] = by[fmtKey(d)] || [];
        
        setBoard(newBoard);
        
        // Save to IndexedDB for offline access
        saveBoard(slug, newBoard).catch((err) => {
          console.warn('Failed to save board to IndexedDB:', err);
        });
        
        // Mark data as loaded after first snapshot
        setDataLoaded(true);
      },
      (err) => console.warn('firestore snapshot error', err)
    );
    return () => unsub();
  }, [slug, days]);

  // Scroll to today after data has loaded - use same method as Today button
  useEffect(() => {
    if (dataLoaded && !hasScrolledToToday.current) {
      hasScrolledToToday.current = true;
      // Use setTimeout to ensure columns have rendered with their final widths
      setTimeout(() => {
        scrollTo(todayKey, true);
      }, 100);
    }
  }, [dataLoaded, todayKey]);

  useEffect(() => {
    const u = () => setHeaderH(headerRef.current?.offsetHeight || 96);
    u();
    window.addEventListener('resize', u);
    return () => window.removeEventListener('resize', u);
  }, []);

  useEffect(() => {
    // Reset notes visibility when viewer changes
    setShowNotes(false);
  }, [viewer]);

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
      // Queue operation for later sync
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
      // Queue operation for later sync
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
      // Queue operation for later sync
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
      // Queue operation for later sync
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
      const dataUrl = item.dataUrl || (item as Viewer).url;
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
      // Queue operation for later sync
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

  const GapSeparator = ({ thin = false }: { thin?: boolean }) => (
    <div
      className={`${thin ? 'mx-2' : 'mx-4'} h-full flex items-center`}
      aria-hidden
    >
      <div
        className={`${thin ? 'w-[2px]' : 'w-[3px]'} bg-white/30`}
        style={{ height: '80%' }}
      />
    </div>
  );

  const Placeholder = ({ onDropBlock, onDragOverBlock }: { onDropBlock: (e: React.DragEvent) => void; onDragOverBlock: (e: React.DragEvent) => void }) => (
    <div
      className="relative z-20 h-10 rounded-[5px] border-2 border-dashed border-white/60 bg-white/10"
      aria-label="Drop position"
      onDragOver={onDragOverBlock}
      onDrop={onDropBlock}
      onDragEnter={onDragOverBlock}
    />
  );

  const [copied, setCopied] = useState(false);
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

  return (
    <div
      className="w-full fixed inset-0 overflow-hidden flex flex-col"
      style={{ 
        backgroundColor: DESIGN.colors.mainBlue,
        fontFamily: DESIGN.fonts.body,
      }}
    >
      {/* Header */}
      <div
        ref={headerRef}
        className="shrink-0 border-b border-white/20"
        style={{ boxShadow: '0px 4px 4px 0px rgba(0,0,0,0.25)' }}
      >
        <div className="w-full px-[10px] pt-[10px] pb-[20px] flex items-center gap-[15px]">
          {/* Logo */}
          <button
            onClick={() => setShowSlugPrompt(true)}
            className="flex items-center focus:outline-none shrink-0"
            title="set board name"
          >
            <div
              className="text-white leading-[38px] tracking-[-3px]"
              style={{ 
                fontFamily: DESIGN.fonts.logo,
                fontSize: '50px',
              }}
            >
              <div>POST</div>
              <div>BILLS</div>
            </div>
          </button>

          {/* Navigation */}
          <div className="flex-1 flex items-center justify-end gap-[10px]">
            {/* Link button */}
            <button
              onClick={copyShare}
              className="w-[38px] h-[38px] rounded-[6.624px] border-[1.25px] border-white flex items-center justify-center text-white hover:bg-white/10 transition-colors"
              title="copy link"
              aria-label="copy link"
            >
              <LinkRotatedIcon />
            </button>
            {copied && <span className="text-xs text-white/80">copied ✓</span>}

            {/* Star/Favorites button */}
            <button
              onClick={() => setShowFavOnly((v) => !v)}
              className={`w-[38px] h-[38px] rounded-[6.624px] border-[1.25px] border-white flex items-center justify-center transition-colors ${
                showFavOnly
                  ? 'bg-white text-[#0037ae]'
                  : 'text-white hover:bg-white/10'
              }`}
              title="show only favorites"
              aria-label="show only favorites"
            >
              <StarIcon filled={showFavOnly} />
            </button>

            {/* Filter button */}
            <button
              onClick={() => {
                anchorRef.current = null;
                setHideEmpty((v) => !v);
              }}
              className={`w-[38px] h-[38px] rounded-[6.624px] border-[1.25px] border-white flex items-center justify-center transition-colors ${
                hideEmpty
                  ? 'bg-white text-[#0037ae]'
                  : 'text-white hover:bg-white/10'
              }`}
              title="toggle hide empty days"
              aria-label="toggle hide empty days"
            >
              <FilterIcon />
            </button>

            {/* Network Status Indicator */}
            {!isOnline && (
              <div 
                className="w-[12px] h-[12px] rounded-full bg-red-500 animate-pulse"
                title="Offline - changes will sync when online"
                aria-label="offline indicator"
              />
            )}
            {syncStatus === 'syncing' && isOnline && (
              <div 
                className="w-[12px] h-[12px] rounded-full bg-yellow-400 animate-pulse"
                title="Syncing changes..."
                aria-label="syncing indicator"
              />
            )}
            {syncStatus === 'success' && isOnline && (
              <div 
                className="w-[12px] h-[12px] rounded-full bg-green-500"
                title={syncMessage || 'Synced'}
                aria-label="sync success indicator"
              />
            )}
            {syncStatus === 'error' && isOnline && (
              <div 
                className="w-[12px] h-[12px] rounded-full bg-red-500"
                title={syncMessage || 'Sync error'}
                aria-label="sync error indicator"
              />
            )}

            {/* Today button */}
            <button
              onClick={() => scrollTo(todayKey, true)}
              className="h-[38px] px-[19.872px] py-[6.624px] rounded-[6.624px] bg-white flex items-center justify-center hover:bg-white/90 transition-colors"
              title="jump to today"
            >
              <span
                className="uppercase font-bold tracking-[0.33px]"
                style={{ 
                  fontFamily: DESIGN.fonts.nav,
                  fontSize: '19.872px',
                  color: DESIGN.colors.mainBlue,
                }}
              >
                today
              </span>
            </button>
          </div>
        </div>
      </div>

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
            height: `calc(100svh - ${headerH}px)`,
            touchAction: isDragging ? 'none' : 'pan-x',
            overscrollBehaviorX: 'contain',
            overscrollBehaviorY: 'contain',
          }}
          onTouchMove={(e) => {
            if (isDragging) e.preventDefault();
          }}
          className="overflow-x-auto overflow-y-hidden"
        >
          <div className="h-full flex items-start gap-[8px] pl-0 pt-[7px] pr-[10px]">
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

              const phIdx =
                externalHover.dayKey === key ? externalHover.index : -1;
              const render = showFavOnly ? items.filter((x) => !!x.fav) : items;

              return (
                <React.Fragment key={key}>
                  {sep}
                  <Droppable droppableId={key}>
                    {(provided, snap) => (
                      <div
                        ref={(el) => {
                          provided.innerRef(el);
                          columnRefs.current[key] = el;
                        }}
                        {...provided.droppableProps}
                        onDragOver={(e) => onExtOver(e, key)}
                        onDragLeave={(e) => onExtLeave(e, key)}
                        onDrop={(e) => onExtDrop(e, key)}
                        style={{
                          minWidth: w,
                          width: w,
                          touchAction: isDragging ? 'none' : 'auto',
                          overscrollBehaviorY: 'contain',
                        }}
                        onTouchMove={(e) => {
                          if (isDragging) e.preventDefault();
                        }}
                        className={`relative h-full flex flex-col rounded-t-[10px] border border-white p-[6px] gap-[10px] transition-all duration-200 ease-out ${
                          fileOver === key
                            ? 'border-2 border-dashed border-white/80'
                            : ''
                        }`}
                        data-column-key={key}
                      >
                        {/* Inner shadow overlay */}
                        <div 
                          className="absolute inset-0 pointer-events-none rounded-t-[10px]"
                          style={{ boxShadow: 'inset 2px 2px 3.6px 0px rgba(255,255,255,0.24)' }}
                        />

                        {/* Header */}
                        <div className="relative z-10 shrink-0 w-full">
                          {isToday(key) ? (
                            // White filled header ONLY for today
                            <div 
                              className="w-full rounded-[5px] bg-white flex flex-col items-center gap-px p-[5px]"
                              style={{ color: DESIGN.colors.mainBlue }}
                            >
                              <div
                                className="uppercase tracking-[0.2488px] leading-[19.5px]"
                                style={{ fontFamily: "'Andale Mono', monospace", fontSize: '18px' }}
                              >
                                {fmtDOW(d).toUpperCase()}
                              </div>
                              <div
                                className="uppercase tracking-[0.2488px] leading-[19.5px]"
                                style={{ fontFamily: DESIGN.fonts.body, fontSize: '13px', fontWeight: 500 }}
                              >
                                {fmtMD(d)}
                              </div>
                            </div>
                          ) : (
                            // Border-only header for all other columns
                            <div 
                              className="w-full rounded-[5px] border border-white flex flex-col items-center gap-px p-[6px] text-white"
                            >
                              <div
                                className="uppercase tracking-[0.2488px] leading-[19.5px]"
                                style={{ fontFamily: "'Andale Mono', monospace", fontSize: '18px' }}
                              >
                                {fmtDOWShort(d)}
                              </div>
                              <div
                                className="uppercase tracking-[0.2488px] leading-[19.5px]"
                                style={{ fontFamily: DESIGN.fonts.body, fontSize: '13px', fontWeight: 500 }}
                              >
                                {fmtMD(d)}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Images area */}
                        <div
                          ref={(el) => {
                            listRefs.current[key] = el;
                          }}
                          className="relative flex-1 overflow-y-auto overflow-x-hidden flex flex-col gap-[10px]"
                          onDragEnter={(e) => onExtOver(e, key)}
                          onDragOver={(e) => onExtOver(e, key)}
                          onDrop={(e) => {
                            if (e.dataTransfer?.files?.length) {
                              e.preventDefault();
                              e.stopPropagation();
                              onExtDrop(e, key);
                            }
                          }}
                          style={{ touchAction: isDragging ? 'none' : 'auto' }}
                          onTouchMove={(e) => {
                            if (isDragging) e.preventDefault();
                          }}
                        >
                          {isPast(key) && (
                            <div className="pointer-events-none absolute inset-0 rounded-[5px] bg-[#0037ae]/60 z-10" />
                          )}
                          {render.length > 0 && phIdx === 0 && (
                            <Placeholder
                              onDragOverBlock={(e) => {
                                if (e.dataTransfer?.types?.includes('Files')) {
                                  e.preventDefault();
                                  e.stopPropagation();
                                }
                              }}
                              onDropBlock={(e) => {
                                if (e.dataTransfer?.files?.length) {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  onExtDrop(e, key);
                                }
                              }}
                            />
                          )}
                          {render.map((it, idx) => (
                            <React.Fragment key={it.id}>
                              {phIdx === idx &&
                                idx > 0 &&
                                idx < render.length && (
                                  <Placeholder
                                    onDragOverBlock={(e) => {
                                      if (
                                        e.dataTransfer?.types?.includes('Files')
                                      ) {
                                        e.preventDefault();
                                        e.stopPropagation();
                                      }
                                    }}
                                    onDropBlock={(e) => {
                                      if (e.dataTransfer?.files?.length) {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        onExtDrop(e, key);
                                      }
                                    }}
                                  />
                                )}
                              <Draggable draggableId={it.id} index={idx}>
                                {(provided, snap) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    data-item-id={it.id}
                                    className={`group relative select-none shrink-0 ${
                                      snap.isDragging ? 'rotate-1' : ''
                                    }`}
                                    style={{
                                      ...provided.draggableProps.style,
                                      touchAction: isDragging ? 'none' : 'auto',
                                    }}
                                  >
                                    {/* Event Card */}
                                    <div 
                                      className="relative w-full bg-white rounded-[5px] overflow-hidden cursor-pointer"
                                      style={{ boxShadow: '0px 4px 4px 0px rgba(0,0,0,0.25)' }}
                                      onClick={() =>
                                        setViewer({
                                          url: it.dataUrl,
                                          name: it.name,
                                          dayKey: key,
                                          id: it.id,
                                          fav: !!it.fav,
                                          note: it.note || '',
                                        })
                                      }
                                    >
                                      <img
                                        src={it.dataUrl}
                                        alt={it.name || 'flyer'}
                                        className="w-full h-auto object-cover"
                                        draggable={false}
                                        onDragStart={(e) => e.preventDefault()}
                                        style={{
                                          WebkitUserDrag: 'none',
                                          userSelect: 'none',
                                          WebkitTouchCallout: 'none',
                                        } as React.CSSProperties}
                                      />
                                      {/* Inner shadow on card */}
                                      <div 
                                        className="absolute inset-0 pointer-events-none"
                                        style={{ boxShadow: 'inset 1px 2px 2.8px 0px rgba(255,255,255,0.34)' }}
                                      />
                                    </div>

                                    {/* Delete button */}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDeleteConfirm({
                                          dayKey: key,
                                          id: it.id,
                                        });
                                      }}
                                      className={`absolute top-2 left-2 w-7 h-7 rounded-full bg-red-600 text-white shadow-md grid place-items-center transition-opacity ${
                                        isTouch
                                          ? 'opacity-0 pointer-events-none'
                                          : 'opacity-0 group-hover:opacity-100'
                                      }`}
                                      title="delete"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>

                                    {/* Action buttons */}
                                    <div className="absolute top-2 right-2 flex flex-col gap-1.5">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleFav(key, it.id, !it.fav);
                                        }}
                                        className={`w-7 h-7 rounded-full grid place-items-center transition-opacity shadow-md ${
                                          it.fav
                                            ? 'bg-[#0037ae]'
                                            : 'bg-white/90'
                                        } ${
                                          it.fav
                                            ? ''
                                            : isTouch
                                            ? 'opacity-0 pointer-events-none'
                                            : 'opacity-0 group-hover:opacity-100'
                                        }`}
                                        title={
                                          it.fav ? 'unfavorite' : 'favorite'
                                        }
                                      >
                                        <Star
                                          className="w-3.5 h-3.5"
                                          {...(it.fav
                                            ? { color: 'white', fill: 'white' }
                                            : { color: '#0037ae' })}
                                        />
                                      </button>

                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          copyImageToClipboard(it, e);
                                        }}
                                        className={`w-7 h-7 rounded-full bg-white/90 shadow-md grid place-items-center transition-opacity ${
                                          isTouch
                                            ? 'opacity-0 pointer-events-none'
                                            : 'opacity-0 group-hover:opacity-100'
                                        }`}
                                        title="download image"
                                      >
                                        <Copy className="w-3.5 h-3.5 text-[#0037ae]" />
                                      </button>

                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          copyImageLink(key, it.id, e);
                                        }}
                                        className={`w-7 h-7 rounded-full bg-white/90 shadow-md grid place-items-center transition-opacity ${
                                          isTouch
                                            ? 'opacity-0 pointer-events-none'
                                            : 'opacity-0 group-hover:opacity-100'
                                        }`}
                                        title="copy link to image"
                                      >
                                        <Link2 className="w-3.5 h-3.5 text-[#0037ae]" />
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            </React.Fragment>
                          ))}
                          {provided.placeholder}
                        </div>

                        {/* Add button */}
                        <div className="relative z-10 shrink-0">
                          <ColumnAddBar dayKey={key} onFiles={addFilesToDay} />
                        </div>
                      </div>
                    )}
                  </Droppable>
                </React.Fragment>
              );
            })}
            {futureShown < 365 && (
              <div className="flex items-center pr-4">
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
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-8"
          onClick={() => {
            setViewer(null);
            setShowNotes(false);
          }}
        >
          <button
            onClick={() => {
              setViewer(null);
              setShowNotes(false);
            }}
            className="fixed top-4 right-4 z-[60] w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 grid place-items-center transition-all"
            title="close"
            aria-label="close"
          >
            <X className="w-6 h-6 text-white" />
          </button>

          <div className="relative max-w-4xl w-full flex flex-col items-center gap-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="relative flex justify-center group min-h-[200px]"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={viewer.url}
                alt={viewer.name || 'flyer'}
                className="max-w-full max-h-[60vh] object-contain rounded-[10px] shadow-2xl"
              />

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteConfirm({ dayKey: viewer.dayKey, id: viewer.id });
                }}
                className={`absolute top-3 left-3 z-10 w-10 h-10 rounded-full bg-red-600 text-white shadow-lg grid place-items-center ${
                  isTouch ? '' : 'opacity-0 group-hover:opacity-100'
                } transition-opacity`}
                title="delete"
                aria-label="delete"
              >
                <Trash2 className="w-5 h-5" />
              </button>

              <div
                className={`absolute top-3 right-3 z-10 flex flex-col gap-2 ${
                  isTouch ? '' : 'opacity-0 group-hover:opacity-100'
                } transition-opacity`}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFav(viewer.dayKey, viewer.id, !viewer.fav);
                    setViewer((v) => (v ? { ...v, fav: !v.fav } : v));
                  }}
                  className={`w-10 h-10 rounded-full grid place-items-center shadow-lg ${
                    viewer.fav
                      ? 'bg-[#0037ae]'
                      : 'bg-white'
                  }`}
                  title={viewer.fav ? 'unfavorite' : 'favorite'}
                  aria-label="favorite"
                >
                  <Star
                    className="w-5 h-5"
                    {...(viewer.fav ? { color: 'white', fill: 'white' } : { color: '#0037ae' })}
                  />
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    copyImageToClipboard(viewer, e);
                  }}
                  className="w-10 h-10 rounded-full bg-white shadow-lg grid place-items-center"
                  title="copy image"
                  aria-label="copy image"
                >
                  <Copy className="w-5 h-5 text-[#0037ae]" />
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    copyImageLink(viewer.dayKey, viewer.id, e);
                  }}
                  className="w-10 h-10 rounded-full bg-white shadow-lg grid place-items-center"
                  title="copy link"
                  aria-label="copy link"
                >
                  <Link2 className="w-5 h-5 text-[#0037ae]" />
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowNotes((prev) => !prev);
                  }}
                  className={`w-10 h-10 rounded-full grid place-items-center shadow-lg ${
                    viewer.note
                      ? 'bg-[#0037ae]'
                      : 'bg-white'
                  } ${
                    viewer.note
                      ? ''
                      : isTouch
                      ? 'opacity-0 pointer-events-none'
                      : 'opacity-0 group-hover:opacity-100'
                  }`}
                  title={viewer.note ? 'toggle notes' : 'add notes'}
                  aria-label="toggle notes"
                >
                  <FileText
                    className="w-5 h-5"
                    {...(viewer.note ? { color: 'white' } : { color: '#0037ae' })}
                  />
                </button>
              </div>
            </motion.div>

            {showNotes && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{
                  duration: 0.25,
                  delay: 0.1,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="w-full max-w-2xl p-4 rounded-lg bg-white shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={viewer.note || ''}
                  onChange={(e) => {
                    const newNote = e.target.value;
                    setViewer((v) => (v ? { ...v, note: newNote } : v));
                    updateImageNote(viewer.dayKey, viewer.id, newNote);
                  }}
                  placeholder="Add notes about this image..."
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-neutral-50 focus:bg-white outline-none min-h-[100px] resize-y"
                />
              </motion.div>
            )}
          </div>
        </motion.div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm grid place-items-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl p-5 space-y-4">
            <h3 className="text-lg font-semibold text-neutral-900">
              Delete Image?
            </h3>
            <p className="text-sm text-neutral-600">
              Are you sure you want to delete this image? This action cannot be
              undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-lg bg-neutral-100 text-neutral-800 hover:bg-neutral-200"
              >
                Cancel
              </button>
              <button
                onClick={() => {
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
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slug Prompt Modal */}
      {showSlugPrompt && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm grid place-items-center p-4"
          role="dialog"
          aria-modal
        >
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl p-5 space-y-3">
            <div className="text-sm text-neutral-800">
              create/go to existing board
            </div>
            <input
              autoFocus={!isTouch}
              value={slugDraft}
              onChange={(e) =>
                setSlugDraft(e.target.value.replace(/[^a-zA-Z0-9-_]/g, '-'))
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter' && slugDraft) {
                  setSlug(slugDraft);
                  setShowSlugPrompt(false);
                }
              }}
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-neutral-50 focus:bg-white outline-none"
            />
            <div className="text-[12px] text-neutral-500">
              tap the POSTBILLS logo anytime to name/switch boards. we'll
              update the url to /your-slug. bookmark it. anyone with the link
              can view/edit.
            </div>
            <div className="flex gap-2 justify-end">
              <button
                disabled={!slugDraft}
                onClick={() => {
                  if (slugDraft) {
                    setSlug(slugDraft);
                    setShowSlugPrompt(false);
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-[#0037ae] text-white disabled:opacity-50"
              >
                continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Help Button */}
      <button
        onClick={() => setShowHelp(true)}
        className="fixed bottom-4 right-4 z-40 w-10 h-10 rounded-full bg-white shadow-lg grid place-items-center"
        title="help"
        aria-label="help"
      >
        <HelpCircle className="w-5 h-5 text-[#0037ae]" />
      </button>

      {/* Help Popover */}
      {showHelp && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowHelp(false)}
          />
          <div
            className="fixed bottom-16 right-4 z-50 w-72 rounded-xl bg-white shadow-xl border border-neutral-200 p-3 text-[12px] text-neutral-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-medium mb-1">quick tips</div>
            <ul className="list-disc pl-4 space-y-1">
              <li>tap the POSTBILLS logo to create/go to your board.</li>
              <li>copy your link with the link icon.</li>
              <li>drag images from desktop into a day.</li>
              <li>use filters to hide empty/past or show only favorites.</li>
              <li>tap today to center the current date.</li>
              <li>tap outside this box to close.</li>
            </ul>
          </div>
        </>
      )}

      {/* Copy Feedback Toast */}
      <AnimatePresence>
        {copyFeedback.show && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, x: -10 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'fixed',
              left: copyFeedback.x,
              top: copyFeedback.y,
              zIndex: 9999,
            }}
            className="bg-[#0037ae] text-white text-xs px-3 py-1.5 rounded-full shadow-lg font-medium whitespace-nowrap"
          >
            {copyFeedback.type === 'image'
              ? 'Image downloaded!'
              : 'Link copied!'}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ColumnAddBar({ dayKey, onFiles }: { dayKey: string; onFiles: (dayKey: string, files: FileList) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="shrink-0 relative">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={async (e) => {
          if (e.target.files?.length) {
            await onFiles(dayKey, e.target.files);
            e.target.value = '';
          }
        }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        className="w-full h-[52px] rounded-[5px] border border-white flex items-center justify-center hover:bg-white/10 transition-colors"
        title="add images"
        aria-label="add images"
      >
        <PlusIcon />
      </button>
    </div>
  );
}
