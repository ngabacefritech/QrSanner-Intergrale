/**
 * Serveur API QRScanner.
 *   GET    /health                — vivacité
 *   GET    /api/campaigns         — liste publique (mobile) : campagnes actives
 *   …      /api/admin/*           — CRUD campagnes, scans, statistiques (jeton requis)
 * Si ADMIN_TOKEN n'est pas défini, un jeton de développement est utilisé.
 */
import { pathToFileURL } from 'node:url';
import express from 'express';
import cors from 'cors';
import { campaignsRouter } from './routes/campaigns.js';
import { scansRouter } from './routes/scans.js';
import { statsRouter } from './routes/stats.js';
import { adminToken, DEV_TOKEN } from './middleware/auth.js';
import { db } from './db.js';

/** Construit l'application (sans écouter de port : les tests l'importent ainsi). */
export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', false);
  app.use(cors({ origin: true }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (req, res) => {
    const n = db.prepare('SELECT COUNT(*) AS n FROM campaigns').get().n;
    res.json({ ok: true, campaignsInDb: n, time: new Date().toISOString() });
  });

  const campaigns = campaignsRouter();
  app.use('/api/campaigns', campaigns.public); // lecture publique (mobile)
  app.use('/api/admin/campaigns', campaigns); // CRUD (jeton)
  app.use('/api/admin/scans', scansRouter()); // POST public limité + historique admin
  app.use('/api/admin/stats', statsRouter()); // statistiques + export.csv

  app.use((err, req, res, next) => {
    if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Corps de requête trop volumineux.' });
    if (err instanceof SyntaxError) return res.status(400).json({ error: 'JSON invalide.' });
    console.error('[api] erreur inattendue :', err?.message ?? err);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  });

  return app;
}

function start() {
  const PORT = Number(process.env.PORT || 4000);
  createApp().listen(PORT, '0.0.0.0', () => {
    console.log(`✅ API QRScanner sur http://localhost:${PORT}`);
    if (!process.env.ADMIN_TOKEN) {
      console.log(`⚠️  ADMIN_TOKEN non défini : le jeton de développement « ${DEV_TOKEN} » est actif.`);
      console.log('    En production : ADMIN_TOKEN="un-jeton-long" PORT=4000 node src/index.js');
    }
    console.log(`    Jeton attendu : ${adminToken().slice(0, 6)}… (dashboard → champ « Jeton admin »)`);
  });
}

// Démarrage uniquement quand le module est exécuté directement (sinon : import des tests).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) start();
