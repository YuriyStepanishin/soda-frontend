import { apiPostFormData } from './client';

export interface StoreCheckPayload {
  date: string;
  ttName: string;
  address?: string;
  department?: string;
  representative?: string;
  princessa: number;
  greenfield: number;
  tess: number;
  tea_total: number;
  jockey: number;
  jardin: number;
  piazza: number;
  coffee_total: number;
  eliteFort: number;
  blackCard: number;
  ambassador: number;
  strauss_total: number;
  bonBoisson: number;
  chudoSad: number;
  water_total: number;
  fas_delicia: number;
  fas_other: number;
  tubus_delicia: number;
  tubus_other: number;
  small_delicia: number;
  small_other: number;
  weight_delicia: number;
  weight_other: number;
  delicia_total: number;
  other_total: number;
  domashne: number;
  malyuk: number;
  pryazhene: number;
  kakao: number;
  superMonika: number;
  riagel: number;
  artek: number;
  bisquit: number;
  fitness: number;
  bg: number;
  other_snacks: number;
  other_snacks_cookie?: number;
  other_snacks_pryanik?: number;
  drinks?: number;
  categoryOrimi?: string;
  categoryDelicia?: string;
  comment?: string;
  commentDelicia?: string;
}

interface StoreCheckResponse {
  success: boolean;
  error?: string;
  result?: {
    id?: string;
  };
}

interface StoreCheckPhotoPayload {
  department: string;
  representative: string;
  store: string;
  createdDate: string;
  photos: Array<{
    base64: string;
    type: string;
    name: string;
    capturedAt?: string;
    device?: string;
  }>;
}

export async function saveStoreCheck(
  payload: StoreCheckPayload
): Promise<StoreCheckResponse> {
  void payload;
  return {
    success: false,
    error:
      'Збереження StoreCheck метрик поки не реалізовано на новому бекенді.',
  };
}

export async function uploadStoreCheckPhoto(
  payload: StoreCheckPhotoPayload
): Promise<StoreCheckResponse> {
  try {
    for (const photo of payload.photos) {
      const fileBlob = await fetch(
        `data:${photo.type};base64,${photo.base64}`
      ).then(response => response.blob());

      const formData = new FormData();
      formData.append('photo', fileBlob, photo.name || 'storecheck.jpg');

      const data = await apiPostFormData<{
        success?: boolean;
        message?: string;
      }>('/api/upload/photos', formData, {
        authenticated: true,
      });

      if (!data.success) {
        return {
          success: false,
          error: data.message || 'Не вдалося завантажити фото StoreCheck.',
        };
      }
    }

    return { success: true };
  } catch (error) {
    console.error('uploadStoreCheckPhoto error:', error);

    return {
      success: false,
      error: 'Network error',
    };
  }
}
