import { createRxDatabase } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';

export const initDB = async () => {
  // 1. Buat Database
  const db = await createRxDatabase({
    name: 'tododb_notify', // Rename for clean start
    storage: getRxStorageDexie() // Penyimpanan berbasis IndexedDB
  });

  // 2. Tambahkan Koleksi dengan Skema
  await db.addCollections({
    todos: {
      schema: {
        title: 'todo schema',
        version: 0,
        primaryKey: 'id',
        type: 'object',
        properties: {
          id: { type: 'string', maxLength: 100 },
          text: { type: 'string' },
          done: { type: 'boolean' },
          createdAt: { type: 'number' },
          notificationId: { type: 'number' }, // ID for canceling
          reminderTime: { type: 'number' }    // Timestamp
        },
        required: ['id', 'text', 'done', 'createdAt']
      }
    }
  });

  return db;
};
