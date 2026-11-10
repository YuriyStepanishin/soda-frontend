export type BackContext = {
  page: string; salesByDaysOrigin: 'home' | 'sales';
  showGallery: boolean; showStoreSelector: boolean; hasSelectedStore: boolean;
};
export function backDestination(context: BackContext) {
  if (context.showGallery) return 'close-gallery';
  if (context.showStoreSelector) return context.hasSelectedStore ? 'select-store' : 'close-selector';
  if (context.page === 'sales-by-days') return context.salesByDaysOrigin;
  return 'home';
}
