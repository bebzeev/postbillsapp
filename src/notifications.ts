/**
 * Local Notifications for Favorited Events
 * Schedules iOS local notifications for events the user has favorited,
 * based on the dayKey (YYYY-MM-DD) each event is filed under.
 *
 * Two notifications per favorited future event:
 *   - 5 days before at 10:00 AM local time
 *   - Day-of at 9:00 AM local time (or immediately if the event is today
 *     and 9 AM has already passed)
 */

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
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
 * Returns a usable attachment URL (HTTPS only — data URIs don't work
 * for iOS notification attachments).
 */
function attachmentUrl(dataUrl: string | undefined): string | null {
  if (!dataUrl) return null;
  if (dataUrl.startsWith('https://')) return dataUrl;
  return null;
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
  const notifications: {
    id: number;
    title: string;
    body: string;
    schedule: { at: Date };
    extra: Record<string, string>;
    attachments?: { id: string; url: string }[];
  }[] = [];

  for (const dayKey of Object.keys(board)) {
    const items = board[dayKey];
    for (const item of items) {
      if (!item.fav) continue;

      const eventDate = new Date(dayKey + 'T00:00:00');
      if (isNaN(eventDate.getTime())) continue;

      const date = shortDate(eventDate);
      const imgUrl = attachmentUrl(item.imageURL);
      const attach = imgUrl
        ? [{ id: `img_${item.id}`, url: imgUrl }]
        : undefined;

      // 5 days before at 10:00 AM
      const advanceDate = new Date(eventDate);
      advanceDate.setDate(advanceDate.getDate() - ADVANCE_DAYS);
      advanceDate.setHours(10, 0, 0, 0);

      if (advanceDate > now) {
        notifications.push({
          id: notifId(item.id, 'advance'),
          title: `Reminder! Your starred event is coming up on ${date}`,
          body: '',
          schedule: { at: advanceDate },
          extra: { slug, dayKey, itemId: item.id },
          attachments: attach,
        });
      }

      // Day-of notification
      if (dayKey === today) {
        // Event is TODAY — fire immediately (5 seconds from now so iOS accepts it)
        notifications.push({
          id: notifId(item.id, 'day'),
          title: `Reminder! Your starred event is today, ${date}`,
          body: '',
          schedule: { at: new Date(Date.now() + 5_000) },
          extra: { slug, dayKey, itemId: item.id },
          attachments: attach,
        });
      } else {
        // Future day — schedule for 9:00 AM that day
        const dayOf = new Date(eventDate);
        dayOf.setHours(9, 0, 0, 0);

        if (dayOf > now) {
          notifications.push({
            id: notifId(item.id, 'day'),
            title: `Reminder! Your starred event is today, ${date}`,
            body: '',
            schedule: { at: dayOf },
            extra: { slug, dayKey, itemId: item.id },
            attachments: attach,
          });
        }
      }
    }
  }

  if (notifications.length === 0) return;

  // Sort soonest-first and cap at iOS limit
  notifications.sort(
    (a, b) => a.schedule.at.getTime() - b.schedule.at.getTime(),
  );
  const capped = notifications.slice(0, IOS_NOTIFICATION_LIMIT);

  console.log(`[notifications] scheduling ${capped.length} notifications`,
    capped.map(n => ({ id: n.id, title: n.title, at: n.schedule.at.toISOString(), hasAttachment: !!n.attachments })));
  await LocalNotifications.schedule({ notifications: capped });
}
