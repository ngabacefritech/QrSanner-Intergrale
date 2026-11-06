# QRScanner

Application mobile (React Native + Expo SDK 57) qui lit un QR code avec la caméra, affiche la **publicité associée** en plein écran pendant une durée configurable, puis **revient automatiquement au scanner**. Aucun navigateur externe n'est jamais ouvert.

---

## État réel du projet (vérifié le 2026-10-15)

| Vérification | Résultat |
|---|---|
| `npx tsc --noEmit` (TypeScript strict) | ✅ 0 erreur |
| `npx jest` | ✅ 14 suites, **159 tests passés** |
| `npx jest --coverage` | ✅ 94,47 % des instructions / 90,23 % des branches sur `src/` (services 94,13 % · utils 95,37 %) — le reste non couvert est du rendu d'écrans, pas de la logique |
| `npx expo install --check` / `--fix` | ✅ 0 dépendance hors version SDK recommandée |
| `npx expo export --platform ios` et `--platform android` (bundler Metro réel) | ✅ bundles Hermes produits (2,3 Mo par plateforme) |
| `npx expo-doctor` | ✅ 21/21 checks passés |
| Contrat QR « JSON embarqué » contre le **backend réel** (`localhost:4000`) | ✅ 4 `qrText` réels parsés par `parseEmbeddedQr` (ids, URLs, durées, titres identiques) |
| Résolution distante `qrsc://ID` **et** QR autonome contre le backend réel | ✅ mode registre + repli hors ligne vérifiés |
| Déclaration de scan → statistiques | ✅ `POST /api/admin/scans` → 201 et compteur du dashboard incrémenté (146 → 147) |
| QR codes de démonstration (décodage `jsQR`) | ✅ les 4 PNG se décodent avec la bonne valeur |
| Vidéos de démonstration (ffprobe/ffmpeg) | ✅ MP4 H.264 `yuv420p`, 640×640, 5 s, 30 fps |
| **Tests sur un vrai iPhone / Android** | ❌ **NON réalisés** : aucun appareil physique ni simulateur n'était disponible dans l'environnement de développement. Voir `docs/CHECKLIST-TESTS-MANUELS.md`. |

## Parcours utilisateur

1. Ouverture de l'app → écran **scanner** directement (pas d'onboarding).
2. Demande de permission caméra (justification iOS configurée).
3. Pointage vers un QR code → lecture (`expo-camera`, `CameraView` + `barcodeScannerSettings.barcodeTypes: ['qr']`).
4. Résolution via `resolveQrCode()` :
   - **QR autonome** (JSON émis par la console) → publicité lue directement dans le QR, aucune requête nécessaire ;
   - **QR court** `qrsc://ID` → interrogation du registre (local de démo, ou API de la console si activée) ;
   - **URL `https://qrscanner.local/...`** → extraction de l'identifiant, jamais d'ouverture de lien.
5. Affichage de la **publicité plein écran** (image ou vidéo MP4 `expo-video`), **masquage barre d'état + barre de navigation Android**.
6. **Compte à rebours** visible (durée par campagne), puis **retour automatique au scanner**, réarmé pour un nouveau scan.

Garde-fous implémentés : anti double-scan (verrou pendant le traitement + cooldown de 2,5 s sur le même code), aucune exécution du contenu du QR, URLs distantes validées HTTPS, arrêt propre de la vidéo, restauration de l'affichage même en cas d'erreur ou d'arrière-plan.

---

## Stack et versions (compatibilité vérifiée)

- Expo SDK **57** (`expo@~57.0.29`, dernier stable, sans bêta — versions alignées par `npx expo install --fix`)
- React Native **0.86.3** / React **19.2.3** (compatibilité vérifiée dans les types du template)
- TypeScript **~6.0.3**
- `expo-camera ~57.0.6` (CameraView, scanning QR, torche via `enableTorch`)
- `expo-video ~57.0.5` (`VideoView` + `createVideoPlayer`, API SDK 57)
- `@react-navigation/native ^7.5.0` + `@react-navigation/native-stack ^7.20.0` + `react-native-screens ~4.26.0` + `react-native-safe-area-context ~5.7.0`
- `expo-status-bar ~57.0.1` + `expo-navigation-bar ~57.0.3` (mode immersif Android)
- `expo-constants ~57.0.22`, `expo-splash-screen ~57.0.10`, `expo-screen-orientation ~57.0.3`
- Tests : `jest-expo ~57.0.6` + `@testing-library/react-native 13` + `react-test-renderer 19.2.3` (version alignée sur `react`, sinon conflit npm)
- `@react-native-async-storage/async-storage ~2.2.0` — **utilisé uniquement** pour la configuration réseau saisie par l'opérateur (URL de l'API + activation de la sync). Rien d'autre n'est persisté : ni scan, ni média, ni identifiant appareil.

