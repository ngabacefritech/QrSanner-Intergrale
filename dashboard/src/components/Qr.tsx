/** Rendu d'un QR code (bibliothèque qrcode, canvas → dataURL PNG). */
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QrProps {
  text: string;
  size?: number;
  /** Nom de fichier du téléchargement PNG. */
  filename?: string;
}

interface QrState {
  text: string | null;
  dataUrl: string | null;
  error: string | null;
}

export function Qr({ text, size = 260, filename }: QrProps) {
  const [state, setState] = useState<QrState>({ text: null, dataUrl: null, error: null });

  useEffect(() => {
    if (!text) return undefined;
    let cancelled = false;
    QRCode.toDataURL(text, { width: size * 2, margin: 2, errorCorrectionLevel: 'M' })
      .then((url) => {
        if (!cancelled) setState({ text, dataUrl: url, error: null });
      })
      .catch((e: unknown) => {
        if (!cancelled) setState({ text, dataUrl: null, error: e instanceof Error ? e.message : 'Contenu impossible à encoder.' });
      });
    return () => {
      cancelled = true;
    };
  }, [text, size]);

  // L'image n'est affichée que si elle correspond exactement au texte demandé.
  const dataUrl = state.text === text ? state.dataUrl : null;
  const error = state.text === text ? state.error : null;

  if (error) return <p className="qr-error">{error}</p>;
  if (!text) return <p className="qr-loading">Aucun contenu à encoder.</p>;
  if (!dataUrl) return <p className="qr-loading">Génération du QR…</p>;

  return (
    <div className="qr-block">
      <img src={dataUrl} width={size} height={size} alt="QR code de la campagne" />
      <div className="qr-actions">
        <a className="btn small" href={dataUrl} download={`${filename ?? 'qr-campagne'}.png`}>
          Télécharger le PNG
        </a>
        <button
          type="button"
          className="btn small"
          onClick={() => {
            const w = window.open('', '_blank');
            if (!w) return;
            w.document.write(
              `<html><head><title>QR</title><style>body{display:grid;place-items:center;height:100vh;margin:0}img{width:120mm}</style></head><body><img src="${dataUrl}"/></body></html>`
            );
            w.document.close();
            w.focus();
            w.print();
          }}
        >
          Imprimer
        </button>
      </div>
      <details className="qr-details">
        <summary>Contenu brut encodé ({text.length} caractères)</summary>
        <pre>{text}</pre>
      </details>
    </div>
  );
}
