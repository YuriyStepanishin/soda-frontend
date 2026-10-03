export type SummaryItem = {
  tm: string;
  group?: string;
  quantity?: number;
  stores: number;
  weight: number;
  amount: number;
  sku?: number;
};

export type SummaryResponse = {
  data: SummaryItem[];
  totals: {
    quantity?: number;
    stores: number;
    weight: number;
    amount: number;
    sku?: number;
  };
};