---

## Structure

```text
QRScanner/
├── App.tsx                     # NavigationContainer + thème sombre + StatusBar
├── index.ts                    # Point d'entrée Expo (registerRootComponent)
├── app.json                    # Configuration Expo validée par expo-doctor
├── package.json                # Scripts + deps SDK 57 + config Jest
├── tsconfig.json               # strict: true, types Jest
├── jest.setup.js               # Mocks des modules natifs (camera, video, nav bar)
├── __mocks__/fileMock.js       # Stub des require('*.png' | '*.mp4') pour Jest
├── assets/
│   ├── icon.png / splash-icon.png / favicon.png / android-icon-*.png   # générés
│   ├── images/
│   │   ├── demo-ad.png         # publicité image (1080×1920) — fichier RÉEL
│   │   └── fallback-ad.png     # image de repli vidéo — fichier RÉEL
│   ├── videos/
│   │   ├── demo-ad.mp4         # publicité vidéo (H.264, 5 s) — fichier RÉEL
│   │   └── demo-ad-loop.mp4    # variante vidéo — fichier RÉEL
│   └── qr-codes/
│       ├── campagne-image.png    # QR DEMO-IMAGE-001 (décodé et vérifié)
│       ├── campagne-video.png    # QR DEMO-VIDEO-001 (décodé et vérifié)
│       ├── campagne-inactive.png # QR campagne inactive (refus attendu)
│       └── campagne-inconnue.png # QR inconnu (refus attendu)
├── docs/
│   └── CHECKLIST-TESTS-MANUELS.md
├── __tests__/                  # 159 tests (logique, rendu, écran de pub, réglages, contrat API)
└── src/
    ├── components/  ScannerFrame · Countdown · LoadingIndicator · ToastMessage
    │                CameraStatusPill · PermissionViews · Icons
    ├── screens/     ScannerScreen · AdvertisementScreen · AboutScreen · SettingsScreen
    ├── navigation/  AppNavigator.tsx · types.ts (RootStackParamList typé)
    ├── services/    qrCodeService.ts (resolveQrCode) · campaignService.ts (registre local/distant)
    │                embeddedQr.ts (validation du QR autonome) · apiConfig.ts (réglages AsyncStorage)
    │                analyticsService.ts (déclaration des scans) · registryProvider.ts (choix du registre)
    ├── hooks/       useCameraPermission · useCountdown · useAppVisibility · useImmersive
    ├── types/       campaign.ts (modèle strict)
    ├── constants/   campaigns.ts (données de démonstration)
    ├── utils/       validation · countdown · media · navigation
    └── theme.ts     palette sombre (noir profond/bleu nuit, accents cyan #22D3EE / vert #A3E635)
```

---

## Démarrage

### Prérequis

- **Node.js ≥ 20** (projet testé sous Node 20.20.2 ; Node 22 LTS recommandé) — vérifier : `node -v`.
- npm ≥ 10 (ou équivalent).
- **iPhone** : macOS + **Expo Go** (App Store) — l'app utilise `expo-camera` et `expo-video`, tous deux pris en charge par Expo Go (caméra native + AVPlayer, sans clé API).
- **Android** : **Expo Go** (Play Store) + USB + ADB (optionnel).

### Installation

```bash
cd QRScanner
npm ci        # versions strictement verrouillées (package-lock.json fourni)
# ou npm install
```

### Lancer

```bash
npm start            # Metro + QR code à scanner avec Expo Go
npm run ios          # iOS Simulator (macOS requis)
npm run android      # appareil Android via ADB ou émulateur
```

Sur l'appareil : installer **Expo Go**, ouvrir le menu de l'appareil photo, **scanner le QR affiché dans le terminal** → le projet s'ouvre dans Expo Go.

