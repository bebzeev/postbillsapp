import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Calendar,
  Link as LinkIcon,
  Filter,
  HelpCircle,
  Star,
  ChevronRight,
  Trash2,
  Copy,
  Link2,
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

// ========== DESIGN SYSTEM - EDIT HERE ==========
const DESIGN = {
  colors: {
    primary: 'blue',
    primaryShade: '700',
    primaryHover: '600',
    primaryBg: '#0047BB', // Royal blue background
    todayStripe1: '#0047BB', // Blue stripe
    todayStripe2: '#0056D6', // Lighter blue stripe
    todayStripeWidth: '10px', // Width of each stripe
    background: 'bg-[#0047BB]',
  },
  spacing: {
    columnGapNarrow: 'gap-3',
    columnGapWide: 'gap-4',
    columnGapFilteredNarrow: 'gap-4',
    columnGapFilteredWide: 'gap-6',
    containerPaddingNarrow: 'px-3',
    containerPaddingWide: 'px-4',
    itemSpacing: 'space-y-3',
  },
  radius: {
    column: 'rounded-2xl',
    image: 'rounded-lg',
    button: 'rounded-xl',
    card: 'rounded-xl',
    modal: 'rounded-2xl',
  },
  fonts: {
    family: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    casing: 'uppercase',
  },
  shadows: {
    column: 'shadow-lg',
    image: 'shadow-xl',
    button: 'shadow-md',
    card: 'shadow-xl',
  },
  borders: {
    column: 'border-2',
    columnColor: 'border-white',
    ring: 'ring-2 ring-white',
  },
};
// ========== END DESIGN SYSTEM ==========

const DAY_MS = 86400000;
const todayAtMidnight = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};
const fmtKey = (d) => d.toISOString().slice(0, 10);
const fmtMD = (d) =>
  `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(
    2,
    '0'
  )}`;
const fmtDOW = (d) => d.toLocaleDateString(undefined, { weekday: 'long' });
const fmtDOWShort = (d) =>
  (d.toLocaleDateString('en-US', { weekday: 'short' }) || '').slice(0, 3);
