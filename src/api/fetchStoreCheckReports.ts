export type StoreCheckTmSums = {
  tea: number;
  coffee: number;
  strauss: number;
  water: number;
  delicia: number;
  other: number;
  bg: number;
  snacks: number;
};

export type StoreCheckMetric = {
  label: string;
  value: string;
};

export type StoreCheckReport = {
  department: string;
  representative: string;
  store: string;
  date: string;
  category: 'storecheck';
  photos: string[];
  commentOrimi?: string;
  commentDelicia?: string;
  tmSums: StoreCheckTmSums;
  metrics: StoreCheckMetric[];
};

export async function fetchStoreCheckReports(): Promise<StoreCheckReport[]> {
  return [];
}