### Tester les QR codes de campagne

Dans l'app, scanner (depuis l'écran d'un autre appareil, ou imprimé) un PNG de `assets/qr-codes/` :

| QR | Contenu encodé | Résultat attendu |
|---|---|---|
| `campagne-image.png` | `https://qrscanner.local/demo/nzui-market` | pub **image** 10 s → retour scanner |
| `campagne-video.png` | `qrscanner://campaign/DEMO-VIDEO-001` | pub **vidéo** 12 s → retour scanner |
| `campagne-inactive.png` | `https://qrscanner.local/demo/campagne-inactive` | toast « Publicité désactivée… » |
| `campagne-inconnue.png` | `https://example.com/qr-unknown` | toast « QR code inconnu… » |

Les QR « autonomes » (JSON) ne sont pas dans `assets/qr-codes/` : ils sont générés par la **console web** (`dashboard/`, page Campagnes → QR code) ou par l'API (`POST /api/admin/campaigns` renvoie `qrText`). Le bouton ⓘ du scanner liste les valeurs de test du registre local.

Le bouton ⓘ du scanner liste aussi toutes les valeurs de test. D'autres lecteurs de QR acceptent ces codes (ils encodent uniquement des données, aucun lien n'est ouvert par QRScanner).

Si ADB est absent : `adb version` échoue → installer Android Studio (Platform Tools), activer le débogage USB, ou simplement **utiliser Expo Go en scannant le QR du terminal** (`npx expo start --lan` si Wi-Fi instable : `--tunnel`).

---

## Commandes complètes

```bash
# 1) Node.js (si absent ou < 20) — Linux :
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs
# macOS : brew install node   /   Windows : https://nodejs.org (LTS)

# 2) Installation des dépendances (versions verrouillées par package.json)
cd QRScanner && npm install

# 3) Vérifications avant lancement
npm run typecheck && npm test && npm run check

# 4) Démarrer Metro
npm start                  # ou : npx expo start --lan (même réseau Wi-Fi)
                           # ou : npx expo start --tunnel (réseau captif/entreprises)

# 5) iPhone : scanner le QR code du terminal avec l'Appareil photo → Expo Go
#    (ou npm run ios sur un Mac avec Xcode)
#    Android : npm run android (nécessite ADB/émulateur) ou Expo Go + même réseau
#    Vérifier ADB : adb version ; si absent :
#      - Android Studio → SDK Manager → Platform Tools
#      - ou exporter : export ANDROID_HOME=$HOME/Android/Sdk ; export PATH=$PATH:$ANDROID_HOME/platform-tools
#      - sans ADB : utiliser Expo Go, c'est suffisant pour tester.

# 6) Tests
npm test                   # suite complète
npm run test:coverage      # rapport de couverture

# 7) Build de production (EAS)
npm install -g eas-cli && eas login
eas build --platform android
eas build --platform ios
```

## Scripts

```bash
npm run typecheck      # npx tsc --noEmit — 0 erreur
npm test               # npx jest — 159 tests
npm run test:coverage  # couverture des services/utils
npm run check          # npx expo-doctor — 21/21
npm start              # Metro
```

---

## Modèle de données (`src/types/campaign.ts`)

`CampaignRecord` : `id`, `title`, `qrCodeValue`, `mediaType: 'image' | 'video'`, `mediaSource` (`{ kind:'asset', assetKey }` **ou** `{ kind:'remote', url }`), `durationSeconds`, `isActive`, `createdAt`, `description?`, `fallbackImage?`, `allowEarlySkip`, `allowDirectUrlMedia`.

La projection affichée `ResolvedAd` est produite par `buildAd()` (registre) ou `buildAdFromEmbedded()` (QR autonome) et **re-jetée** si la durée est invalide (`INVALID_DURATION`).

Le `qrText` encodé dans le QR autonome est exactement le payload validé côté backend (`backend/src/payload.js`) et généré côté console (`dashboard/src/payload.ts`) :

```json
{"app":"qrscanner","v":1,"id":"E6PD5P9G","t":"Marché Nzui — Soldes","m":0,"u":"https://cdn.exemple.org/visuel.jpg","d":10,"s":"Samedi 15 h","f":"https://cdn.exemple.org/repli.jpg","k":1}
```

