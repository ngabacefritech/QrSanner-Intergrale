/** Types partagés du dashboard (miroir strict du payload du backend). */

export type MediaType = 'image' | 'video';

export interface Campaign {
  id: string;
  title: string;
  description: string | null;
  mediaType: MediaType;
  mediaUrl: string;
  fallbackUrl: string | null;
  durationSeconds: number;
  isActive: boolean;
  allowEarlySkip: boolean;
  createdAt: string;
  updatedAt: string;
  /** Texte complet à encoder dans le QR (produit par le backend). */
  qrText: string | null;
  qrBytes: number | null;
}

export interface CampaignDraft {
  id?: string;
  title: string;
  description: string;
  mediaType: MediaType;
  mediaUrl: string;
  fallbackUrl: string;
  durationSeconds: number;
  isActive: boolean;
  allowEarlySkip: boolean;
}

export interface StatsTotals {
  scans: number;
  scansToday: number;
  campaigns: number;
  campaignsActive: number;
}

export interface Stats {
  totals: StatsTotals;
  daily: { day: string; scans: number }[];
  byPlatform: { platform: string; scans: number }[];
  bySource: { source: string; scans: number }[];
  perCampaign: {
    id: string;
    title: string;
    isActive: boolean;
    durationSeconds: number;
    scans: number;
    lastScan: string | null;
  }[];
}

export interface ScanEvent {
  scanned_at: string;
  platform: string | null;
  app_version: string | null;
  source: string;
}
