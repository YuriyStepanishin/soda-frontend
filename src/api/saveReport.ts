import { apiPostFormData } from './client';

// тип фото
interface PhotoPayload {
  base64: string;
  type: string;
  name: string;
  capturedAt?: string;
  device?: string;
}

// універсальний тип
export interface SaveReportPayload {
  department: string;
  representative: string;
  store: string;

  startDate?: string;
  endDate?: string;
  createdDate?: string;

  category: string;
  comment: string;

  photos: PhotoPayload[];
  lat?: number;
  lng?: number;

  date?: string;
  folderUrl?: string;
}

interface ApiResponse {
  success: boolean;
  error?: string;
}

interface UploadPhotoResponse {
  success?: boolean;
  imageUrl?: string;
  message?: string;
}

// ← додаємо type
export async function saveReport(
  data: SaveReportPayload,
  type: 'display' | 'bonus',
  action: 'saveReport' | 'uploadPhoto' = 'saveReport'
): Promise<ApiResponse> {
  void type;
  void action;

  try {
    if (!data.photos || data.photos.length === 0) {
      return {
        success: false,
        error: 'Додайте хоча б одне фото для відправки.',
      };
    }

    for (const photo of data.photos) {
      const fileBlob = await fetch(
        `data:${photo.type};base64,${photo.base64}`
      ).then(response => response.blob());

      const formData = new FormData();
      formData.append('photo', fileBlob, photo.name || 'photo.jpg');

      const upload = await apiPostFormData<UploadPhotoResponse>(
        '/api/upload/photos',
        formData,
        {
          authenticated: true,
        }
      );

      if (!upload.success) {
        return {
          success: false,
          error: upload.message || 'Не вдалося завантажити фото на сервер.',
        };
      }
    }

    return { success: true };
  } catch (error) {
    console.error('saveReport error:', error);

    return {
      success: false,
      error: 'Network error',
    };
  }
}
