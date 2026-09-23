/**
 * RAM-Protected P2P Chunked File Transfer Service
 * Streams files in 64 KB slices over RTCDataChannel.
 * Bypasses heap RAM by streaming chunks straight into IndexedDB.
 */
export class IndexedDBStorage {
  private dbName = 'LanchatFileSystem';
  private storeName = 'IncomingFiles';
  private db: IDBDatabase | null = null;

  public async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      
      request.onerror = (event) => reject(`IndexedDB error: ${(event.target as any).error}`);
      
      request.onsuccess = (event) => {
        this.db = (event.target as any).result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as any).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          // 'fileId' is the unique transfer ID
          db.createObjectStore(this.storeName, { keyPath: 'fileId' });
        }
      };
    });
  }

  /**
   * Initializes a new file transfer record in DB.
   */
  public async initFileStorage(fileId: string, metadata: { name: string, size: number, totalChunks: number, expectedHash: string }): Promise<void> {
    if (!this.db) await this.initialize();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      const record = {
        fileId,
        metadata,
        chunks: [],
        receivedChunks: 0,
        isComplete: false
      };
      
      const request = store.put(record);
      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(`Storage error: ${(event.target as any).error}`);
    });
  }

  /**
   * Writes an incoming 64KB chunk directly to the IndexedDB record.
   */
  public async writeChunk(fileId: string, index: number, chunkData: ArrayBuffer): Promise<number> {
    if (!this.db) await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      const getReq = store.get(fileId);
      
      getReq.onsuccess = () => {
        const record = getReq.result;
        if (!record) {
          reject(new Error('File record not found'));
          return;
        }
        
        record.chunks[index] = chunkData;
        record.receivedChunks += 1;
        
        const putReq = store.put(record);
        putReq.onsuccess = () => resolve(record.receivedChunks);
        putReq.onerror = (e) => reject(`Chunk write error: ${(e.target as any).error}`);
      };
      
      getReq.onerror = (e) => reject(`Chunk read error: ${(e.target as any).error}`);
    });
  }

  /**
   * Assembles the full file from IndexedDB, verifies the SHA-256 hash, and returns a Blob URL.
   */
  public async assembleAndVerifyFile(fileId: string): Promise<string> {
    if (!this.db) await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const getReq = store.get(fileId);
      
      getReq.onsuccess = async () => {
        const record = getReq.result;
        if (!record) return reject(new Error('File record not found'));
        
        if (record.receivedChunks !== record.metadata.totalChunks) {
          return reject(new Error(`Missing chunks. Expected ${record.metadata.totalChunks}, got ${record.receivedChunks}`));
        }

        // Assemble Blob
        const blob = new Blob(record.chunks, { type: 'application/octet-stream' });
        
        // Compute SHA-256
        const buffer = await blob.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        
        if (hashHex !== record.metadata.expectedHash) {
          return reject(new Error(`Hash mismatch! Expected ${record.metadata.expectedHash}, got ${hashHex}. File corrupted or tampered.`));
        }

        const objectUrl = URL.createObjectURL(blob);
        resolve(objectUrl);
      };
      
      getReq.onerror = (e) => reject(`Assemble error: ${(e.target as any).error}`);
    });
  }

  /**
   * Client-side SHA-256 helper for the sender to calculate before transmitting.
   */
  public static async calculateFileHash(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}

export const indexedDBStorage = new IndexedDBStorage();
