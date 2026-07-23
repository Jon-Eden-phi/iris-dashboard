import { Injectable, WritableSignal, effect, signal } from '@angular/core';

/**
 * Shared Data Room store.
 *
 * Files are held in one signal, persisted to IndexedDB (large capacity — data
 * URIs of uploaded PDFs blow past localStorage's ~5MB cap), and synced live
 * across browser tabs/windows via BroadcastChannel.
 *
 * Every portal (TX, Legal, Client) points its `dataRoom` signal at this single
 * instance, so an upload in one portal is immediately visible in the others.
 */
export interface DataRoomFile {
  id: string;
  propertyId: string;
  docType: string;
  fileName: string;
  uploadedBy: string;
  uploadedAt: string;
  stage?: string;
  note?: string;
  url?: string | null;
}

const LEGACY_LS_KEY = 'iris_data_room';
const CHANNEL_NAME  = 'iris_data_room';
const DB_NAME       = 'iris_dataroom';
const STORE_NAME    = 'kv';
const ALL_KEY       = 'all';

@Injectable({ providedIn: 'root' })
export class DataRoomStore {
  /** The single source of truth. Portals bind their local signal to this. */
  readonly files: WritableSignal<DataRoomFile[]> = signal<DataRoomFile[]>([]);
  /** Resolves once the initial load from IndexedDB (or migration) is complete. */
  readonly ready: Promise<void>;

  private _lastJson: string | null = null;
  private _db: Promise<IDBDatabase | null>;
  private _channel: BroadcastChannel | null = null;
  /**
   * Guards against the effect firing with the initial empty signal value
   * before `_init()` has loaded from IndexedDB. Without it, a freshly-opened
   * tab would persist `[]` and broadcast `[]` to other tabs, wiping their
   * in-memory data room. Only local changes made after load should propagate.
   */
  private _initialized = false;

  constructor() {
    if (typeof BroadcastChannel !== 'undefined') {
      this._channel = new BroadcastChannel(CHANNEL_NAME);
      this._channel.onmessage = (ev) => void this._onRemote(ev.data);
    }
    this._db = this._openDb();
    this.ready = this._init();

    // Persist to IndexedDB on every local change, then notify other tabs with a
    // TINY signal — never the data itself. IndexedDB is shared across same-origin
    // tabs, so receivers reload from it. Broadcasting the whole dataset (base64
    // file blobs) to every tab on every change exhausted renderer memory.
    // Content-dedup (`_lastJson`) skips no-op writes and remote-applied states.
    effect(() => {
      const list = this.files();           // track dependency
      if (!this._initialized) return;       // don't propagate pre-load empty state
      const json = JSON.stringify(list);
      if (json === this._lastJson) return;
      this._lastJson = json;
      void this._persist(list);
      this._channel?.postMessage({ t: 'changed' });
    });
  }

  // ── internals ────────────────────────────────────────────────────────────

  private async _init(): Promise<void> {
    let list = await this._loadAll();

    // One-time migration: pull anything already sitting in localStorage.
    if (list.length === 0) {
      try {
        const legacy = JSON.parse(localStorage.getItem(LEGACY_LS_KEY) ?? '[]');
        if (Array.isArray(legacy) && legacy.length) {
          list = legacy;
          await this._persist(list);
        }
      } catch { /* ignore */ }
    }

    // Normalize a legacy em-dash typo in survey docTypes.
    list = list.map(f => ({ ...f, docType: (f.docType ?? '').replace('Survey Report — ', 'Survey Report - ') }));

    this._lastJson = JSON.stringify(list);
    this._initialized = true;
    this.files.set(list);

    // Free the localStorage slot now that data lives in IndexedDB.
    try { localStorage.removeItem(LEGACY_LS_KEY); } catch { /* ignore */ }
  }

  private async _onRemote(msg: unknown): Promise<void> {
    if (!msg || (msg as { t?: string }).t !== 'changed') return;
    // Another tab changed the data room. Reload the (small) delta from the
    // shared IndexedDB rather than receiving the payload over the channel.
    const list = await this._loadAll();
    const json = JSON.stringify(list);
    if (json === this._lastJson) return;
    this._lastJson = json;   // pre-set so our own effect skips re-persist/re-broadcast
    this.files.set(list);
  }

  private _openDb(): Promise<IDBDatabase | null> {
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
          if (!req.result.objectStoreNames.contains(STORE_NAME)) {
            req.result.createObjectStore(STORE_NAME);
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  private async _loadAll(): Promise<DataRoomFile[]> {
    const db = await this._db;
    if (!db) {
      try { return JSON.parse(localStorage.getItem(LEGACY_LS_KEY) ?? '[]'); } catch { return []; }
    }
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(ALL_KEY);
        req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
        req.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
  }

  private async _persist(list: DataRoomFile[]): Promise<void> {
    const db = await this._db;
    if (!db) {
      // Best-effort fallback; may overflow, but keeps single-tab demos alive.
      try { localStorage.setItem(LEGACY_LS_KEY, JSON.stringify(list)); } catch { /* quota */ }
      return;
    }
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(list, ALL_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }
}
