import type { ReactNode } from 'react';

// Match the pictograms previously shown on the SODA home screen.
const shapes: Record<string, ReactNode> = {
  dictionaries: <><rect x="3" y="4" width="8" height="16" rx="1"/><rect x="13" y="4" width="8" height="16" rx="1"/><path d="M5 8h4M15 8h4M5 12h4M15 12h4"/></>,
  sales: <path d="M4 20V12M10 20V7M16 20v-5M22 20V3"/>,
  'sales-by-days': <path d="M3 3v18h18M7 15l4-5 4 3 5-7"/>,
  'route-history': <><circle cx="6" cy="16" r="3"/><circle cx="18" cy="7" r="3"/><path d="M9 16h5a4 4 0 0 0 4-4v-2"/></>,
  motivation: <><path d="m3 17 6-6 4 4 8-9"/><path d="M15 6h6v6"/></>,
  'plan-targets': <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></>,
  receivables: <><rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 10h18M7 3v4M17 3v4M7 15h4M15 15h2"/></>,
  gallery: <><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 6-6 4 4 3-3 5 5"/></>,
  'photo-gallery': <><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 6-6 4 4 3-3 5 5"/></>,
  'photo-reports': <><path d="M3 7h4l2-3h6l2 3h4v13H3z"/><circle cx="12" cy="13" r="4"/></>,
  'bonus-report': <><path d="M3 7h4l2-3h6l2 3h4v13H3z"/><circle cx="12" cy="13" r="4"/></>,
  'display-report': <><path d="m3 11 13-6v14L3 14zM7 15l2 6h4l-2-5M16 10h4"/></>,
  'active-customer-base': <><path d="M4 20V5h16v15M8 9h8M8 13h8M8 17h5"/></>,
  implementation: <><path d="M4 20V4h16M8 15l4-4 3 2 5-7"/></>,
  messages: <><path d="M4 4h16v13H8l-4 4zM8 9h8M8 13h5"/></>,
  'store-check': <><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M8 12l3 3 5-6"/></>,
  'store-check-review': <><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M8 12l3 3 5-6"/></>,
};
export default function SectionIcon({ id }: { id: string }) {
  return <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {shapes[id] ?? shapes.dictionaries}
  </svg>;
}
