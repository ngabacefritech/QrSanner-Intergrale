# QRScanner

Application mobile (React Native + Expo SDK 57) qui lit un QR code avec la caméra, affiche la **publicité associée** en plein écran pendant une durée configurable, puis **revient automatiquement au scanner**. Aucun navigateur externe n'est jamais ouvert.

---

## État réel du projet (vérifié le 2026-10-10)

| Vérification | Résultat |
|---|---|
| `npx tsc --noEmit` (TypeScript strict) | ✅ 0 erreur |
| `npx jest` | ✅ 8 suites, **86 tests passés** |
| `npx jest --coverage` | ✅ 91 % des instructions sur services/utils (la partie non couverte est `RemoteCampaignService`, jamais activée en V1) |
| `npx expo export --platform ios --platform android` (bundler Metro réel) | ✅ bundles Hermes produits pour les deux plateformes |
| `npx expo-doctor` | ✅ 21/21 checks passés |
| QR codes de démonstration (décodage `jsQR`) | ✅ les 4 PNG se décodent avec la bonne valeur |
| Vidéos de démonstration (ffprobe/ffmpeg) | ✅ MP4 H.264 `yuv420p`, 640×640, 5 s, 30 fps |
| **Tests sur un vrai iPhone / Android** | ❌ **NON réalisés** : aucun appareil physique ni simulateur n'était disponible dans l'environnement de développement. Voir `docs/CHECKLIST-TESTS-MANUELS.md`. |

## Parcours utilisateur

1. Ouverture de l'app → écran **scanner** directement (pas d'onboarding).
2. Demande de permission caméra (justification iOS configurée).
3. Pointage vers un QR code → lecture (`expo-camera`, `CameraView` + `barcodeScannerSettings.barcodeTypes: ['qr']`).
4. Résolution via `resolveQrCode()` → recherche de campagne dans le registre local.
5. Affichage de la **publicité plein écran** (image ou vidéo MP4 `expo-video`), **masquage barre d'état + barre de navigation Android**.
6. **Compte à rebours** visible (durée par campagne), puis **retour automatique au scanner**, réarmé pour un nouveau scan.

Garde-fous implémentés : anti double-scan (verrou pendant le traitement + cooldown de 2,5 s sur le même code), aucune exécution du contenu du QR, URLs distantes validées HTTPS, arrêt propre de la vidéo, restauration de l'affichage même en cas d'erreur ou d'arrière-plan.

---

## Stack et versions (compatibilité vérifiée)

- Expo SDK **57** (`expo@~57.0.27`, dernier stable, sans bêta)
- React Native **0.86.3** / React **19.2.3** (compatibilité vérifiée dans les types du template)
- TypeScript **~6.0.3**
- `expo-camera ~57.0.6` (CameraView, scanning QR, torche via `enableTorch`)
- `expo-video ~57.0.5` (`VideoView` + `createVideoPlayer`, API SDK 57)
- `@react-navigation/native ^7.5.0` + `@react-navigation/native-stack ^7.20.0` + `react-native-screens ~4.26.0` + `react-native-safe-area-context ~5.7.0`
- `expo-status-bar ~57.0.1` + `expo-navigation-bar ~57.0.3` (mode immersif Android)
- `expo-constants`, `expo-splash-screen`, `expo-screen-orientation`
- Tests : `jest-expo ~57.0.5` + `@testing-library/react-native 13` + `react-test-renderer 19.2.3` (version alignée sur `react`, sinon conflit npm)
- AsyncStorage **non utilisé** : rien à persister dans ce parcours (choix délibéré, cf. § 14 de la mission).

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
├── __tests__/                  # 86 tests unitaires (logique, rendu, écran de pub)
└── src/
    ├── components/  ScannerFrame · Countdown · LoadingIndicator · ToastMessage
    │                CameraStatusPill · PermissionViews · Icons
    ├── screens/     ScannerScreen · AdvertisementScreen · AboutScreen
    ├── navigation/  AppNavigator.tsx · types.ts (RootStackParamList typé)
    ├── services/    qrCodeService.ts (resolveQrCode) · campaignService.ts (registre)
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
npm test               # npx jest — 86 tests
npm run test:coverage  # couverture des services/utils
npm run check          # npx expo-doctor — 21/21
npm start              # Metro
```

---

## Modèle de données (`src/types/campaign.ts`)

`CampaignRecord` : `id`, `title`, `qrCodeValue`, `mediaType: 'image' | 'video'`, `mediaSource` (`{ kind:'asset', assetKey }` **ou** `{ kind:'remote', url }`), `durationSeconds`, `isActive`, `createdAt`, `description?`, `fallbackImage?`, `allowEarlySkip`, `allowDirectUrlMedia`.

La projection affichée `ResolvedAd` est produite par `buildAd()` et **re-jetée** si la durée est invalide (`INVALID_DURATION`).

### Brancher un backend plus tard

1. Le registre local vit dans `src/constants/campaigns.ts`, exposé par l'interface `CampaignService` (`src/services/campaignService.ts`).
2. `RemoteCampaignService`  (`ébauche`, **jamais activée en V1**) attend une **base HTTPS** ; `createCampaignService()` est le point de bascule unique : aucun écran à modifier.
3. `resolveQrCode(qrData, service?)` accepte un service injectable (déjà utilisé par les tests).
4. Sécurité : ne **jamais** embarquer de clé API dans le bundle mobile ; auth par token court émis par votre backend, CORS/allowlist de votre côté.

---

## Sécurité & confidentialité

- Aucune donnée personnelle collectée ; **aucun réseau** en V1 (le registre est local ; seules les campagnes « remote » de démo chargent une image/vidéo HTTPS connue).
- Le contenu d'un QR n'est jamais exécuté : pas de `Linking.openURL`, pas de WebView, pas de plan de code (vCard/WiFi/Bluetooth rejetés explicitement — testés).
- Validation stricte des URLs distantes : HTTPS obligatoire (HTTP toléré **uniquement** `localhost`/`127.0.0.1` pour le dev), ni `userinfo`, ni port hors 80/443 (hors localhost), normalisation par `URL`.
- Aucune clé API dans le code ; le service distant est désactivé par défaut.
- Permission caméra demandée **uniquement** à l'ouverture du scanner, jamais d'autre permission.

## Erreurs traitées (avec message français à l'écran)

Permission refusée (écran dédié + Réessayer + ouverture des réglages Android), caméra absente (`onMountError` → fond bleu nuit + pastille « erreur matériel », jamais d'écran noir silencieux), QR vide / trop long / non pris en charge / inconnu / campagne inactive / durée invalide / média HTTPS refusé, image inaccessible (repli `fallback-ad.png`), vidéo illisible ou trop lente (> 6 s, repli image puis fin propre), retour arrière, perte de l'app au premier plan/arrière-plan (compte à rebours gelé, vidéo en pause), double-scan (verrou + cooldown 2,5 s).

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
