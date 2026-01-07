import { openDB } from "idb";

const DB_NAME = "RecordingStorage";
const STORE_NAME = "chunks";

export const initDB = async () => {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, {
          keyPath: "id",
          autoIncrement: true,
        });
      }
    },
  });
};

export const recordingDb = {
  async addChunk(blob) {
    const db = await initDB();
    return db.add(STORE_NAME, { blob, timestamp: Date.now() });
  },

  async getAll() {
    const db = await initDB();
    return db.getAll(STORE_NAME);
  },

  async deleteChunk(ids) {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    await Promise.all([...ids.map((id) => tx.store.delete(id)), tx.done]);
  },

  async clearAll() {
    const db = await initDB();
    return db.clear(STORE_NAME);
  },
};
