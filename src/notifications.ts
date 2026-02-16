/**
 * Local Notifications for Favorited Events
 * Schedules iOS local notifications for events the user has favorited,
 * based on the dayKey (YYYY-MM-DD) each event is filed under.
 *
 * Two notifications per favorited future event:
 *   - 7 days before at 10:00 AM local time
 *   - Day-of at 9:00 AM local time
 */

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { Board } from './types';

/** Max scheduled notifications iOS allows */
const IOS_NOTIFICATION_LIMIT = 64;

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

function notifId(itemId: string, type: 'week' | 'day'): number {
  return hashToInt(`${itemId}_${type}`);
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
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

  // Cancel existing scheduled notifications
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length > 0) {
    await LocalNotifications.cancel({ notifications: pending.notifications });
  }

  const now = new Date();
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

      const label = item.name || 'Event';
      const dateStr = formatDate(eventDate);
      const imgUrl = attachmentUrl(item.dataUrl);
      const attach = imgUrl
        ? [{ id: `img_${item.id}`, url: imgUrl }]
        : undefined;

      // 7 days before at 10:00 AM
      const weekBefore = new Date(eventDate);
      weekBefore.setDate(weekBefore.getDate() - 7);
      weekBefore.setHours(10, 0, 0, 0);

      if (weekBefore > now) {
        notifications.push({
          id: notifId(item.id, 'week'),
          title: `${label} in 1 week`,
          body: `Your favorited event is coming up on ${dateStr}`,
          schedule: { at: weekBefore },
          extra: { slug, dayKey, itemId: item.id },
          attachments: attach,
        });
      }

      // Day-of at 9:00 AM
      const dayOf = new Date(eventDate);
      dayOf.setHours(9, 0, 0, 0);

      if (dayOf > now) {
        notifications.push({
          id: notifId(item.id, 'day'),
          title: `${label} is today!`,
          body: `Your favorited event is happening today, ${dateStr}`,
          schedule: { at: dayOf },
          extra: { slug, dayKey, itemId: item.id },
          attachments: attach,
        });
      }
    }
  }

  if (notifications.length === 0) return;

  // Sort soonest-first and cap at iOS limit
  notifications.sort(
    (a, b) => a.schedule.at.getTime() - b.schedule.at.getTime(),
  );
  const capped = notifications.slice(0, IOS_NOTIFICATION_LIMIT);

  await LocalNotifications.schedule({ notifications: capped });
}
