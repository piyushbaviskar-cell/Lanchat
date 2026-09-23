import { openDB, IDBPDatabase } from 'idb';

export interface DTNBundle {
  id: string; // UUID
  destFingerprint: string;
  sourceFingerprint: string;
  payload: ArrayBuffer;
  timestamp: number;
  ttl: number; // Expiry timestamp
  hopCount: number;
}

const DB_NAME = 'apex-dtn-db';
const STORE_NAME = 'outbox';
const DB_VERSION = 1;

export class DTNRouter {
  private dbPromise: Promise<IDBPDatabase>;

  constructor() {
    this.dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('destFingerprint', 'destFingerprint');
          store.createIndex('ttl', 'ttl');
        }
      },
    });
  }

  async queueBundle(dest: string, source: string, payload: ArrayBuffer, ttlMinutes = 60 * 24): Promise<void> {
    const db = await this.dbPromise;
    const bundle: DTNBundle = {
      id: crypto.randomUUID(),
      destFingerprint: dest,
      sourceFingerprint: source,
      payload,
      timestamp: Date.now(),
      ttl: Date.now() + (ttlMinutes * 60 * 1000),
      hopCount: 0
    };
    
    await db.put(STORE_NAME, bundle);
    console.log(`[DTN] Bundle ${bundle.id} queued for ${dest}.`);
  }

  // Called when connecting to a new peer via BLE/Wi-Fi Direct/STOMP
  async getBundlesForPeer(peerFingerprint: string): Promise<DTNBundle[]> {
    const db = await this.dbPromise;
    const tx = db.transaction(STORE_NAME, 'readonly');
    const index = tx.store.index('destFingerprint');
    
    // Get all bundles destined for this peer
    const bundles = await index.getAll(peerFingerprint);
    
    // Filter out expired bundles
    const now = Date.now();
    return bundles.filter(b => b.ttl > now);
  }

  async markBundleDelivered(bundleId: string): Promise<void> {
    const db = await this.dbPromise;
    await db.delete(STORE_NAME, bundleId);
    console.log(`[DTN] Bundle ${bundleId} delivered and purged from outbox.`);
  }

  // Periodic garbage collection
  async purgeExpiredBundles(): Promise<number> {
    const db = await this.dbPromise;
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.store;
    const index = store.index('ttl');
    
    const now = Date.now();
    let cursor = await index.openCursor();
    let purged = 0;
    
    while (cursor) {
      if (cursor.value.ttl <= now) {
        await cursor.delete();
        purged++;
      }
      cursor = await cursor.continue();
    }
    
    return purged;
  }
}

export const dtnRouter = new DTNRouter();
