# QRScanner — Console web (tableau de bord publicitaire)

Interface d'administration des campagnes : **créer une campagne, imprimer son QR code,
suivre les statistiques**. Vite 8 + React 19 + TypeScript, sans framework de UI ni
librairie de graphiques (le histogramme est un SVG maison).

L'application lit et écrit exclusivement dans l'API du dossier `../backend`
(Express + SQLite). Aucun appel réseau direct n'est possible depuis le code : la
même origine (proxy Vite en développement) est toujours utilisée.

## Lancer

```bash
npm install
npm run dev          # http://localhost:5173  (proxy /api → http://localhost:4000)
```

Dans un autre terminal :

```bash
cd ../backend && npm run seed && npm start
```

À l'ouverture du dashboard, saisir le **jeton admin** (`qrscanner-dev-token` en
développement, sinon la valeur de `ADMIN_TOKEN`) dans l'onglet **Connexion**, puis
« Tester et enregistrer » : le message confirme le nombre de campagnes en base.

Exposer le dashboard hors machine (téléphone sur le même Wi-Fi, ou reverse-proxy) :

```bash
API_PROXY_TARGET=http://0.0.0.0:4000 npm run dev -- --host 0.0.0.0
```

## Pages

| Onglet | Rôle |
|---|---|
| **Vue d'ensemble** | totaux (scans, scans du jour, campagnes actives/total), histogramme des scans par jour, répartition iOS/Android, répartition par source de scan, table « par campagne » |
| **Campagnes** | liste complète, création, édition, activation/arrêt, suppression ; QR affiché pour la campagne choisie, au **choix** « autonome » (JSON embarqué) ou « court » (`qrsc://ID`), avec téléchargement PNG, impression et contenu brut consultable |
| **Connexion** | URL de base de l'API + jeton admin (bouton « Tester et enregistrer »), pas-à-pas pour régler l'app mobile sur le même réseau, et planche de QR courts optionnels |

Période des statistiques : 7 / 14 / 30 / 90 jours, avec export **CSV** (via
`/api/admin/stats/export.csv`, téléchargement côté navigateur).

## Deux formats de QR, un seul contrat

- **QR autonome** (défaut, recommandé) : le `qrText` JSON complet est encodé dans le QR.
  Le mobile peut afficher la publicité **sans réseau ni registre** ; le contenu est
  re-validé à la lecture. C'est le format décrit dans `backend/README.md`.
- **QR court** `qrsc://<ID>` : 12 caractères, donc un QR très lisible, mais le mobile
  doit pouvoir joindre l'API (mode « registre distant » activé dans ses réglages).

`src/payload.ts` est le portage exact de `backend/src/payload.js` ; la génération est
refusée au-delà de **1600 octets UTF-8** avec un message expliquant quoi raccourcir.
Le composant `Qr.tsx` n'affiche jamais un QR d'une autre valeur : l'image n'est rendue
que si elle correspond exactement au texte demandé, et le contenu brut encodé reste
consultable sous le QR (`<details>`).

## Sécurité appliquée

- Aucun champ « URL » n'accepte autre chose que **HTTPS** (hors `localhost`/`127.0.0.1` en
  développement) : la validation est faite avant l'appel réseau, puis re-faite par le serveur.
- Les QR ne contiennent **aucun lien à ouvrir** : le mobile n'exécute rien, n'ouvre pas de
  navigateur. Aucun bouton « ouvrir l'URL » n'est proposé ici non plus (bouton « copier » seulement).
- Échappement systématique : React pour l'affichage (aucun `dangerouslySetInnerHTML`), CSV
  échappé côté navigateur comme côté serveur.
- Le jeton et l'URL de base vivent dans `localStorage` du navigateur ; ils ne sont jamais
  envoyés au mobile ni écrits dans un fichier du dépôt.
- Le jeton admin n'est jamais écrit dans le dépôt ni dans le bundle : il vient de la saisie.

## Vérifications

```bash
npm run build     # tsc -b && vite build  → ✅ 52 modules, dist/assets/index-*.js ~267 ko (85 ko gzip)
npx oxlint        # ✅ 0 warning, 0 erreur (12 fichiers, 116 règles)
```

Aucun test unitaire n'est installé dans ce projet : la logique sensible
(génération du payload, agrégats, CSV) est **testée côté backend**
(`cd ../backend && npm test`, 17 tests) et côté mobile
(`cd ../qrscanner && npx jest`, 159 tests), qui partagent le même contrat.

## Structure

```text
dashboard/src/
├── main.tsx / App.tsx      # navigation par onglets, thème sombre
├── api.ts                  # fetch + jeton, erreurs typées, délai max 10 s (30 s pour l'export CSV)
├── payload.ts              # génération/validation du QR (miroir de backend/src/payload.js)
├── types.ts                # contrats API (campagne, stats, scan)
├── csv.ts                  # export CSV côté navigateur (échappé)
├── pages/OverviewPage.tsx · CampaignsPage.tsx · ConnectionPage.tsx
└── components/Qr.tsx · DailyChart.tsx
```
