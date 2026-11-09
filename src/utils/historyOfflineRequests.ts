export const HISTORY_DETAIL_FIELDS = 'group,subgroup,tm,packing';

// Details include every grouping dimension so any UI grouping can be rebuilt offline.
export function completeHistoryDetailUrl(value: string): string | null {
  const url = new URL(value);
  if (url.pathname !== '/api/sales/route-history' || url.searchParams.get('view') !== 'details') return null;
  const fields = (url.searchParams.get('groupingFields') || '').split(',');
  if (!fields.length || fields.some(field => !HISTORY_DETAIL_FIELDS.split(',').includes(field))) return null;
  url.searchParams.set('groupingFields', HISTORY_DETAIL_FIELDS);
  url.searchParams.sort();
  return url.toString();
}

export function historyDetailRequests(listUrl: string, stores: Array<{ code?: string }>): string[] {
  return stores.flatMap(store => {
    if (store.code == null) return [];
    const url = new URL(listUrl);
    url.searchParams.set('view', 'details');
    url.searchParams.set('storeCode', store.code);
    url.searchParams.set('groupingFields', HISTORY_DETAIL_FIELDS);
    url.searchParams.sort();
    return [url.toString()];
  });
}
