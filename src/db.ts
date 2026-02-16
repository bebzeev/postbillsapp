/**
 * IndexedDB Manager for Offline Data Storage
 * Stores board data and queued Firebase operations for offline functionality
 */

const DB_NAME = 'postbills-db';
const DB_VERSION = 2;
const BOARDS_STORE = 'boards';
const QUEUE_STORE = 'syncQueue';
const IMAGE_CACHE_STORE = 'imageCache';

export interface ImageItem {
  id: string;
  name: string;
  dataUrl: string;
  fav: boolean;
  note: string;
  _order?: number;
}

export interface Board {
  [dayKey: string]: ImageItem[];
}

export interface BoardData {
  slug: string;
  board: Board;
  timestamp: number;
}

export interface QueuedOperation {
  id: string;
  type: 'add' | 'delete' | 'update' | 'reorder' | 'toggleFav';
  slug: string;
  timestamp: number;
  data: any;
  retries?: number;
}

let dbInstance: IDBDatabase | null = null;

/**
 * Opens or creates the IndexedDB database
 */
function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create boards store
      if (!db.objectStoreNames.contains(BOARDS_STORE)) {
        db.createObjectStore(BOARDS_STORE, { keyPath: 'slug' });
      }

      // Create sync queue store
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        const queueStore = db.createObjectStore(QUEUE_STORE, { keyPath: 'id' });
        queueStore.createIndex('timestamp', 'timestamp', { unique: false });
        queueStore.createIndex('slug', 'slug', { unique: false });
      }

      // Create image cache store (key: imageId, value: base64 dataUrl)
      if (!db.objectStoreNames.contains(IMAGE_CACHE_STORE)) {
        db.createObjectStore(IMAGE_CACHE_STORE, { keyPath: 'id' });
      }
    };
  });
}

/**
 * Saves board data to IndexedDB
 */
export async function saveBoard(slug: string, board: Board): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction([BOARDS_STORE], 'readwrite');
  const store = transaction.objectStore(BOARDS_STORE);

  const data: BoardData = {
    slug,
    board,
    timestamp: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const request = store.put(data);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Retrieves board data from IndexedDB
 */
export async function getBoard(slug: string): Promise<Board | null> {
  try {
    const db = await openDB();
    const transaction = db.transaction([BOARDS_STORE], 'readonly');
    const store = transaction.objectStore(BOARDS_STORE);

    return new Promise((resolve, reject) => {
      const request = store.get(slug);
      request.onsuccess = () => {
        const result = request.result as BoardData | undefined;
        resolve(result ? result.board : null);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn('Error getting board from IndexedDB:', error);
    return null;
  }
}

/**
 * Queues a Firebase operation for later processing
 */
export async function queueOperation(operation: Omit<QueuedOperation, 'id'>): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction([QUEUE_STORE], 'readwrite');
  const store = transaction.objectStore(QUEUE_STORE);

  const op: QueuedOperation = {
    ...operation,
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    retries: 0,
  };

  return new Promise((resolve, reject) => {
    const request = store.add(op);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Retrieves all queued operations for a specific slug
 */
export async function getQueuedOperations(slug: string): Promise<QueuedOperation[]> {
  try {
    const db = await openDB();
    const transaction = db.transaction([QUEUE_STORE], 'readonly');
    const store = transaction.objectStore(QUEUE_STORE);
    const index = store.index('slug');

    return new Promise((resolve, reject) => {
      const request = index.getAll(slug);
      request.onsuccess = () => {
        const operations = request.result as QueuedOperation[];
        // Sort by timestamp to maintain order
        operations.sort((a, b) => a.timestamp - b.timestamp);
        resolve(operations);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn('Error getting queued operations:', error);
    return [];
  }
}

/**
 * Removes a queued operation after successful processing
 */
export async function removeQueuedOperation(id: string): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction([QUEUE_STORE], 'readwrite');
  const store = transaction.objectStore(QUEUE_STORE);

  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Updates retry count for a failed operation
 */
export async function incrementOperationRetries(id: string): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction([QUEUE_STORE], 'readwrite');
  const store = transaction.objectStore(QUEUE_STORE);

  return new Promise((resolve, reject) => {
    const getRequest = store.get(id);
    getRequest.onsuccess = () => {
      const operation = getRequest.result as QueuedOperation;
      if (operation) {
        operation.retries = (operation.retries || 0) + 1;
        const putRequest = store.put(operation);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      } else {
        resolve();
      }
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
}

/**
 * Clears all queued operations for a specific slug
 */
export async function clearQueue(slug: string): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction([QUEUE_STORE], 'readwrite');
  const store = transaction.objectStore(QUEUE_STORE);
  const index = store.index('slug');

  return new Promise((resolve, reject) => {
    const request = index.getAllKeys(slug);
    request.onsuccess = () => {
      const keys = request.result;
      let pending = keys.length;
      if (pending === 0) {
        resolve();
        return;
      }

      keys.forEach((key) => {
        const deleteRequest = store.delete(key);
        deleteRequest.onsuccess = () => {
          pending--;
          if (pending === 0) resolve();
        };
        deleteRequest.onerror = () => reject(deleteRequest.error);
      });
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Gets count of queued operations for a slug
 */
export async function getQueueCount(slug: string): Promise<number> {
  try {
    const operations = await getQueuedOperations(slug);
    return operations.length;
  } catch (error) {
    console.warn('Error getting queue count:', error);
    return 0;
  }
}

export interface CachedImage {
  id: string;
  dataUrl: string;
  timestamp: number;
}

/**
 * Caches an image as base64 data URL
 */
export async function cacheImage(id: string, dataUrl: string): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction([IMAGE_CACHE_STORE], 'readwrite');
    const store = transaction.objectStore(IMAGE_CACHE_STORE);

    const data: CachedImage = {
      id,
      dataUrl,
      timestamp: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const request = store.put(data);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn('Error caching image:', error);
  }
}

/**
 * Retrieves a cached image by ID
 */
export async function getCachedImage(id: string): Promise<string | null> {
  try {
    const db = await openDB();
    const transaction = db.transaction([IMAGE_CACHE_STORE], 'readonly');
    const store = transaction.objectStore(IMAGE_CACHE_STORE);

    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => {
        const result = request.result as CachedImage | undefined;
        resolve(result ? result.dataUrl : null);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn('Error getting cached image:', error);
    return null;
  }
}

/**
 * Retrieves multiple cached images by IDs
 */
export async function getCachedImages(ids: string[]): Promise<Map<string, string>> {
  const cache = new Map<string, string>();
  try {
    const db = await openDB();
    const transaction = db.transaction([IMAGE_CACHE_STORE], 'readonly');
    const store = transaction.objectStore(IMAGE_CACHE_STORE);

    await Promise.all(
      ids.map(
        (id) =>
          new Promise<void>((resolve) => {
            const request = store.get(id);
            request.onsuccess = () => {
              const result = request.result as CachedImage | undefined;
              if (result) {
                cache.set(id, result.dataUrl);
              }
              resolve();
            };
            request.onerror = () => resolve();
          })
      )
    );
  } catch (error) {
    console.warn('Error getting cached images:', error);
  }
  return cache;
}

/**
 * Removes a cached image
 */
export async function removeCachedImage(id: string): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction([IMAGE_CACHE_STORE], 'readwrite');
    const store = transaction.objectStore(IMAGE_CACHE_STORE);

    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn('Error removing cached image:', error);
  }
}

