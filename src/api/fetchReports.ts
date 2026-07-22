export type Report = {
  department: string;
  representative: string;
  store: string;
  date: string;
  category: string;
  photos: unknown;
  comment?: string;
};

export async function fetchReports(): Promise<Report[]> {
  return [];
}

export function extractDriveId(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';

  const fromQuery = trimmed.match(/[?&]id=([^&]+)/)?.[1] ?? '';
  const fromPath = trimmed.match(/\/d\/([^/]+)/)?.[1] ?? '';
  const rawId = fromQuery || fromPath;

  return rawId.match(/[A-Za-z0-9_-]+/)?.[0] ?? '';
}

export function buildImageSources(url: string): string[] {
  const trimmed = url.trim();
  if (!trimmed) return [];

  const driveId = extractDriveId(trimmed);
  if (!driveId) return [trimmed];

  return [
    `https://lh3.googleusercontent.com/d/${driveId}=w1600`,
    `https://drive.google.com/uc?export=view&id=${driveId}`,
    `https://drive.google.com/thumbnail?id=${driveId}&sz=w1600`,
  ];
}

export function normalizePhotoUrls(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.map(item => String(item ?? '').trim()).filter(Boolean);
  }

  if (typeof input !== 'string') {
    return [];
  }

  const raw = input.trim();
  if (!raw) return [];

  if (raw.startsWith('[') && raw.endsWith(']')) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map(item => String(item ?? '').trim()).filter(Boolean);
      }
    } catch {
      // Fallback below.
    }
  }

  return raw
    .split(/[\n,;]+/)
    .map(item => item.trim())
    .filter(Boolean);
}

export async function deletePhoto(driveId: string): Promise<void> {
  void driveId;
  throw new Error('Ендпойнт видалення фото відсутній на новому бекенді.');
}