const uid = () => `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
const genRange = (future) => {
  const s = new Date(todayAtMidnight().getTime() - 30 * DAY_MS),
    e = new Date(todayAtMidnight().getTime() + future * DAY_MS),
    a = [];
  for (let t = s.getTime(); t <= e.getTime(); t += DAY_MS) a.push(new Date(t));
  return a;
};

const FAVICON_DATA_URL =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?><svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='14' fill='#0047BB'/><rect x='16' y='20' width='32' height='28' rx='5' fill='#fff'/><rect x='16' y='20' width='32' height='8' rx='5' fill='#e0efff'/><circle cx='24' cy='14' r='4' fill='#fff'/><circle cx='40' cy='14' r='4' fill='#fff'/></svg>"
  );

async function fileToDataUrlCompressed(file, maxWidth = 1400) {
  const dataUrl = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  return await new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, maxWidth / img.width),
        w = Math.round(img.width * s),
        h = Math.round(img.height * s);
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
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

let app,
  db,
  storage,
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
  let populated = 320;
  if (w < 640) populated = Math.round(w * 0.38);
  else if (w < 1024) populated = 288;
  const empty = Math.max(Math.round(populated * 0.56), 100);
  return { populated, empty, isNarrow: w < 640 };
}

export default function Eventi() {
  const [futureShown, setFutureShown] = useState(60);
  const days = useMemo(() => genRange(futureShown), [futureShown]);
  const todayKey = fmtKey(todayAtMidnight());

  // Find today's index to start rendering from there
  const todayIndex = useMemo(() => {
    return days.findIndex((d) => fmtKey(d) === todayKey);
  }, [days, todayKey]);

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
    // Only auto-load last slug if user has been here before
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

  const [board, setBoard] = useState({});
  const [viewer, setViewer] = useState(null);
  const [fileOver, setFileOver] = useState(null);
  const [externalHover, setExternalHover] = useState({
    dayKey: null,
    index: null,
  });
  const [hideEmpty, setHideEmpty] = useState(false);
  const [showFavOnly, setShowFavOnly] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [copyFeedback, setCopyFeedback] = useState({
    show: false,
    type: '',
    x: 0,
    y: 0,
  });

  const scrollRef = useRef(null);
  const columnRefs = useRef({});
  const listRefs = useRef({});
  const headerRef = useRef(null);
  const [headerH, setHeaderH] = useState(64);
  const anchorRef = useRef(null);

  const isTouch = useMemo(
    () =>
      typeof window !== 'undefined' &&
      (window.matchMedia
        ? window.matchMedia('(pointer: coarse)').matches
        : 'ontouchstart' in window),
    []
  );

  useEffect(() => {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href =
      'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap';
    document.head.appendChild(l);
    document.title = "POSTBILLS";
    let link = document.querySelector("link[rel='icon']");
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
    const f = (d) => {
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
    if (!firebaseReady || !slug) return;
    const boardRef = doc(db, 'boards', slug);
    setDoc(
      boardRef,
      { createdAt: serverTimestamp(), public: true, title: slug },
      { merge: true }
    ).catch(() => {});

    const unsub = onSnapshot(
      collection(boardRef, 'items'),
      (snap) => {
        const by = {};
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
        setBoard((p) => {
          const n = { ...p };
          for (const d of days) n[fmtKey(d)] = by[fmtKey(d)] || [];
          return n;
        });
      },
      (err) => console.warn('firestore snapshot error', err)
    );
    return () => unsub();
  }, [slug, days]);

  useEffect(() => {
    // Use the EXACT same function as the "today" button
    scrollTo(todayKey);
  }, []);

  useEffect(() => {
    const u = () => setHeaderH(headerRef.current?.offsetHeight || 64);
    u();
    window.addEventListener('resize', u);
    return () => window.removeEventListener('resize', u);
  }, []);

  useEffect(() => {
    if (!viewer) return;
    const on = (e) => {
      if (e.key === 'Escape') setViewer(null);
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [viewer]);

  useEffect(() => {
    const stop = (e) => {
      if (e.dataTransfer?.types?.includes('Files')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const clear = () => {
      setFileOver(null);
      setExternalHover({ dayKey: null, index: null });
    };
    const onDrop = (e) => {
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
    const h = (e) => {
      if (isDragging) e.preventDefault();
    };
    s.addEventListener('touchmove', h, { passive: false });
    return () => s.removeEventListener('touchmove', h);
  }, [isDragging]);

  const prevFilters = useRef({ hideEmpty, showFavOnly });
  useEffect(() => {
    const was = prevFilters.current;
    if (was.hideEmpty && !hideEmpty) setTimeout(() => scrollTo(todayKey), 0);
    if (was.showFavOnly && !showFavOnly)
      setTimeout(() => scrollTo(todayKey), 0);
    prevFilters.current = { hideEmpty, showFavOnly };
  }, [hideEmpty, showFavOnly, todayKey]);

  const isPast = (k) => k < todayKey;
  const isToday = (k) => k === todayKey;

  const scrollTo = (k) => {
    const el = columnRefs.current[k];
    el?.scrollIntoView({
      behavior: 'smooth',
      inline: 'start',
      block: 'nearest',
    });
  };

  const scrollToCenter = (k) => {
    const el = columnRefs.current[k];
    el?.scrollIntoView({
      behavior: 'instant',
      inline: 'center',
      block: 'nearest',
    });
  };

  async function removeImage(dayKey, id) {
    setBoard((p) => ({
      ...p,
      [dayKey]: (p[dayKey] || []).filter((x) => x.id !== id),
    }));
    setDeleteConfirm(null);

    if (firebaseReady) {
      try {
        await deleteDoc(doc(db, 'boards', slug, 'items', id));
      } catch {}
      try {
        await deleteObject(sRef(storage, `boards/${slug}/${id}.jpg`));
      } catch {}
    }
  }

  async function updateImageNote(dayKey, id, note) {
    setBoard((p) => {
      const a = Array.from(p[dayKey] || []);
      const i = a.findIndex((x) => x.id === id);
      if (i < 0) return p;
      a[i] = { ...a[i], note };
      return { ...p, [dayKey]: a };
    });

    if (firebaseReady) {
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

  async function toggleFav(dayKey, id, next) {
    setBoard((p) => {
      const a = Array.from(p[dayKey] || []);
      const i = a.findIndex((x) => x.id === id);
      if (i < 0) return p;
      a[i] = { ...a[i], fav: next };
      const fav = a.filter((x) => x.fav);
      const rest = a.filter((x) => !x.fav);
      return { ...p, [dayKey]: [...fav, ...rest] };
    });

    if (firebaseReady) {
      try {
        const cur = board[dayKey] || [];
        const arr = cur.map((x) => (x.id === id ? { ...x, fav: next } : x));
        const fav = arr.filter((x) => x.fav);
        const rest = arr.filter((x) => !x.fav);
        const fin = [...fav, ...rest];
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

  async function addFilesToDay(dayKey, files, insertIndex = null) {
    const list = Array.from(files || []).filter((f) =>
      f.type?.startsWith('image/')
    );
    if (!list.length) return;

    const urls = await Promise.all(list.map((f) => fileToDataUrlCompressed(f)));
    const entries = list.map((f, i) => ({
      id: uid(),
      name: f.name,
      createdAt: Date.now(),
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

    if (firebaseReady) {
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

  async function copyImageToClipboard(item, event) {
    try {
      const dataUrl = item.dataUrl || item.url;
      if (!dataUrl) throw new Error('No image data available');

      // Try to copy actual image to clipboard
      try {
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        await navigator.clipboard.write([
          new ClipboardItem({ [blob.type]: blob }),
        ]);

        if (event) {
          const rect = event.currentTarget.getBoundingClientRect();
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
      } catch (clipboardErr) {
        // Fallback: download if clipboard doesn't work
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = item.name || 'image.jpg';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        if (event) {
          const rect = event.currentTarget.getBoundingClientRect();
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

  function getImageLink(dayKey, id) {
    const u = new URL(window.location.href);
    u.searchParams.set('img', `${dayKey}:${id}`);
    return u.toString();
  }

  async function copyImageLink(dayKey, id, event) {
    const link = getImageLink(dayKey, id);
    try {
      await navigator.clipboard.writeText(link);
      if (event) {
        const rect = event.currentTarget.getBoundingClientRect();
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

  const computeInsert = (e, dayKey) => {
    let at = (board[dayKey] || []).length;
    const list = listRefs.current[dayKey];
    if (list) {
      const rect = list.getBoundingClientRect();
      const y = e.clientY - rect.top + list.scrollTop;
      const kids = Array.from(list.querySelectorAll('[data-item-id]'));
      const idx = kids.findIndex(
        (ch) => y < ch.offsetTop + ch.offsetHeight / 2
      );
      at = idx === -1 ? kids.length : idx;
    }
    return at;
  };

  function onExtOver(e, dayKey) {
    if (e.dataTransfer?.types?.includes('Files')) {
      e.preventDefault();
      e.stopPropagation();
      const idx = computeInsert(e, dayKey);
      if (fileOver !== dayKey) setFileOver(dayKey);
      setExternalHover({ dayKey, index: idx });
    }
  }

  function onExtLeave(_, dayKey) {
    if (fileOver === dayKey) setFileOver(null);
    if (externalHover.dayKey === dayKey)
      setExternalHover({ dayKey: null, index: null });
  }

  async function onExtDrop(e, dayKey) {
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

  async function onDragEnd(result) {
    setIsDragging(false);
    const { source, destination } = result;
    if (!destination) return;

    const sKey = source.droppableId;
    const dKey = destination.droppableId;
    if (sKey === dKey && source.index === destination.index) return;

    setBoard((p) => {
      const n = { ...p };
      const sArr = Array.from(n[sKey] || []);
      const [m] = sArr.splice(source.index, 1);
      n[sKey] = sArr;
      const dArr = Array.from(n[dKey] || []);
      dArr.splice(destination.index, 0, m);
      n[dKey] = dArr;
      return n;
    });

    if (firebaseReady) {
      const moved = (board[sKey] || [])[source.index];
      if (!moved) return;

      const sArr = Array.from(board[sKey] || []);
      sArr.splice(source.index, 1);
      const dArr = sKey === dKey ? sArr : Array.from(board[dKey] || []);
      dArr.splice(destination.index, 0, moved);

      const b = writeBatch(db);
      const write = (k, arr) =>
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

  const GapSeparator = ({ thin = false }) => (
    <div
      className={`${thin ? 'mx-3' : 'mx-6'} h-full flex items-center`}
      aria-hidden
    >
      <div
        className={`${thin ? 'w-[2px]' : 'w-[3px]'} bg-white/40`}
        style={{ height: '80%' }}
      />
    </div>
  );

  const Placeholder = ({ onDropBlock, onDragOverBlock }) => (
    <div
      className="relative z-20 h-10 rounded-xl border-2 border-dashed border-white/50 bg-white/10"
      aria-label="Drop position"
      onDragOver={onDragOverBlock}
      onDrop={onDropBlock}
      onDragEnter={onDragOverBlock}
    />
  );

  const trackGap = useMemo(
    () =>
      hideEmpty || showFavOnly
        ? isNarrow
          ? `${DESIGN.spacing.columnGapFilteredNarrow} ${DESIGN.spacing.containerPaddingNarrow}`
          : `${DESIGN.spacing.columnGapFilteredWide} ${DESIGN.spacing.containerPaddingWide}`
        : isNarrow
        ? `${DESIGN.spacing.columnGapNarrow} ${DESIGN.spacing.containerPaddingNarrow}`
        : `${DESIGN.spacing.columnGapWide} ${DESIGN.spacing.containerPaddingWide}`,
    [hideEmpty, showFavOnly, isNarrow]
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
      className={`w-full fixed inset-0 overflow-hidden text-white flex flex-col ${DESIGN.fonts.casing}`}
      style={{ fontFamily: DESIGN.fonts.family, backgroundColor: DESIGN.colors.primaryBg }}
    >
      <div
        ref={headerRef}
        className="sticky top-0 z-20 border-b-2 border-white/20"
        style={{ backgroundColor: DESIGN.colors.primaryBg }}
      >
        <div className="w-full px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => setShowSlugPrompt(true)}
            className="flex items-center gap-3 focus:outline-none"
            title="set board name"
          >
            <div className="font-black text-2xl sm:text-3xl leading-none tracking-tight text-white">
              POST<br className="sm:hidden" />BILLS
            </div>
          </button>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={copyShare}
              className={`p-2.5 ${DESIGN.radius.button} border-2 border-white/30 hover:bg-white/10 transition-colors`}
              title="copy link"
              aria-label="copy link"
            >
              <LinkIcon className="w-5 h-5 text-white" strokeWidth={2} />
            </button>
            {copied && <span className="text-xs text-green-300 font-semibold">copied ✓</span>}
            <button
              onClick={() => setShowFavOnly((v) => !v)}
              className={`p-2.5 ${DESIGN.radius.button} border-2 transition-colors ${
                showFavOnly
                  ? 'bg-white/20 border-white/50'
                  : 'border-white/30 hover:bg-white/10'
              }`}
              title="show only favorites"
              aria-label="show only favorites"
            >
              <Star className="w-5 h-5 text-white" strokeWidth={2} fill={showFavOnly ? 'white' : 'none'} />
            </button>
            <button
              onClick={() => {
                anchorRef.current = null;
                setHideEmpty((v) => !v);
              }}
              className={`p-2.5 ${DESIGN.radius.button} border-2 transition-colors ${
                hideEmpty
                  ? 'bg-white/20 border-white/50'
                  : 'border-white/30 hover:bg-white/10'
              }`}
              title="toggle hide empty days"
              aria-label="toggle hide empty days"
            >
              <Filter className="w-5 h-5 text-white" strokeWidth={2} />
            </button>
            <button
              onClick={() => scrollTo(todayKey)}
              className={`px-4 py-2 ${DESIGN.radius.button} text-sm font-bold bg-white hover:bg-white/90 transition-colors`}
              style={{ color: DESIGN.colors.primaryBg }}
              title="jump to today"
            >
              TODAY
            </button>
          </div>
        </div>
      </div>

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
          <div className={`h-full flex items-stretch ${trackGap} py-4`}>
            {visibleDays.map((d, i) => {
              const key = fmtKey(d);
              const items = board[key] || [];
              const has = items.length > 0;
              const w = has ? populated : empty;

              // Background for columns - always blue
              const bgStyle = DESIGN.colors.primaryBg;

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
                          backgroundColor: bgStyle,
                        }}
                        onTouchMove={(e) => {
                          if (isDragging) e.preventDefault();
                        }}
                        className={`relative h-full flex flex-col ${
                          DESIGN.radius.column
                        } ${DESIGN.borders.column} ${
                          fileOver === key
                            ? 'border-4 border-dashed border-white/50'
                            : DESIGN.borders.columnColor
                        } transition-all duration-200 ease-out`}
                      >
                        <div className="relative z-20 shrink-0 p-3 pb-0">
                          <div
                            className={`w-full px-4 py-2.5 ${DESIGN.radius.card} bg-white border-2 text-center`}
                            style={{ borderColor: DESIGN.colors.primaryBg }}
                          >
                            <div
                              className={`text-sm font-bold leading-tight tracking-wide`}
                              style={{ color: DESIGN.colors.primaryBg }}
                            >
                              {has ? fmtDOW(d) : fmtDOWShort(d)}
                            </div>
                            <div className="text-xs font-semibold mt-0.5" style={{ color: DESIGN.colors.primaryBg }}>
                              {fmtMD(d)}
                            </div>
                          </div>
                        </div>

                        <div
                          ref={(el) => {
                            listRefs.current[key] = el;
                          }}
                          className={`relative flex-1 overflow-y-auto px-3 pb-28 ${DESIGN.spacing.itemSpacing}`}
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
                            <div className="pointer-events-none absolute inset-0 rounded-xl bg-black/30 z-10" />
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
                                    className={`group relative select-none ${
                                      snap.isDragging ? 'rotate-1' : ''
                                    }`}
                                    style={{
                                      ...provided.draggableProps.style,
                                      touchAction: isDragging ? 'none' : 'auto',
                                    }}
                                  >
                                    <img
                                      src={it.dataUrl}
                                      alt={it.name || 'flyer'}
                                      className={`w-full h-auto ${DESIGN.radius.image} ${DESIGN.borders.ring} ${DESIGN.shadows.image} cursor-pointer`}
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
                                      draggable={false}
                                      onDragStart={(e) => e.preventDefault()}
                                      style={{
                                        WebkitUserDrag: 'none',
                                        userSelect: 'none',
                                        WebkitTouchCallout: 'none',
                                      }}
                                    />

                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDeleteConfirm({
                                          dayKey: key,
                                          id: it.id,
                                        });
                                      }}
                                      className={`absolute top-2 left-2 w-8 h-8 ${
                                        DESIGN.radius.button
                                      } bg-red-600 text-white shadow-lg grid place-items-center transition-opacity ${
                                        isTouch
                                          ? 'opacity-0 pointer-events-none'
                                          : 'opacity-0 group-hover:opacity-100'
                                      }`}
                                      title="delete"
                                    >
                                      <Trash2 className="w-4 h-4" strokeWidth={2} />
                                    </button>

                                    <div className="absolute top-2 right-2 flex flex-col gap-2">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleFav(key, it.id, !it.fav);
                                        }}
                                        className={`w-8 h-8 ${
                                          DESIGN.radius.button
                                        } grid place-items-center transition-opacity shadow-lg ${
                                          it.fav
                                            ? 'bg-white border-2'
                                            : 'bg-white border-2'
                                        } ${
                                          it.fav
                                            ? ''
                                            : isTouch
                                            ? 'opacity-0 pointer-events-none'
                                            : 'opacity-0 group-hover:opacity-100'
                                        }`}
                                        style={it.fav ? { borderColor: DESIGN.colors.primaryBg } : { borderColor: DESIGN.colors.primaryBg }}
                                        title={
                                          it.fav ? 'unfavorite' : 'favorite'
                                        }
                                      >
                                        <Star
                                          className="w-4 h-4"
                                          strokeWidth={2}
                                          {...(it.fav
                                            ? { fill: DESIGN.colors.primaryBg, color: DESIGN.colors.primaryBg }
                                            : { color: DESIGN.colors.primaryBg })}
                                        />
                                      </button>

                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          copyImageToClipboard(it, e);
                                        }}
                                        className={`w-8 h-8 ${
                                          DESIGN.radius.button
                                        } bg-white border-2 shadow-lg grid place-items-center transition-opacity ${
                                          isTouch
                                            ? 'opacity-0 pointer-events-none'
                                            : 'opacity-0 group-hover:opacity-100'
                                        }`}
                                        style={{ borderColor: DESIGN.colors.primaryBg }}
                                        title="download image"
                                      >
                                        <Copy className="w-4 h-4" strokeWidth={2} style={{ color: DESIGN.colors.primaryBg }} />
                                      </button>

                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          copyImageLink(key, it.id, e);
                                        }}
                                        className={`w-8 h-8 ${
                                          DESIGN.radius.button
                                        } bg-white border-2 shadow-lg grid place-items-center transition-opacity ${
                                          isTouch
                                            ? 'opacity-0 pointer-events-none'
                                            : 'opacity-0 group-hover:opacity-100'
                                        }`}
                                        style={{ borderColor: DESIGN.colors.primaryBg }}
                                        title="copy link to image"
                                      >
                                        <Link2 className="w-4 h-4" strokeWidth={2} style={{ color: DESIGN.colors.primaryBg }} />
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            </React.Fragment>
                          ))}
                          {provided.placeholder}
                        </div>

                        <div className="relative z-20">
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
                  className={`p-3 ${DESIGN.radius.button} border-2 border-white text-white hover:bg-white/10 transition-colors`}
                  title="load 60 more days"
                >
                  <ChevronRight className="w-5 h-5" strokeWidth={2} />
                </button>
              </div>
            )}
          </div>
        </div>
      </DragDropContext>

      {viewer && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-8"
          onClick={() => setViewer(null)}
        >
          {/* Close X button - visually separated at top right of screen */}
          <button
            onClick={() => setViewer(null)}
            className={`fixed top-4 right-4 z-[60] w-12 h-12 ${DESIGN.radius.button} bg-white/10 hover:bg-white/20 backdrop-blur-sm border-2 border-white/20 grid place-items-center transition-all`}
            title="close"
            aria-label="close"
          >
            <X className="w-6 h-6 text-white" strokeWidth={2} />
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
                className={`max-w-full max-h-[60vh] object-contain ${DESIGN.radius.column} ${DESIGN.shadows.image}`}
              />

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteConfirm({ dayKey: viewer.dayKey, id: viewer.id });
                }}
                className={`absolute top-3 left-3 z-10 w-10 h-10 ${
                  DESIGN.radius.button
                } bg-red-600 text-white shadow-lg grid place-items-center ${
                  isTouch ? '' : 'opacity-0 group-hover:opacity-100'
                } transition-opacity`}
                title="delete"
                aria-label="delete"
              >
                <Trash2 className="w-5 h-5" strokeWidth={2} />
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
                  className={`w-10 h-10 ${
                    DESIGN.radius.button
                  } grid place-items-center bg-white border-2 shadow-lg`}
                  style={{ borderColor: DESIGN.colors.primaryBg }}
                  title={viewer.fav ? 'unfavorite' : 'favorite'}
                  aria-label="favorite"
                >
                  <Star
                    className="w-5 h-5"
                    strokeWidth={2}
                    {...(viewer.fav ? { fill: DESIGN.colors.primaryBg, color: DESIGN.colors.primaryBg } : { color: DESIGN.colors.primaryBg })}
                  />
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    copyImageToClipboard(viewer, e);
                  }}
                  className={`w-10 h-10 ${DESIGN.radius.button} bg-white border-2 shadow-lg grid place-items-center`}
                  style={{ borderColor: DESIGN.colors.primaryBg }}
                  title="copy image"
                  aria-label="copy image"
                >
                  <Copy className="w-5 h-5" strokeWidth={2} style={{ color: DESIGN.colors.primaryBg }} />
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    copyImageLink(viewer.dayKey, viewer.id, e);
                  }}
                  className={`w-10 h-10 ${DESIGN.radius.button} bg-white border-2 shadow-lg grid place-items-center`}
                  style={{ borderColor: DESIGN.colors.primaryBg }}
                  title="copy link"
                  aria-label="copy link"
                >
                  <Link2 className="w-5 h-5" strokeWidth={2} style={{ color: DESIGN.colors.primaryBg }} />
                </button>
              </div>
            </motion.div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{
                duration: 0.25,
                delay: 0.1,
                ease: [0.16, 1, 0.3, 1],
              }}
              className={`w-full max-w-2xl p-4 ${DESIGN.radius.card} bg-white border-2`}
              style={{ borderColor: DESIGN.colors.primaryBg }}
              onClick={(e) => e.stopPropagation()}
            >
              <label className="block text-sm font-bold mb-2 uppercase" style={{ color: DESIGN.colors.primaryBg }}>
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
                className={`w-full px-3 py-2 ${DESIGN.radius.card} border-2 bg-white focus:bg-blue-50 outline-none min-h-[100px] resize-y normal-case`}
                style={{ borderColor: DESIGN.colors.primaryBg }}
              />
            </motion.div>
          </div>
        </motion.div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm grid place-items-center p-4">
          <div
            className={`w-full max-w-sm ${DESIGN.radius.modal} bg-white ${DESIGN.shadows.card} border-2 p-5 space-y-4`}
            style={{ borderColor: DESIGN.colors.primaryBg }}
          >
            <h3 className="text-lg font-bold uppercase" style={{ color: DESIGN.colors.primaryBg }}>
              Delete Image?
            </h3>
            <p className="text-sm normal-case" style={{ color: DESIGN.colors.primaryBg }}>
              Are you sure you want to delete this image? This action cannot be
              undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className={`px-4 py-2 ${DESIGN.radius.card} border-2 hover:bg-gray-50 transition-colors uppercase font-bold text-sm`}
                style={{ borderColor: DESIGN.colors.primaryBg, color: DESIGN.colors.primaryBg }}
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
                  }
                }}
                className={`px-4 py-2 ${DESIGN.radius.card} text-white hover:opacity-90 transition-opacity uppercase font-bold text-sm`}
                style={{ backgroundColor: '#DC2626' }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showSlugPrompt && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm grid place-items-center p-4"
          role="dialog"
          aria-modal
        >
          <div
            className={`w-full max-w-sm ${DESIGN.radius.modal} bg-white ${DESIGN.shadows.card} border-2 p-5 space-y-3`}
            style={{ borderColor: DESIGN.colors.primaryBg }}
          >
            <div className="text-sm font-bold uppercase" style={{ color: DESIGN.colors.primaryBg }}>
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
              className={`w-full px-3 py-2 ${DESIGN.radius.card} border-2 bg-white focus:bg-blue-50 outline-none normal-case`}
              style={{ borderColor: DESIGN.colors.primaryBg }}
            />
            <div className="text-[12px] normal-case" style={{ color: DESIGN.colors.primaryBg }}>
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
                className={`px-3 py-1.5 ${DESIGN.radius.card} text-white disabled:opacity-50 uppercase font-bold text-sm hover:opacity-90 transition-opacity`}
                style={{ backgroundColor: DESIGN.colors.primaryBg }}
              >
                continue
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setShowHelp(true)}
        className={`fixed bottom-4 right-4 z-40 w-10 h-10 ${DESIGN.radius.button} border-2 border-white text-white hover:bg-white/10 grid place-items-center transition-colors`}
        title="help"
        aria-label="help"
      >
        <HelpCircle className="w-5 h-5" strokeWidth={2} />
      </button>
      {showHelp && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowHelp(false)}
          />
          <div
            className={`fixed bottom-16 right-4 z-50 w-72 ${DESIGN.radius.column} bg-white ${DESIGN.shadows.card} border-2 p-3 text-[12px]`}
            style={{ borderColor: DESIGN.colors.primaryBg, color: DESIGN.colors.primaryBg }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-bold mb-1 uppercase">quick tips</div>
            <ul className="list-disc pl-4 space-y-1 normal-case">
              <li>tap POSTBILLS logo to create/go to your board.</li>
              <li>copy your link with the link icon.</li>
              <li>drag images from desktop into a day.</li>
              <li>use filters to hide empty/past or show only favorites.</li>
              <li>tap TODAY to center the current date.</li>
              <li>tap outside this box to close.</li>
            </ul>
          </div>
        </>
      )}

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
              backgroundColor: DESIGN.colors.primaryBg,
            }}
            className="text-white text-xs px-3 py-1.5 rounded-xl shadow-lg font-bold whitespace-nowrap uppercase"
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

function ColumnAddBar({ dayKey, onFiles }) {
  const inputRef = useRef(null);
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
      <div className="pointer-events-none h-10" style={{ background: `linear-gradient(to top, ${DESIGN.colors.primaryBg}, transparent)` }} />
      <div className="absolute left-3 right-3 bottom-3">
        <button
          onClick={() => inputRef.current?.click()}
          className={`w-full py-3 ${DESIGN.radius.card} border-2 border-white text-white hover:bg-white/10 active:scale-[0.99] text-2xl leading-none font-bold transition-colors`}
          title="add images"
          aria-label="add images"
        >
          +
        </button>
      </div>
    </div>
  );
}
