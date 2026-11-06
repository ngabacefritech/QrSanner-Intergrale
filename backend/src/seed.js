/**
 * Jeu de démonstration : quelques campagnes valides + événements de scan
 * aléatoires répartis sur les 14 derniers jours, pour un dashboard vivant.
 * Idempotent : ne fait rien si la base contient déjà des campagnes.
 */
import { db } from './db.js';
import { buildPayload, generateCampaignId } from './payload.js';

const count = db.prepare('SELECT COUNT(*) AS n FROM campaigns').get().n;
if (count > 0) {
  console.log(`Base déjà peuplée (${count} campagnes) : seed ignoré.`);
  process.exit(0);
}

const now = new Date().toISOString();
const campaigns = [
  {
    title: 'Marché Nzui — Soldes',
    description: 'Boutique de démonstration : image distante HTTPS.',
    mediaType: 'image',
    mediaUrl: 'https://picsum.photos/seed/qrscanner-nzui/1080/1920',
    durationSeconds: 10,
    allowEarlySkip: false,
  },
  {
    title: 'Café Bekolo',
    description: 'Ouverture 7h-19h, café torréfié sur place.',
    mediaType: 'image',
    mediaUrl: 'https://picsum.photos/seed/qrscanner-cafe/1080/1920',
    durationSeconds: 8,
    allowEarlySkip: true,
  },
  {
    title: 'Academy Foot — Inscriptions',
    description: 'Vidéo de promotion de la saison.',
    mediaType: 'video',
    mediaUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    fallbackUrl: 'https://picsum.photos/seed/qrscanner-foot/1080/1920',
    durationSeconds: 12,
    allowEarlySkip: false,
  },
  {
    title: 'Imprimerie Essos (inactive)',
    description: 'Campagne volontairement inactive pour tester le refus au scan.',
    mediaType: 'image',
    mediaUrl: 'https://picsum.photos/seed/qrscanner-impr/1080/1920',
    durationSeconds: 6,
    isActive: false,
    allowEarlySkip: true,
  },
];

const insertCampaign = db.prepare(
  `INSERT INTO campaigns (id, title, description, media_type, media_url, fallback_url,
    duration_seconds, is_active, allow_early_skip, created_at, updated_at)
   VALUES (@id, @title, @description, @mediaType, @mediaUrl, @fallbackUrl,
    @durationSeconds, @isActive, @allowEarlySkip, @createdAt, @updatedAt)`
);

const created = [];
for (const c of campaigns) {
  const id = generateCampaignId();
  const built = buildPayload({ ...c, id });
  if (!built.ok) {
    console.error('seed invalide :', built.errors);
    process.exit(1);
  }
  insertCampaign.run({
    id,
    title: c.title,
    description: c.description ?? null,
    mediaType: c.mediaType,
    mediaUrl: c.mediaUrl,
    fallbackUrl: c.fallbackUrl ?? null,
    durationSeconds: c.durationSeconds,
    isActive: c.isActive === false ? 0 : 1,
    allowEarlySkip: c.allowEarlySkip ? 1 : 0,
    createdAt: now,
    updatedAt: now,
  });
  created.push(id);
}

const platforms = ['ios', 'android', 'android', 'ios', 'android'];
const insertScan = db.prepare('INSERT INTO scans (campaign_id, scanned_at, platform, app_version, source) VALUES (?,?,?,?,?)');
let scans = 0;
for (let day = 13; day >= 0; day -= 1) {
  for (const id of created) {
    const perDay = Math.floor(Math.random() * 5) + (id === created[0] ? 2 : 0);
    for (let i = 0; i < perDay; i += 1) {
      const ts = new Date(Date.now() - day * 86_400_000 - Math.floor(Math.random() * 40_000_000)).toISOString();
      insertScan.run(id, ts, platforms[Math.floor(Math.random() * platforms.length)], '1.0.0', Math.random() > 0.25 ? 'embedded' : 'registry');
      scans += 1;
    }
  }
}
console.log(`Seed OK : ${created.length} campagnes, ${scans} scans répartis sur 14 jours.`);
console.log('Ids générés :', created.join(', '));
