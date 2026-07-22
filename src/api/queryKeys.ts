export const queryKeys = {
  sales: ['sales'] as const,
  routes: ['routes'] as const,
  photoReports: ['photo-reports'] as const,
  messages: (userEmail: string | null) =>
    ['messages', userEmail ?? ''] as const,
  storeSelectorData: (source: string) =>
    ['store-selector-data', source] as const,
  storecheckReports: ['storecheck-reports'] as const,
  planTargets: ['plan-targets'] as const,
  infoBoardPlanTargets: ['info-board-plan-targets'] as const,
  homeSalesPreview: ['home-sales-preview'] as const,
  homePhotoReportsPreview: ['home-photo-reports-preview'] as const,
};
