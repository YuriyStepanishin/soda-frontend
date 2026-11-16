export type BackgroundRequest = { url: string; savedAt: number };

export async function refreshSalesQueue(args: {
  requests: BackgroundRequest[];
  read: (url: string, signal: AbortSignal) => Promise<unknown>;
  signal: AbortSignal;
  isCurrent: () => boolean;
  yieldToForeground: () => Promise<void>;
  now?: () => number;
}): Promise<boolean> {
  const now = args.now ?? Date.now;
  let successful = true;
  for (const request of args.requests) {
    if (args.signal.aborted || !args.isCurrent()) return false;
    if (now() - request.savedAt < 15 * 60 * 1000) continue;
    await args.yieldToForeground();
    if (args.signal.aborted || !args.isCurrent()) return false;
    // One failed store must not block caching the remaining stores. Abort and
    // tenant/session changes are still checked before every next request.
    try { await args.read(request.url, args.signal); } catch {
      successful = false;
      if (args.signal.aborted || !args.isCurrent()) return false;
    }
  }
  return successful;
}
