/**
 * Local Notifications for Favorited Events
 * Schedules iOS local notifications for events the user has favorited,
 * based on the dayKey (YYYY-MM-DD) each event is filed under.
 *
 * Two notifications per favorited future event:
 *   - 5 days before at 10:00 AM local time
 *   - Day-of at 9:00 AM local time (skipped if 9 AM has already passed)
 *
 * Images are written from the in-memory base64 data to a local temp file
 * because iOS notification attachments require local file:// URIs.
 */

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Filesystem, Directory } from '@capacitor/filesystem';
import type { Board } from './types';

/** Max scheduled notifications iOS allows */
const IOS_NOTIFICATION_LIMIT = 64;

/** Days in advance for the early reminder */
const ADVANCE_DAYS = 5;

/**
 * Deterministic 32-bit integer hash from a string.
 * Local notifications require numeric IDs.
 */
function hashToInt(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function notifId(itemId: string, type: 'advance' | 'day'): number {
  return hashToInt(`${itemId}_${type}`);
}

/** Short date like "2/19" */
function shortDate(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

/** YYYY-MM-DD for the local date */
function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Write a base64 data URI to a local cache file and return the file URI.
 * Returns null if the dataUrl isn't a valid base64 data URI or write fails.
 */
async function saveBase64ToFile(dataUrl: string, filename: string): Promise<string | null> {
  try {
    // Extract the raw base64 data from "data:image/jpeg;base64,/9j/4AAQ..."
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx < 0) return null;
    const base64Data = dataUrl.substring(commaIdx + 1);
    if (!base64Data) return null;

    const result = await Filesystem.writeFile({
      path: `notif_images/${filename}`,
      data: base64Data,
      directory: Directory.Cache,
      recursive: true,
    });

    return result.uri;
  } catch (err) {
    console.warn(`[notifications] failed to save image for ${filename}:`, err);
    return null;
  }
}

/**
 * Request notification permission on iOS.
 * No-ops silently on non-native platforms.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;

  const status = await LocalNotifications.checkPermissions();
  if (status.display === 'granted') return true;

  const result = await LocalNotifications.requestPermissions();
  return result.display === 'granted';
}

/**
 * Cancel all pending notifications then reschedule for every favorited
 * future event on the board.
 */
export async function scheduleEventNotifications(
  board: Board,
  slug: string,
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) return;

  // Cancel ALL existing scheduled notifications before rescheduling
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length > 0) {
    await LocalNotifications.cancel({ notifications: pending.notifications });
    console.log(`[notifications] cancelled ${pending.notifications.length} pending`);
  }

  const now = new Date();
  const today = todayKey();

  // Collect items that need notifications
  interface PendingNotif {
    id: number;
    title: string;
    body: string;
    schedule: { at: Date };
    extra: Record<string, string>;
    /** base64 data URI from the board item (already in memory) */
    base64DataUrl?: string;
    itemId: string;
  }
  const pendingNotifs: PendingNotif[] = [];

  for (const dayKey of Object.keys(board)) {
    const items = board[dayKey];
    for (const item of items) {
      if (!item.fav) continue;

      const eventDate = new Date(dayKey + 'T00:00:00');
      if (isNaN(eventDate.getTime())) continue;

      const date = shortDate(eventDate);
      // Use the base64 data URI that's already loaded in memory
      const base64 = item.dataUrl && item.dataUrl.startsWith('data:') ? item.dataUrl : undefined;

      // 5 days before at 10:00 AM
      const advanceDate = new Date(eventDate);
      advanceDate.setDate(advanceDate.getDate() - ADVANCE_DAYS);
      advanceDate.setHours(10, 0, 0, 0);

      if (advanceDate > now) {
        pendingNotifs.push({
          id: notifId(item.id, 'advance'),
          title: 'Reminder!',
          body: `Your starred event is coming up on ${date}`,
          schedule: { at: advanceDate },
          extra: { slug, dayKey, itemId: item.id },
          base64DataUrl: base64,
          itemId: item.id,
        });
      }

      // Day-of notification at 9:00 AM (skip if 9 AM has already passed)
      const dayOf = new Date(eventDate);
      dayOf.setHours(9, 0, 0, 0);

      if (dayOf > now) {
        pendingNotifs.push({
          id: notifId(item.id, 'day'),
          title: 'Reminder!',
          body: `Your starred event is today, ${date}`,
          schedule: { at: dayOf },
          extra: { slug, dayKey, itemId: item.id },
          base64DataUrl: base64,
          itemId: item.id,
        });
      }
    }
  }

  if (pendingNotifs.length === 0) return;

  // Sort soonest-first and cap at iOS limit
  pendingNotifs.sort(
    (a, b) => a.schedule.at.getTime() - b.schedule.at.getTime(),
  );
  const capped = pendingNotifs.slice(0, IOS_NOTIFICATION_LIMIT);

  // Write base64 images to local cache files for notification attachments
  const notifications: {
    id: number;
    title: string;
    body: string;
    schedule: { at: Date };
    extra: Record<string, string>;
    attachments?: { id: string; url: string }[];
  }[] = [];

  for (const n of capped) {
    let attachments: { id: string; url: string }[] | undefined;

    if (n.base64DataUrl) {
      const localUri = await saveBase64ToFile(n.base64DataUrl, `${n.itemId}.jpg`);
      if (localUri) {
        attachments = [{ id: `img_${n.itemId}`, url: localUri }];
      }
    }

    notifications.push({
      id: n.id,
      title: n.title,
      body: n.body,
      schedule: n.schedule,
      extra: n.extra,
      attachments,
    });
  }

  console.log(`[notifications] scheduling ${notifications.length} notifications`,
    notifications.map(n => ({ id: n.id, title: n.title, at: n.schedule.at.toISOString(), hasAttachment: !!n.attachments })));

  await LocalNotifications.schedule({ notifications });
}
