import Dexie, { type Table } from 'dexie';

export type StoreCheckPhotoStatus = 'pending' | 'uploading' | 'done' | 'error';

export interface StoreCheckPhoto {
  id: string;
  base64: string;
  type: string;
  name: string;
  status: StoreCheckPhotoStatus;
  ttName: string;
  department: string;
  representative: string;
  date: string;
  device?: string;
  createdAt: number;
}

class StoreCheckPhotoDB extends Dexie {
  photos!: Table<StoreCheckPhoto, string>;

  constructor() {
    super('StoreCheckPhotoDB');

    this.version(1).stores({
      photos: 'id, status, ttName',
    });
  }
}

export const storeCheckPhotoDB = new StoreCheckPhotoDB();
