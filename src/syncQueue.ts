/**
 * Sync Queue Manager
 * Processes queued Firebase operations when online
 */

import {
  getFirestore,
  doc,
  setDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { getStorage, ref as sRef, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';
import {
  getQueuedOperations,
  removeQueuedOperation,
  incrementOperationRetries,
  QueuedOperation,
} from './db';

const MAX_RETRIES = 3;

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

export interface SyncEvent {
  status: SyncStatus;
  message?: string;
  queueCount?: number;
}

type SyncCallback = (event: SyncEvent) => void;

let syncCallbacks: SyncCallback[] = [];

/**
 * Subscribe to sync status updates
 */
export function onSyncStatusChange(callback: SyncCallback): () => void {
  syncCallbacks.push(callback);
  return () => {
    syncCallbacks = syncCallbacks.filter((cb) => cb !== callback);
  };
}

/**
 * Emit sync status event to all subscribers
 */
function emitSyncStatus(event: SyncEvent): void {
  syncCallbacks.forEach((callback) => callback(event));
}

/**
 * Process all queued operations for a specific board
 */
export async function processSyncQueue(
  slug: string,
  db: ReturnType<typeof getFirestore>,
  storage: ReturnType<typeof getStorage>
): Promise<void> {
  const operations = await getQueuedOperations(slug);

  if (operations.length === 0) {
    emitSyncStatus({ status: 'idle', queueCount: 0 });
    return;
  }

  emitSyncStatus({ status: 'syncing', queueCount: operations.length });

  let successCount = 0;
  let errorCount = 0;

  for (const operation of operations) {
    try {
      await processOperation(operation, slug, db, storage);
      await removeQueuedOperation(operation.id);
      successCount++;
    } catch (error) {
      console.error('Failed to process operation:', operation, error);
      errorCount++;

      // Increment retry count
      if ((operation.retries || 0) < MAX_RETRIES) {
        await incrementOperationRetries(operation.id);
      } else {
        // Max retries exceeded - keep in queue but log
        console.error('Max retries exceeded for operation:', operation);
      }
    }
  }

  const remainingOps = await getQueuedOperations(slug);

  if (errorCount > 0) {
    emitSyncStatus({
      status: 'error',
      message: `Synced ${successCount} of ${operations.length} changes`,
      queueCount: remainingOps.length,
    });
  } else {
    emitSyncStatus({
      status: 'success',
      message: `Synced ${successCount} changes`,
      queueCount: remainingOps.length,
    });
    // Auto-clear success status after delay
    setTimeout(() => {
      emitSyncStatus({ status: 'idle', queueCount: remainingOps.length });
    }, 3000);
  }
}

/**
 * Process a single queued operation
 */
async function processOperation(
  operation: QueuedOperation,
  slug: string,
  db: ReturnType<typeof getFirestore>,
  storage: ReturnType<typeof getStorage>
): Promise<void> {
  switch (operation.type) {
    case 'add':
      await processAddOperation(operation, slug, db, storage);
      break;
    case 'delete':
      await processDeleteOperation(operation, slug, db, storage);
      break;
    case 'update':
      await processUpdateOperation(operation, slug, db);
      break;
    case 'toggleFav':
      await processToggleFavOperation(operation, slug, db);
      break;
    case 'reorder':
      await processReorderOperation(operation, slug, db);
      break;
    default:
      console.warn('Unknown operation type:', operation);
  }
}

/**
 * Process add image operation
 */
async function processAddOperation(
  operation: QueuedOperation,
  slug: string,
  db: ReturnType<typeof getFirestore>,
  storage: ReturnType<typeof getStorage>
): Promise<void> {
  const { entries, dayKey, startOrder } = operation.data;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const storageRef = sRef(storage, `boards/${slug}/${entry.id}.jpg`);

    // Upload image
    await uploadString(storageRef, entry.dataUrl, 'data_url', {
      contentType: 'image/jpeg',
    });

    const imageURL = await getDownloadURL(storageRef);

    // Save to Firestore
    await setDoc(doc(db, 'boards', slug, 'items', entry.id), {
      id: entry.id,
      name: entry.name,
      dayKey,
      order: startOrder + i,
      imageURL,
      fav: false,
      note: '',
      createdAt: serverTimestamp(),
    });
  }
}

/**
 * Process delete image operation
 */
async function processDeleteOperation(
  operation: QueuedOperation,
  slug: string,
  db: ReturnType<typeof getFirestore>,
  storage: ReturnType<typeof getStorage>
): Promise<void> {
  const { id } = operation.data;

  // Delete from Firestore
  await deleteDoc(doc(db, 'boards', slug, 'items', id));

  // Try to delete from Storage (may fail if doesn't exist)
  try {
    await deleteObject(sRef(storage, `boards/${slug}/${id}.jpg`));
  } catch (error) {
    // Ignore storage deletion errors
    console.warn('Storage delete failed (may not exist):', error);
  }
}

/**
 * Process update note operation
 */
async function processUpdateOperation(
  operation: QueuedOperation,
  slug: string,
  db: ReturnType<typeof getFirestore>
): Promise<void> {
  const { id, dayKey, note } = operation.data;

  await setDoc(
    doc(db, 'boards', slug, 'items', id),
    { note, dayKey },
    { merge: true }
  );
}

/**
 * Process toggle favorite operation
 */
async function processToggleFavOperation(
  operation: QueuedOperation,
  slug: string,
  db: ReturnType<typeof getFirestore>
): Promise<void> {
  const { id, dayKey, fav, reorderedItems } = operation.data;

  const batch = writeBatch(db);

  // Update favorite status
  batch.update(doc(db, 'boards', slug, 'items', id), { fav, dayKey });

  // Update order of all items in the day
  if (reorderedItems && Array.isArray(reorderedItems)) {
    reorderedItems.forEach((item: any, index: number) => {
      batch.update(doc(db, 'boards', slug, 'items', item.id), {
        order: index,
        dayKey,
      });
    });
  }

  await batch.commit();
}

/**
 * Process reorder operation (drag and drop)
 */
async function processReorderOperation(
  operation: QueuedOperation,
  slug: string,
  db: ReturnType<typeof getFirestore>
): Promise<void> {
  const { sourceKey, destKey, sourceItems, destItems } = operation.data;

  const batch = writeBatch(db);

  // Update all source items
  if (sourceItems && Array.isArray(sourceItems)) {
    sourceItems.forEach((item: any, index: number) => {
      batch.update(doc(db, 'boards', slug, 'items', item.id), {
        order: index,
        dayKey: sourceKey,
      });
    });
  }

  // Update all destination items (if different from source)
  if (destKey !== sourceKey && destItems && Array.isArray(destItems)) {
    destItems.forEach((item: any, index: number) => {
      batch.update(doc(db, 'boards', slug, 'items', item.id), {
        order: index,
        dayKey: destKey,
      });
    });
  }

  await batch.commit();
}

