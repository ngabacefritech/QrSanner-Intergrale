import { useState } from 'react';
import { CampaignsPage } from './pages/CampaignsPage';
import { ConnectionPage } from './pages/ConnectionPage';
import { OverviewPage } from './pages/OverviewPage';

type Tab = 'overview' | 'campaigns' | 'connection';

export default function App() {
  const [tab, setTab] = useState<Tab>('overview');

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <span className="dot" />
          <div>
            <strong>QRScanner</strong>
            <p>Console publicitaire</p>
          </div>
        </div>
        <nav className="nav">
          <TabButton active={tab === 'overview'} onClick={() => setTab('overview')} label="Vue d’ensemble" hint="statistiques" />
          <TabButton active={tab === 'campaigns'} onClick={() => setTab('campaigns')} label="Campagnes & QR" hint="créer, imprimer" />
          <TabButton active={tab === 'connection'} onClick={() => setTab('connection')} label="Connexion" hint="API & mobile" />
        </nav>
        <p className="side-foot">
          Données stockées dans la SQLite du backend.
          <br />
          Aucun traceur, aucune donnée personnelle.
        </p>
      </aside>
      <main className="main">
        {tab === 'overview' && <OverviewPage />}
        {tab === 'campaigns' && <CampaignsPage />}
        {tab === 'connection' && <ConnectionPage />}
      </main>
    </div>
  );
}

function TabButton({ active, onClick, label, hint }: { active: boolean; onClick: () => void; label: string; hint: string }) {
  return (
    <button type="button" className={`nav-btn ${active ? 'active' : ''}`} onClick={onClick}>
      <span>{label}</span>
      <small>{hint}</small>
    </button>
  );
}
