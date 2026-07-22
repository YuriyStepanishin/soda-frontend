export type SummaryItem = {
  tm: string;
  stores: number;
  weight: number;
  amount: number;
};

export type SummaryResponse = {
  data: SummaryItem[];
  totals: {
    stores: number;
    weight: number;
    amount: number;
  };
};
