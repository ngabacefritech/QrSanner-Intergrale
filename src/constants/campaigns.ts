/**
 * Registre LOCAL de campagnes de démonstration.
 *
 * ⚠️ Données fictives : les titres, marques et visuels sont inventés pour la démo.
 * Les médias `asset:` sont des fichiers réels présents dans ./assets/.
 * Ce module ne doit contenir AUCUNE clé secrète (voir README, section Sécurité).
 */
import type { CampaignRecord } from '../types/campaign';

/** Identifiants stables utilisés par les QR codes de test. */
export const DEMO_CAMPAIGN_IDS = {
  localImage: 'DEMO-IMAGE-001',
  localVideo: 'DEMO-VIDEO-001',
  remoteImage: 'DEMO-IMAGE-REMOTE-002',
  remoteVideo: 'DEMO-VIDEO-REMOTE-002',
  inactive: 'DEMO-INACTIVE-001',
  badUrl: 'DEMO-BADURL-001',
} as const;

export const DEMO_CAMPAIGNS: readonly CampaignRecord[] = [
  {
    id: DEMO_CAMPAIGN_IDS.localImage,
    title: 'Marché Nzui — Soldes d’octobre',
    qrCodeValue: 'https://qrscanner.local/demo/nzui-market',
    mediaType: 'image',
    mediaSource: { kind: 'asset', assetKey: require('../../assets/images/demo-ad.png') },
    durationSeconds: 10,
    isActive: true,
    createdAt: '2026-10-01T08:00:00.000Z',
    description: 'Publicité image embarquée dans l’application (fonctionne hors ligne).',
    allowEarlySkip: false,
    allowDirectUrlMedia: false,
  },
  {
    id: DEMO_CAMPAIGN_IDS.localVideo,
    title: 'Démo vidéo Expo',
    qrCodeValue: 'qrscanner://campaign/DEMO-VIDEO-001',
    mediaType: 'video',
    mediaSource: { kind: 'asset', assetKey: require('../../assets/videos/demo-ad.mp4') },
    durationSeconds: 12,
    isActive: true,
    createdAt: '2026-10-01T09:30:00.000Z',
    description:
      'Lecture MP4 via expo-video avec image de repli locale si la vidéo est illisible, puis retour automatique au scanner.',
    fallbackImage: { kind: 'asset', assetKey: require('../../assets/images/fallback-ad.png') },
    allowEarlySkip: false,
    allowDirectUrlMedia: false,
  },
  {
    id: DEMO_CAMPAIGN_IDS.remoteImage,
    title: 'Image distante (test HTTPS)',
    qrCodeValue: 'https://qrscanner.local/demo/remote-image',
    mediaType: 'image',
    // Chargée uniquement si l'appareil a accès à Internet ; sinon : repli propre et retour au scanner.
    mediaSource: { kind: 'remote', url: 'https://picsum.photos/seed/qrscanner/1080/1920' },
    durationSeconds: 8,
    isActive: true,
    createdAt: '2026-10-02T10:00:00.000Z',
    description: 'Démo du chargement d’une image distante HTTPS (image aléatoire picsum.photos).',
    fallbackImage: { kind: 'asset', assetKey: require('../../assets/images/fallback-ad.png') },
    allowEarlySkip: true,
    allowDirectUrlMedia: false,
  },
  {
    id: DEMO_CAMPAIGN_IDS.remoteVideo,
    title: 'Vidéo distante (inactive)',
    qrCodeValue: 'https://qrscanner.local/demo/remote-video',
    mediaType: 'video',
    mediaSource: {
      kind: 'remote',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    },
    durationSeconds: 15,
    isActive: false,
    createdAt: '2026-10-02T11:00:00.000Z',
    description: 'Campagne inactive : sert à vérifier le refus « publicité désactivée » au scan.',
    allowEarlySkip: true,
    allowDirectUrlMedia: false,
  },
  {
    id: DEMO_CAMPAIGN_IDS.inactive,
    title: 'Campagne désactivée',
    qrCodeValue: 'https://qrscanner.local/demo/campagne-inactive',
    mediaType: 'image',
    mediaSource: { kind: 'asset', assetKey: require('../../assets/images/fallback-ad.png') },
    durationSeconds: 6,
    isActive: false,
    createdAt: '2026-10-02T12:00:00.000Z',
    description: 'Campagne volontairement inactive pour tester le rejet des publicités désactivées.',
    allowEarlySkip: true,
    allowDirectUrlMedia: false,
  },
  {
    id: DEMO_CAMPAIGN_IDS.badUrl,
    title: 'URL non sécurisée (rejet attendu)',
    // Le QR encode exactement cette valeur : l'étape « valeur enregistrée » réussit,
    // mais le média est refusé par la politique de sécurité à l'affichage.
    qrCodeValue: 'http://localhost:8080/ad.png',
    mediaType: 'image',
    // port non standard hors localhost : refusé par validateMediaUrl à l'affichage
    mediaSource: { kind: 'remote', url: 'http://qrscanner.local:8080/ad.png' },
    durationSeconds: 8,
    isActive: true,
    createdAt: '2026-10-02T13:00:00.000Z',
    description: 'Campagne « piégée » : son média en HTTP est refusé par la validation de sécurité.',
    allowEarlySkip: true,
    allowDirectUrlMedia: false,
  },
];
