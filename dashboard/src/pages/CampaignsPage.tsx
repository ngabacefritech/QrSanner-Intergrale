import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import type { Campaign, CampaignDraft } from '../types';
import { buildQrText, generateId } from '../payload';
import { Qr } from '../components/Qr';
import { downloadCsv } from '../csv';

const emptyDraft: CampaignDraft = {
  title: '',
  description: '',
  mediaType: 'image',
  mediaUrl: '',
  fallbackUrl: '',
  durationSeconds: 10,
  isActive: true,
  allowEarlySkip: false,
};

export function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CampaignDraft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  /** `embedded` : QR autonome (fonctionne hors ligne) ; `short` : QR court qrsc://ID. */
  const [qrMode, setQrMode] = useState<'embedded' | 'short'>('embedded');

  const refresh = useCallback(() => {
    api
      .listCampaigns()
      .then((list) => {
        setCampaigns(list);
        setError(null);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Chargement impossible.'));
  }, []);

  // refresh() ne fait que lancer une requête : aucun setState synchrone dans l'effet.

  useEffect(refresh, [refresh]);

  const startCreate = () => {
    setEditingId(null);
    setFormErrors([]);
    setForm({ ...emptyDraft });
  };

  const startEdit = (c: Campaign) => {
    setEditingId(c.id);
    setFormErrors([]);
    setForm({
      id: c.id,
      title: c.title,
      description: c.description ?? '',
      mediaType: c.mediaType,
      mediaUrl: c.mediaUrl,
      fallbackUrl: c.fallbackUrl ?? '',
      durationSeconds: c.durationSeconds,
      isActive: c.isActive,
      allowEarlySkip: c.allowEarlySkip,
    });
  };

  const submit = async () => {
    if (!form) return;
    const id = editingId ?? generateId();
    const local = buildQrText(form, id);
    if (!local.ok) {
      setFormErrors(local.errors);
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, id: editingId ? undefined : id };
      const saved = editingId ? await api.updateCampaign(editingId, payload) : await api.createCampaign(payload);
      setForm(null);
      setEditingId(null);
      setPreviewId(saved.id);
      refresh();
    } catch (e: unknown) {
      const err = e as { errors?: string[]; message?: string };
      setFormErrors(err.errors ?? [err.message ?? 'Enregistrement impossible.']);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c: Campaign) => {
    if (!window.confirm(`Supprimer la campagne « ${c.title} » ? Les scans déjà collectés sont conservés.`)) return;
    try {
      await api.deleteCampaign(c.id);
      refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Suppression impossible.');
    }
  };

  const toggleActive = async (c: Campaign) => {
    try {
      await api.updateCampaign(c.id, { isActive: !c.isActive });
      refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Bascule impossible.');
    }
  };

  const previewQr = form ? buildQrText(form, editingId ?? 'PREVIEW0') : null;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Campagnes &amp; QR codes</h1>
          <p className="muted">Créez la campagne, imprimez le QR, collez-le sur vos supports.</p>
        </div>
        <div className="row">
          <button type="button" className="btn" onClick={startCreate}>
            + Nouvelle campagne
          </button>
          {campaigns.length > 0 && (
            <button
              type="button"
              className="btn ghost"
              onClick={() =>
                downloadCsv('campagnes.csv', [
                  ['id', 'titre', 'type', 'url_media', 'url_repli', 'duree_s', 'active', 'skip', 'qr_text'],
                  ...campaigns.map((c) => [
                    c.id,
                    c.title,
                    c.mediaType,
                    c.mediaUrl,
                    c.fallbackUrl,
                    c.durationSeconds,
                    c.isActive,
                    c.allowEarlySkip,
                    c.qrText,
                  ]),
                ])
              }
            >
              Export CSV
            </button>
          )}
        </div>
      </header>

      {error && <p className="alert error">{error}</p>}

      {form && (
        <section className="panel form">
          <h2>{editingId ? `Modifier ${editingId}` : 'Nouvelle campagne'}</h2>
          {formErrors.length > 0 && (
            <ul className="alert error">
              {formErrors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          <div className="form-grid">
            <label className="field">
              <span>Titre *</span>
              <input
                value={form.title}
                maxLength={60}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Marché Nzui — Soldes d’octobre"
              />
            </label>
            <label className="field">
              <span>Type de média *</span>
              <select
                value={form.mediaType}
                onChange={(e) => setForm({ ...form, mediaType: e.target.value as CampaignDraft['mediaType'] })}
              >
                <option value="image">Image</option>
                <option value="video">Vidéo (MP4)</option>
              </select>
            </label>
            <label className="field wide">
              <span>URL du média (HTTPS requis) *</span>
              <input
                value={form.mediaUrl}
                onChange={(e) => setForm({ ...form, mediaUrl: e.target.value })}
                placeholder="https://cdn.exemple.org/pub/affiche.jpg"
              />
            </label>
            <label className="field wide">
              <span>URL de repli si la vidéo échoue (facultatif)</span>
              <input
                value={form.fallbackUrl}
                onChange={(e) => setForm({ ...form, fallbackUrl: e.target.value })}
                placeholder="https://cdn.exemple.org/pub/poster.jpg"
              />
            </label>
            <label className="field">
              <span>Durée (secondes) *</span>
              <input
                type="number"
                min={1}
                max={300}
                value={form.durationSeconds}
                onChange={(e) => setForm({ ...form, durationSeconds: Number(e.target.value) })}
              />
            </label>
            <label className="field wide">
              <span>Description (facultatif)</span>
              <textarea
                rows={2}
                maxLength={140}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </label>
            <label className="check">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              Campagne active (visible au scan)
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={form.allowEarlySkip}
                onChange={(e) => setForm({ ...form, allowEarlySkip: e.target.checked })}
              />
              Autoriser « Passer » avant la fin
            </label>
          </div>
          <div className="form-footer">
            <div>
              {previewQr?.ok ? (
                <p className="muted small">
                  Contenu validé : {previewQr.bytes} octets encodés (max 1600). Enregistrez pour imprimer le QR.
                </p>
              ) : (
                <p className="muted small">Le QR sera généré après validation du formulaire.</p>
              )}
            </div>
            <div className="row">
              <button type="button" className="btn ghost" onClick={() => setForm(null)}>
                Annuler
              </button>
              <button type="button" className="btn" onClick={submit} disabled={saving}>
                {saving ? 'Enregistrement…' : 'Enregistrer et générer le QR'}
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="panel">
        <h2>Campagnes ({campaigns.length})</h2>
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Titre</th>
              <th>Média</th>
              <th>Durée</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id}>
                <td className="mono">{c.id}</td>
                <td>
                  {c.title}
                  {c.description ? <p className="muted small">{c.description}</p> : null}
                </td>
                <td className="muted small">{c.mediaUrl}</td>
                <td>{c.durationSeconds} s</td>
                <td>
                  <span className={`badge ${c.isActive ? 'ok' : 'off'}`}>{c.isActive ? 'active' : 'inactive'}</span>
                </td>
                <td className="actions">
                  <button type="button" className="btn small" onClick={() => setPreviewId(previewId === c.id ? null : c.id)}>
                    QR
                  </button>
                  <button type="button" className="btn small ghost" onClick={() => startEdit(c)}>
                    Modifier
                  </button>
                  <button type="button" className="btn small ghost" onClick={() => toggleActive(c)}>
                    {c.isActive ? 'Désactiver' : 'Activer'}
                  </button>
                  <button type="button" className="btn small danger" onClick={() => remove(c)}>
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
            {campaigns.length === 0 && (
              <tr>
                <td colSpan={6} className="empty">
                  Aucune campagne. Cliquez sur « Nouvelle campagne ».
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {previewId && (
        <section className="panel qr-preview">
          {(() => {
            const c = campaigns.find((x) => x.id === previewId);
            if (!c) return null;
            return (
              <>
                <h2>QR de « {c.title} »</h2>
                <div className="qr-mode" role="group" aria-label="Format du QR code">
                  <button
                    type="button"
                    className={qrMode === 'embedded' ? 'btn small is-active' : 'btn small'}
                    aria-pressed={qrMode === 'embedded'}
                    onClick={() => setQrMode('embedded')}
                  >
                    QR autonome (recommandé)
                  </button>
                  <button
                    type="button"
                    className={qrMode === 'short' ? 'btn small is-active' : 'btn small'}
                    aria-pressed={qrMode === 'short'}
                    onClick={() => setQrMode('short')}
                  >
                    QR court qrsc://{c.id}
                  </button>
                </div>
                <div className="qr-flex">
                  <Qr
                    text={qrMode === 'short' ? `qrsc://${c.id}` : (c.qrText ?? '')}
                    filename={`qr-${c.id}-${qrMode}`}
                  />
                  <div>
                    {qrMode === 'embedded' ? (
                      <p className="muted">
                        Le QR contient <strong>la publicité entière</strong> (JSON embarqué) : le scan fonctionne même
                        sans réseau. Modifier une campagne nécessite de <strong>réimprimer</strong> son QR.
                      </p>
                    ) : (
                      <p className="muted">
                        12 caractères seulement : QR très lisible, imprimable en petit. La mobile doit alors être
                        <strong> connecté à cette API</strong> (réglages ⚙ de l’app) pour retrouver la campagne ;
                        hors réseau, ce QR ne sert à rien. En échange, <strong>arrêter une campagne ne demande
                        aucune réimpression</strong>.
                      </p>
                    )}
                    <p className="muted">
                      Astuce : restez sous ~900 caractères (URLs courtes) pour un QR peu dense, donc plus rapide à
                      lire et imprimable en petit.
                    </p>
                    {!c.isActive && (
                      <p className="alert">Campagne inactive : ce QR affichera « publicité désactivée » sur le mobile.</p>
                    )}
                  </div>
                </div>
              </>
            );
          })()}
        </section>
      )}
    </div>
  );
}
