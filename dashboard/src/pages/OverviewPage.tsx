import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import type { Stats } from '../types';
import { DailyChart, ShareBars } from '../components/DailyChart';

export function OverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  const load = () => {
    api
      .stats(14)
      .then((s) => {
        setStats(s);
        setError(null);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Chargement impossible.'))
      .finally(() => setBusy(false));
  };

  const refresh = () => {
    setBusy(true);
    load();
  };

  useEffect(load, []);

  const totals = stats?.totals;

  const platformTotal = useMemo(
    () => (stats?.byPlatform ?? []).reduce((acc, p) => acc + p.scans, 0),
    [stats]
  );

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Vue d’ensemble</h1>
          <p className="muted">Scans des 14 derniers jours · rafraîchi à chaque ouverture de l’onglet</p>
        </div>
        <div className="row">
          <button type="button" className="btn" onClick={refresh} disabled={busy}>
            {busy ? 'Chargement…' : 'Actualiser'}
          </button>
          {stats && (
            <button
              type="button"
              className="btn"
              onClick={async () => {
                try {
                  const csv = await api.exportCsv();
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(blob);
                  a.download = `qrscanner-scans-${new Date().toISOString().slice(0, 10)}.csv`;
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
                } catch (e: unknown) {
                  setError(e instanceof Error ? e.message : 'Export impossible.');
                }
              }}
            >
              Export CSV (serveur)
            </button>
          )}
        </div>
      </header>

      {error && <p className="alert error">{error}</p>}

      {stats && totals && (
        <>
          <section className="cards">
            <Card label="Scans (total)" value={String(totals.scans)} />
            <Card label="Scans aujourd’hui" value={String(totals.scansToday)} accent />
            <Card
              label="Campagnes"
              value={`${totals.campaignsActive} actives / ${totals.campaigns} au total`}
            />
            <Card
              label="Taux d’activation"
              value={totals.scans === 0 ? '—' : `${Math.round((totals.scansToday / Math.max(1, totals.scans)) * 100)} % aujourd’hui`}
            />
          </section>

          <section className="panel">
            <h2>Scans par jour</h2>
            <DailyChart data={stats.daily} />
          </section>

          <div className="grid-2">
            <section className="panel">
              <h2>Répartition par plateforme</h2>
              <ShareBars data={stats.byPlatform} total={platformTotal} />
            </section>
            <section className="panel">
              <h2>Origine de la résolution</h2>
              <ul className="share">
                {stats.bySource.map((s) => (
                  <li key={s.source}>
                    <span className="share-label">
                      {s.source === 'embedded' ? 'QR autonome (JSON embarqué)' : s.source === 'registry' ? 'Registre (id court)' : s.source === 'direct-url' ? 'URL directe' : 'Inconnue'} —{' '}
                      <strong>{s.scans}</strong>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="muted small">Le mobile déclare le mode de lecture ayant permis de trouver la campagne.</p>
            </section>
          </div>

          <section className="panel">
            <h2>Classement des campagnes</h2>
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Titre</th>
                  <th>Statut</th>
                  <th>Durée</th>
                  <th>Scans</th>
                  <th>Dernier scan</th>
                </tr>
              </thead>
              <tbody>
                {stats.perCampaign.map((c) => (
                  <tr key={c.id}>
                    <td className="mono">{c.id}</td>
                    <td>{c.title}</td>
                    <td>
                      <span className={`badge ${c.isActive ? 'ok' : 'off'}`}>{c.isActive ? 'active' : 'inactive'}</span>
                    </td>
                    <td>{c.durationSeconds} s</td>
                    <td className="num">{c.scans}</td>
                    <td className="muted">{c.lastScan ? new Date(c.lastScan).toLocaleString('fr-FR') : '—'}</td>
                  </tr>
                ))}
                {stats.perCampaign.length === 0 && (
                  <tr>
                    <td colSpan={6} className="empty">
                      Aucune campagne : créez-en une dans l’onglet « Campagnes & QR ».
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          {stats.totals.scans === 0 && (
            <p className="alert">
              Aucun scan enregistré pour l’instant. La collecte démarre dès que l’application mobile est
              configurée avec l’adresse de cette API (voir l’onglet « Connexion mobile »).
            </p>
          )}
        </>
      )}
    </div>
  );
}

function Card({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`card ${accent ? 'accent' : ''}`}>
      <span className="card-label">{label}</span>
      <strong className="card-value">{value}</strong>
    </div>
  );
}
