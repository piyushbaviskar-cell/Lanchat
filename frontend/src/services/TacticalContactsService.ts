import { openDB, IDBPDatabase } from 'idb';

export type TransportType = 'LOCAL_MESH' | 'OPPORTUNISTIC_DTN' | 'LORA_GATEWAY' | 'WAN_RELAY';
export type TrustStatus = 'UNVERIFIED' | 'VERIFIED_IN_PERSON' | 'KEY_COLLISION_ALERT';

export interface TacticalContact {
  publicKeyFingerprint: string;
  rawPublicKey: string;
  declaredFullName: string;
  petname: string;
  isFavorite: boolean;
  trustStatus: TrustStatus;
  transportsAvailable: TransportType[];
  lastKnownVector: {
    timestamp: number;
    transport: string;
    rssi?: number;
  };
}

const DB_NAME = 'apex-tactical-db';
const STORE_NAME = 'contacts';
const DB_VERSION = 1;

class TacticalContactsService {
  private dbPromise: Promise<IDBPDatabase>;

  constructor() {
    this.dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'publicKeyFingerprint' });
          store.createIndex('isFavorite', 'isFavorite');
        }
      },
    });
  }

  async getAllContacts(): Promise<TacticalContact[]> {
    const db = await this.dbPromise;
    return db.getAll(STORE_NAME);
  }

  async getContact(fingerprint: string): Promise<TacticalContact | undefined> {
    const db = await this.dbPromise;
    return db.get(STORE_NAME, fingerprint);
  }

  async upsertContact(contact: TacticalContact): Promise<void> {
    const db = await this.dbPromise;
    await db.put(STORE_NAME, contact);
  }

  async updatePetname(fingerprint: string, petname: string): Promise<void> {
    const db = await this.dbPromise;
    const contact = await this.getContact(fingerprint);
    if (contact) {
      contact.petname = petname;
      await db.put(STORE_NAME, contact);
    }
  }

  async toggleFavorite(fingerprint: string, isFavorite: boolean): Promise<void> {
    const db = await this.dbPromise;
    const contact = await this.getContact(fingerprint);
    if (contact) {
      contact.isFavorite = isFavorite;
      await db.put(STORE_NAME, contact);
    }
  }

  async deleteContact(fingerprint: string): Promise<void> {
    const db = await this.dbPromise;
    await db.delete(STORE_NAME, fingerprint);
  }
}

export const tacticalContactsService = new TacticalContactsService();
