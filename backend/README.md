# QRScanner — Backend (API des campagnes + statistiques)

Node 20+, Express 5, SQLite via `better-sqlite3` (aucun ORM). C'est la pièce qui relie la
**console web** (`dashboard/`) et l'**application mobile** (`../qrscanner/`) : elle stocke les
campagnes, fabrique le contenu des QR codes et agrège les scans.

> ⚠️ Le jeton admin par défaut (`qrscanner-dev-token`) est un secret de **démonstration**.
> Changez-le dès que l'API n'est plus strictement locale.

## Lancer

```bash
npm install
npm run seed      # 4 campagnes + ~120-150 scans de démo (ids aléatoires, 14 jours)
npm start         # → http://localhost:4000  (PORT=… pour changer)
```

Avec un jeton personnalisé :

```bash
ADMIN_TOKEN="un-jeton-long" PORT=4000 node src/index.js
# ou : cp .env.example .env  puis exporter les valeurs via votre process manager
```

La base SQLite est créée au premier lancement dans `backend/data/qrscanner.db`
(WAL). Chemin modifiable via `DATABASE_PATH` (ou `DATA_DIR`). Les tests, eux,
utilisent une base temporaire.

## Endpoints

| Méthode | Chemin | Auth | Rôle |
|---|---|---|---|
| GET | `/health` | — | vivacité + nombre de campagnes en base |
| GET | `/api/campaigns` | — | campagnes **actives** avec `qrText` (ce que lit le mobile) |
| POST | `/api/admin/scans` | — (rate-limit) | le mobile déclare un scan |
| GET | `/api/admin/campaigns` | jeton | toutes les campagnes + `qrText` prêt à encoder |
| POST | `/api/admin/campaigns` | jeton | créer (validation stricte du payload) |
| PUT | `/api/admin/campaigns/:id` | jeton | modifier / activer / arrêter |
| DELETE | `/api/admin/campaigns/:id` | jeton | supprimer (les scans suivent : `ON DELETE CASCADE`) |
| GET | `/api/admin/scans/:campaignId` | jeton | historique de scans d'une campagne |
| GET | `/api/admin/stats?days=7..90` | jeton | agrégats affichés par le dashboard |
| GET | `/api/admin/stats/export.csv` | jeton | export CSV ligne par ligne |

Auth : en-tête `X-Api-Key: <ADMIN_TOKEN>`. Réponse d'erreur : `{ "error": "…" }`,
ou `{ "errors": ["…", "…"] }` en 422 (validation de campagne).

### Déclaration d'un scan (mobile → API)

```http
POST /api/admin/scans
Content-Type: application/json

{ "campaignId": "E6PD5P9G", "platform": "ios", "appVersion": "1.0.0",
  "source": "embedded", "scannedAt": "2026-10-15T13:30:00.000Z" }
```

→ `201 { "recorded": true }`. `source` vaut `embedded` (QR autonome), `registry`
(identifiant court résolu via l'API), `direct-url` (URL scannée) — toute autre
valeur est normalisée en `unknown`. Aucun jeton n'est requis ici : l'endpoint est
volontairement public mais **limité à 120 événements/min/IP**, n'accepte qu'un
`campaignId` conforme existant et actif, et ne reçoit aucune donnée personnelle.

### Réponse de `/api/admin/stats`

```json
{
  "totals": { "scans": 123, "scansToday": 12, "campaigns": 4, "campaignsActive": 3 },
  "daily":  [{ "day": "2026-10-09", "scans": 13 }],
  "byPlatform": [{ "platform": "ios", "scans": 70 }],
  "bySource":   [{ "source": "embedded", "scans": 100 }],
  "perCampaign":[{ "id": "E6PD5P9G", "title": "…", "isActive": true,
                   "durationSeconds": 10, "scans": 41, "lastScan": "…" }]
}
```

`daily` est une **série continue** : les jours sans scan sont présents avec `0`
(l'axe du graphique du dashboard n'est donc pas trompeur).

## Le contrat du QR (« JSON embarqué »)

`src/payload.js` est le **propriétaire du format** ; le dashboard (`src/payload.ts`)
et le mobile (`src/services/embeddedQr.ts`) en sont des portages conformes.

```json
{"app":"qrscanner","v":1,"id":"E6PD5P9G","t":"Titre","m":0,"u":"https://…/a.jpg","d":10,"s":"desc","f":"https://…/repli.jpg","k":1}
```

- `id` : `/^[A-Z0-9][A-Z0-9_-]{3,20}$/` (8 caractères sans voyelles ambiguës par défaut)
- `t` 2–60, `s` ≤ 140 (tronqué), `d` entier 1–300, `m` `0` = image / `1` = vidéo
- `u` et `f` : **HTTPS obligatoire** (`http` toléré uniquement pour `localhost` / `127.0.0.1`),
  sans identifiants, sans port inhabituel, sans espace : `isValidMediaUrl()` refuse tout le reste
- taille totale ≤ **1600 octets UTF-8**, sinon `422` (un QR trop dense ne se scanne plus)

Le même enregistrement est aussi adressable par QR court `qrsc://<ID>` : la liste
publique renvoie `qrText` (le JSON) ; le mobile, lui, peut recevoir l'un ou l'autre.

## Sécurité (V1, usage LAN)

- Pas de TLS ici : à placer derrière un reverse-proxy HTTPS pour exposer hors réseau local.
- Aucun upload de fichier : le QR encode des **URL** de médias déjà hébergés.
- Corps de requête limité à 100 ko ; `express.json` seul ; pas de cookie, pas de session.
- Requêtes SQL préparées partout ; les identifiants et les textes sont validés avant insertion.
- Les entrées renvoyées au navigateur sont JSON (le dashboard échappe), l'export CSV échappe
  les champs contenant `"` `,` `;` ou saut de ligne.

## Tests

```bash
npm test           # node --test test/  → 17 tests (2 fichiers)
node --test test/payload.test.js   # contrat du QR, unité
node --test test/api.test.js       # API réelle, base SQLite temporaire, port éphémère
```

Aucune dépendance de test : `node:test` + `node:assert/strict`. `api.test.js`
importe `createApp()` (exportée par `src/index.js` à cet effet) après avoir posé
`DATABASE_PATH` et `ADMIN_TOKEN` dans l'environnement, écoute sur le port 0 et
vérifie : vivacité, refus sans jeton (401), validation (422), identifiant dupliqué
(409), liste publique filtrée sur les campagnes actives, déclaration de scan
(201 / 404 / 422), agrégats attendus par le dashboard, export CSV, suppressions.

## Structure

```text
backend/
├── src/index.js            # createApp() + démarrage conditionnel (npm start)
├── src/db.js               # better-sqlite3, WAL, schéma, rowToCampaign
├── src/payload.js          # PROTOTYPE du QR : buildPayload / parsePayload / isValidMediaUrl
├── src/seed.js             # jeu de démonstration (ids aléatoires, scans sur 14 jours)
├── src/middleware/auth.js  # requireAdmin (X-Api-Key), DEV_TOKEN
└── src/routes/{campaigns,scans,stats}.js
```
