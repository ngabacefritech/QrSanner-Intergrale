# Checklist de tests manuels — QRScanner (iOS & Android)

À exécuter sur un appareil réel avec Expo Go (`npm start` puis scanner le QR du terminal).
Chaque ligne indique l'action, le résultat attendu, et la case à cocher une fois vérifiée.

## 1. Démarrage & permissions

| # | Action | Résultat attendu | ✔ |
|---|---|---|---|
| 1.1 | Ouvrir l'app | Écran scanner directement (pas d'accueil intermédiaire), fond bleu nuit, titre QRSCANNER, consigne « Scannez un QR code pour découvrir la publicité » | ☐ |
| 1.2 | Première ouverture | Invite système de permission caméra avec la justification « QRScanner utilise la caméra… » | ☐ |
| 1.3 | Refuser la permission | Écran explicatif « Caméra indisponible », boutons Réessayer (+ « Ouvrir les réglages » sur Android), **jamais d'écran noir muet** | ☐ |
| 1.4 | Autoriser | Aperçu caméra arrière réel, pastille « Caméra : prête » | ☐ |
| 1.5 | (Android) Réessayer après réglages | La permission accordée dans les réglages système est détectée au retour dans l'app | ☐ |

## 2. Scanner

| # | Action | Résultat attendu | ✔ |
|---|---|---|---|
| 2.1 | Approcher `assets/qr-codes/campagne-image.png` (écran d'un autre appareil) | Lecture < 2 s, vibration/verrou, toast de résolution | ☐ |
| 2.2 | Scanner un QR partiellement hors cadre | Pas de faux positif | ☐ |
| 2.3 | Scanner 2× le même QR à < 2,5 s | Second scan ignoré, message « QR déjà lu il y a quelques secondes… » | ☐ |
| 2.4 | Scanner `https://example.com/qr-unknown` | Toast « QR code inconnu : aucune campagne associée. » ; l'app ne plante pas, le scan se réarme | ☐ |
| 2.5 | Scanner un vCard/WiFi/texte libre | Toast « Contenu non pris en charge… » | ☐ |
| 2.6 | Bouton torche (appareil avec flash) | Torche s'allume/s'éteint ; sans flash matériel : aucun crash (inerté) | ☐ |
| 2.7 | Bouton ⓘ | Écran À propos : version, SDK, liste des campagnes de démo avec leurs valeurs QR | ☐ |
| 2.8 | Couvrir la caméra | Aucune erreur ; l'app attend un QR valide | ☐ |

## 3. Publicité

| # | Action | Résultat attendu | ✔ |
|---|---|---|---|
| 3.1 | Campagne image (`DEMO-IMAGE-001`) | Image plein écran (proportions conservées), compte à rebours 10 → 0, retour **automatique** au scanner | ☐ |
| 3.2 | Campagne vidéo (`DEMO-VIDEO-001`) | Lecture MP4 muette sans contrôles, compte à rebours 12 s, retour automatique | ☐ |
| 3.3 | Barre d'état pendant la pub | Masquée ; réaffichée au retour scanner (iOS et Android) | ☐ |
| 3.4 | Barre de navigation Android pendant la pub | Masquée (immersive) ; restaurée au retour — **à vérifier sur un build development/EAS, Expo Go ne masque pas la barre de navigation** | ☐ |
| 3.5 | Bouton « Passer » | Présent **uniquement** si `allowEarlySkip: true` (ex. `DEMO-IMAGE-REMOTE-002`) ; ferme la pub proprement | ☐ |
| 3.6 | Mettre l'app en arrière-plan pendant la pub | Vidéo en pause, compte à rebours gelé ; au retour : reprise, pas de doublon de navigation | ☐ |
| 3.7 | Retour matériel Android pendant la pub | Retour au scanner, affichage restauré, scan réarmé | ☐ |
| 3.8 | Scanner `campagne-inactive.png` | Toast « Publicité désactivée… », aucun écran pub ouvert | ☐ |
| 3.9 | (Optionnel, si réseau dispo) scanner l'URL `DEMO-IMAGE-REMOTE-002` via valeur du registre | Image distante chargée ; en coupant le Wi-Fi → image de repli puis retour scanner | ☐ |
| 3.10 | Scanner un QR inconnu PENDANT qu'une pub se joue | Impossible (caméra inactive) — le scan se réarme après la pub | ☐ |

## 4. Robustesse & vie de l'app

| # | Action | Résultat attendu | ✔ |
|---|---|---|---|
| 4.1 | Rotation / taille du cadre sur petit écran (iPhone SE) | Cadre centré, texte lisible, pas de débordement | ☐ |
| 4.2 | Mise en arrière-plan pendant le scan | Au retour : caméra reprend, aucun verrouillage définitif | ☐ |
| 4.3 | Enchaîner 10 scans valides d'affilée | Aucune double navigation, aucun crash, chaque pub se termine au bon moment | ☐ |
| 4.4 | Mode avion pendant une vidéo distante | Repli propre + retour scanner (pas de gel) | ☐ |
| 4.5 | Mémoire : script de 30 scans | Pas de croissance continue de la RAM (vidéos bien libérées) | ☐ |

## 5. Lecteur d'écran / accessibilité

| # | Action | Résultat attendu | ✔ |
|---|---|---|---|
| 5.1 | VoiceOver / TalkBack sur le scanner | Boutons nommés (« Allumer la lampe torche », « Informations sur l'application »), consigne lue | ☐ |
| 5.2 | Toasts d'erreur | Annoncés (live region polie) | ☐ |
| 5.3 | Contraste | Textes blancs/cyan sur fond sombre ≥ 4,5:1 (couleurs principales) | ☐ |

## 6. Connexion à la console (API + statistiques)

Prérequis : `cd backend && npm run seed && npm start`, téléphone et poste sur le **même Wi-Fi**.

| # | Action | Résultat attendu | ✔ |
|---|---|---|---|
| 6.1 | Scanner → bouton ⚙ | Écran « Connexion », mention du registre local par défaut, aucun champ secret | ☐ |
| 6.2 | Saisir `http://localhost:4000` sur l'appareil physique | Refus explicite (HTTP autorisé uniquement en local) — attendu, ne pas « corriger » | ☐ |
| 6.3 | Saisir `http://<IP-du-poste>:4000` | Validation acceptée, bouton « Tester la connexion » actif | ☐ |
| 6.4 | Tester la connexion, API éteinte | Message « API injoignable : vérifie l'URL, le port et le réseau » | ☐ |
| 6.5 | Tester la connexion, API allumée | « API joignable — N campagnes actives » | ☐ |
| 6.6 | Activer la synchronisation | « Registre distant (API) » + URL affichée ; retour au scanner | ☐ |
| 6.7 | Scanne un QR de la console (onglet Campagnes) | Publicité affichée normalement, **sans** message d'erreur | ☐ |
| 6.8 | Ongle « Vue d'ensemble » du dashboard, après ~2 s | +1 scan sur la campagne, source « QR autonome (JSON embarqué) » | ☐ |
| 6.9 | Scanne un QR court `qrsc://ID` (onglet Connexion) | Publicité affichée, source comptée « Registre (id court) » | ☐ |
| 6.10 | Arrête la campagne dans le dashboard, rescanne le **même** QR court | Toast « QR code inconnu : aucune campagne active associée. » | ☐ |
| 6.11 | Coupe le Wi-Fi du téléphone, scanne un QR autonome | Publicité affichée (le contenu est dans le QR), aucun blocage | ☐ |
| 6.12 | Repasse en Wi-Fi coupé sur un QR court | Toast d'erreur (registre injoignable) — la liste connue reste en cache 30 s | ☐ |
| 6.13 | Interrupteur de synchronisation sur « off » | Retour au registre local de démonstration ; plus aucune requête | ☐ |
| 6.14 | Redémarre l'app (Expo Go → reload) | Le réglage choisi est conservé (AsyncStorage) | ☐ |
| 6.15 | Mode avion + scan de QR autonome, puis réactivation réseau | Le scan non déclaré n'est **pas** rattrapé (compteur best effort, documenté) | ☐ |

## Journal de test (à remplir)

- Appareil / OS : ____________  •  Expo Go version : ____________  •  Expo SDK vu au boot : ____________
  •  Backend : ☐ démarré (port 4000) ☐ IP réseau utilisée
- Résultat global : ☐ conforme ☐ anomalies (décrire ci-dessous)
- Anomalies : ____________
