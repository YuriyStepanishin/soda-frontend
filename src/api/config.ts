// Base backend URL comes from Vite env, e.g. VITE_API_URL in .env.local.
export const API_BASE_URL = import.meta.env.VITE_API_URL;

// Local storage keys used by auth/session helpers.
export const AUTH_STORAGE_KEY = 'auth';
export const AUTH_TOKEN_KEY = 'authToken';
export const AUTH_USER_KEY = 'authUser';
