import { useState } from 'react';
import { api, getApiBase, getToken, setApiBase, setToken } from '../api';
import type { Campaign } from '../types';
import { Qr } from '../components/Qr';

/**
 * Connexion + mode d'emploi mobile. Aucun secret n'est écrit dans le code :
 * base URL et jeton sont saisis ici et stockés dans le localStorage du navigateur.
 */
export function ConnectionPage() {
  const [base, setBase] = useState(getApiBase());
  const [token, setTok] = useState(getToken());
  const [status, setStatus] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [checking, setChecking] = useState(false);

  const save = async () => {
    setChecking(true);
    setApiBase(base);
    setToken(token);
    try {
      const health = await api.health();
      const list = await api.listCampaigns();
      setCampaigns(list);
      setStatus(`✅ API joignable (${health.campaignsInDb} campagnes en base, ${list.length} visibles depuis l’app mobile).`);
    } catch (e: unknown) {
      setCampaigns(null);
      setStatus(`❌ ${e instanceof Error ? e.message : 'Connexion impossible.'}`);
    } finally {
      setChecking(false);
    }
  };

  const effectiveBase = (getApiBase() || window.location.origin).replace(/\/+$/, '');

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Connexion &amp; app mobile</h1>
          <p className="muted">Adresse de l’API, jeton administrateur, réglage de QRScanner sur téléphone.</p>
        </div>
      </header>

      <section className="panel form">
        <h2>Accès à l’API</h2>
        <div className="form-grid">
          <label className="field wide">
            <span>Base URL de l’API (laisser vide = même origine que le dashboard)</span>
            <input value={base} onChange={(e) => setBase(e.target.value)} placeholder="http://192.168.1.20:4000" />
          </label>
          <label className="field wide">
            <span>Jeton administrateur</span>
            <input
              type="password"
              value={token}
              onChange={(e) => setTok(e.target.value)}
              placeholder="qrscanner-dev-token en développement"
            />
          </label>
        </div>
        <div className="form-footer">
          <p className="muted small">
            Jeton par défaut en développement : <code>qrscanner-dev-token</code>. Changez <code>ADMIN_TOKEN</code>{' '}
            dans l’environnement du backend pour la production.
          </p>
          <button type="button" className="btn" onClick={save} disabled={checking}>
            {checking ? 'Test en cours…' : 'Tester et enregistrer'}
          </button>
        </div>
        {status && <p className={status.startsWith('✅') ? 'alert ok' : 'alert error'}>{status}</p>}
      </section>

      <section className="panel">
        <h2>Régler l’app mobile sur cette API</h2>
        <ol className="steps">
          <li>
            Sur le poste qui tient l’API, notez son adresse réseau : <code>ipconfig getifaddr en0</code> (macOS) ou{' '}
            <code>hostname -I</code> (Linux). Exemple : <code>192.168.1.20</code>.
          </li>
          <li>
            Téléphone et poste doivent être sur le <strong>même Wi-Fi</strong>.
          </li>
          <li>
            Dans QRScanner : écran d’accueil → bouton ⚙ (API) → coller{' '}
            <code>http://{effectiveBase.replace(/^https?:\/\//, '') || '192.168.1.20:4000'}</code> → Activer la
            synchronisation.
          </li>
          <li>
            Le mobile lit désormais le <strong>registre distant</strong> (campagnes actives) et déclare chaque scan.
            Sans réseau, les QR « JSON embarqué » continuent de fonctionner : la pub est dans le code du QR.
          </li>
        </ol>
        <p className="muted small">
          Sécurité : le mobile n’envoie que <code>{'{ campaignId, platform, appVersion, source }'}</code> — ni
          position, ni identifiant d’appareil, ni image. L’adresse de l’API est une configuration, pas un secret ;
          le jeton administrateur ne quitte jamais le dashboard.
        </p>
      </section>

      {campaigns && campaigns.length > 0 && (
        <section className="panel">
          <h2>QR « registre » (optionnel)</h2>
          <p className="muted">
            Ces QR courts ne contiennent qu’un identifiant : ils obligent le mobile à joindre l’API (donc modifiables
            sans réimprimer). Le QR « autonome » généré dans l’onglet Campagnes reste la valeur par défaut.
          </p>
          <div className="mini-qr-list">
            {campaigns.map((c) => (
              <div key={c.id} className="mini-qr">
                <Qr text={`qrsc://${c.id}`} size={132} filename={`qr-registre-${c.id}`} />
                <p className="mono">{c.id}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
