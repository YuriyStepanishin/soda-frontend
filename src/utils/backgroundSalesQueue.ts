export type BackgroundRequest = { url: string; savedAt: number };

export async function refreshSalesQueue(args: {
  requests: BackgroundRequest[];
  read: (url: string, signal: AbortSignal) => Promise<unknown>;
  signal: AbortSignal;
  isCurrent: () => boolean;
  yieldToForeground: () => Promise<void>;
  now?: () => number;
}): Promise<void> {
  const now = args.now ?? Date.now;
  for (const request of args.requests) {
    if (args.signal.aborted || !args.isCurrent()) return;
    if (now() - request.savedAt < 15 * 60 * 1000) continue;
    await args.yieldToForeground();
    if (args.signal.aborted || !args.isCurrent()) return;
    try { await args.read(request.url, args.signal); } catch { return; }
  }
}
