export const appConfig = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1',
  publicSiteUrl: process.env.NEXT_PUBLIC_PUBLIC_SITE_URL ?? 'http://localhost:3001',
} as const;
