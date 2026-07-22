import Dexie, { type Table } from 'dexie';
import type { Photo } from '../../types/photo';

class AppDB extends Dexie {
  photos!: Table<Photo, string>;

  constructor() {
    super('PhotoDB');

    this.version(1).stores({
      photos: 'id, status',
    });
  }
}

export const db = new AppDB();
