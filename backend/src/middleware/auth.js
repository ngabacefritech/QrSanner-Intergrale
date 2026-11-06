/**
 * Auth simple par jeton (en-tête X-Api-Key). Suffisante pour un LAN de
 * démonstration ; en production placer derrière HTTPS + un vrai fournisseur
 * d'identité. Si ADMIN_TOKEN n'est pas défini, un jeton de dev est utilisé
 * et affiché au démarrage.
 */
export const DEV_TOKEN = 'qrscanner-dev-token';

export function adminToken() {
  return process.env.ADMIN_TOKEN || DEV_TOKEN;
}

export function requireAdmin(req, res, next) {
  const header = req.get('x-api-key') || '';
  const bearer = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const provided = header || bearer;
  if (!provided || provided.length > 512) return res.status(401).json({ error: 'Jeton admin manquant.' });
  const expected = adminToken();
  // comparaison en temps constant simple (taille identique d'abord)
  if (provided.length !== expected.length) return res.status(401).json({ error: 'Jeton admin invalide.' });
  let mismatch = 0;
  for (let i = 0; i < provided.length; i += 1) mismatch |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  if (mismatch !== 0) return res.status(401).json({ error: 'Jeton admin invalide.' });
  next();
}
