/**
 * Mock d'asset pour Jest : les `require('*.png' | '*.mp4')` du registre de
 * démo sont remplacés par un nombre (comme une clé d'asset Metro) ou une
 * chaîne selon l'usage ; `utils/media.ts` sait gérer les deux.
 */
module.exports = 'asset-mock';
