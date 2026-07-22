export type UploadStatus = 'pending' | 'uploading' | 'done' | 'error';

export interface Photo {
  id: string;
  base64: string;
  type: string;
  name: string;
  capturedAt?: string;
  device?: string;
  status: UploadStatus;
}

export interface Attachment {
  url: string;
  type: string;
  name: string;
}