Règles appliquées par le mobile (`src/services/embeddedQr.ts`) : `app`/`v` attendus, `id` conforme, titre 2–80, `m ∈ {0,1}`, URLs médias validées par la même politique HTTPS que les URLs scannées, durée entière 1–300, **4096 octets UTF-8 maximum**, aucun caractère de contrôle. Un JSON qui ne respecte pas ces règles est refusé avec un message explicite, jamais « ouvert » ni exécuté.

### Brancher l'application sur la console (API QRScanner)

Le dossier `backend/` fournit une API Express + SQLite complète. Une fois démarrée (`cd backend && npm run seed && npm start`), l'app mobile peut l'utiliser :

1. Sur le téléphone (Expo Go, **même réseau Wi-Fi**), écran scanner → bouton **⚙ Connexion**.
2. Saisir l'URL de base de l'API, par exemple `http://192.168.1.20:4000` (l'IP de la machine qui héberge le backend ; `localhost` ne fonctionne que sur émulateur Android → utiliser `adb reverse tcp:4000 tcp:4000` puis `http://localhost:4000`).
3. **Tester la connexion** (appelle `GET /api/campaigns`) puis **Activer la synchronisation**.

Ce que ça change concrètement :

| | Synchronisation désactivée (défaut) | Synchronisation activée |
|---|---|---|
| Registre | 6 campagnes de démonstration embarquées dans le bundle | Campagnes lues dans la base de la console (`GET /api/campaigns`, cache 30 s) |
| QR court `qrsc://ID` | Cherché dans le registre local | Cherché dans la console ; campagne retirée → « QR code inconnu », campagne arrêtée → invisible de la liste publique donc « inconnu » |
| QR autonome (JSON) | Accepté tel quel après validation stricte du contenu | Vérifié auprès de la console (le registre **fait foi** : on peut donc retirer/arrêter une campagne sans réimprimer) ; en cas de réseau perdu, le contenu du QR prend le relais |
| Statistiques | **Aucune requête** | `POST /api/admin/scans` à chaque publicité résolue (best effort, silencieux) |
| Réseau utilisé | uniquement les médias HTTPS des campagnes distante | `GET /api/campaigns` + `POST /api/admin/scans` + médias |

Points de code utiles : `src/services/apiConfig.ts` (validation + persistance AsyncStorage), `src/services/registryProvider.ts` (choix local/distant, instance mémoïsée), `src/services/campaignService.ts` (`RemoteCampaignService`, cache 30 s, repli `degraded`), `src/services/embeddedQr.ts` (parseur du QR autonome), `src/services/analyticsService.ts` (déclaration de scan).

**Aucun secret** n'est demandé ni stocké côté mobile : `/api/campaigns` est public et `/api/admin/scans` n'exige pas le jeton admin (il est limité en débit côté serveur). Le jeton `ADMIN_TOKEN` reste réservé au dashboard.

## Sécurité & confidentialité

- **Aucune donnée personnelle** collectée. Sans activation explicite de la synchronisation, l'app n'émet **aucune** requête vers un serveur (seules les campagnes « remote » de démo chargent une image/vidéo HTTPS connue).
- Avec la synchronisation : seuls `campaignId` (identifiant anonyme de campagne), `platform`, `appVersion`, `source` et un horodatage sont envoyés. Pas de nom, pas de position, pas d'identifiant appareil, pas de jeton.
- Configuration réseau saisie par l'opérateur et stockée localement (AsyncStorage), jamais embarquée dans le code ni dans le dépôt.
- Le contenu d'un QR n'est jamais exécuté : pas de `Linking.openURL`, pas de WebView, pas de plan de code (vCard/WiFi/Bluetooth rejetés explicitement — testés).
- Validation stricte des URLs distantes : HTTPS obligatoire (HTTP toléré **uniquement** `localhost`/`127.0.0.1` pour le dev), ni `userinfo`, ni port hors 80/443 (hors localhost), normalisation par `URL`.
- Aucune clé API dans le code ; le service distant est désactivé par défaut.
- Permission caméra demandée **uniquement** à l'ouverture du scanner, jamais d'autre permission.

## Erreurs traitées (avec message français à l'écran)

Permission refusée (écran dédié + Réessayer + ouverture des réglages Android), caméra absente (`onMountError` → fond bleu nuit + pastille « erreur matériel », jamais d'écran noir silencieux), QR vide / trop long / non pris en charge / inconnu / campagne inactive / durée invalide / média HTTPS refusé / **QR autonome non conforme** (`EMBEDDED_INVALID`, message « Campagne illisible… ») / **API injoignable** (repli silencieux sur la dernière liste connue puis sur le QR), image inaccessible (repli `fallback-ad.png`), vidéo illisible ou trop lente (> 6 s, repli image puis fin propre), retour arrière, perte de l'app au premier plan/arrière-plan (compte à rebours gelé, vidéo en pause), double-scan (verrou + cooldown 2,5 s).

## Build de production (EAS — optionnel)

Expo Go suffit pour tester. Pour des binaires :

```bash
npm install -g eas-cli
eas login
eas build --platform android      # APK/AAB signés
eas build --platform ios          # nécessite un compte Apple Developer
```

`app.json` fixe `ios.bundleIdentifier` et `android.package` à `com.qrscanner.app` : changez-les pour votre compte avant un vrai store build. Pour un dev-build natif complet : `eas build --profile development --platform ios|android`.

## Limites connues (honnêtes)

- **Mode hors ligne ≠ mode distant** : tant que la synchronisation n'est pas activée, les campagnes créées dans la console sont invisibles (seul le QR autonome fonctionne, sans refus possible côté serveur).
- La liste publique de l'API ne contient que les campagnes **actives** : une campagne arrêtée en cours de diffusion est donc signalée « QR code inconnu » plutôt que « désactivée ».
- `reportScan` est un compteur **best effort**, sans file d'attente : un scan effectué sans réseau n'est jamais rattrapé plus tard.

1. **Non testé sur matériel réel** : l'environnement de développement n'a ni iOS ni Android. Bundlage + typecheck + tests unitaires couvrent la logique et la résolution des imports, pas les particularités matérielles (torch, focus, MLKit).
2. `expo-doctor`, `tsc`, `jest` et `expo export` passés **ici**, le 2026-10-10, sur Node 20.
3. Les campagnes « remote » nécessitent Internet sur l'appareil (picsum.photos) — sans connexion, l'échec de chargement est géré (repli + retour au scanner).
4. iOS : le `hidden` de la barre d'état via `expo-status-bar` est fiable ; le masquage de la barre de navigation Android (mode immersif « sticky ») dépend du constructeur (Samsung/Xiaomi peuvent réafficher la barre au swipe — comportement système normal).
5. L'animation de la ligne de scan utilise l'API Animated standard ; sur certains appareils Android bas de gamme, `useNativeDriver` est ignoré si le thread UI est saturé (cosmétique uniquement).
6. La V1 « direct URL » (QR contenant directement l'URL du média) n'accepte **que** les URLs déclarées par une campagne de démonstration avec `allowDirectUrlMedia: true` (par défaut : refus `UNKNOWN_CAMPAIGN`) — c'est un choix de sécurité, documenté dans `qrCodeService.ts`.

## Dépannage fréquent

| Symptôme | Cause / solution |
|---|---|
| Écran noir à l'ouverture du scanner | Permission refusée → écran d'aide ; sinon caméra utilisée par une autre app (iOS), ou `onMountError` (pastille rouge + message) |
| « Caméra : initialisation… » interminable | Expo Go périmé ou autre app caméra active ; redémarrer Expo Go |
| Le scan ne se déclenche pas | QR hors zone du cadre, écran du téléphone peu lumineux, ou cooldown actif (2,5 s) |
| `npm install` échoue sur react-test-renderer | Garder `react-test-renderer` **exactement à la version de `react`** (19.2.3 ici) |
| Vidéo noire avec son normal | Codec exotique : encoder en H.264/AAC `yuv420p` (les MP4 fournis le sont) |
| Erreur `Cannot find module` après extraction du ZIP | `npm install` oublié (node_modules non fourni) |
| `expo-doctor` échec schema | Ne pas ajouter de propriétés hors schema dans `app.json` (ex. `splash`, `edgeToEdgeEnabled` en SDK 57) |

## Licence des médias de démo

Tous les visuels, vidéos et textes sont fictifs, générés pour ce projet — remplacer avant diffusion. Aucun droit sur les noms utilisés (« Marché Nzui » est une marque inventée).
