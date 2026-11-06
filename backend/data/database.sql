
-- ==========================================
-- QRSCANNER - BASE DE DONNEES SQLITE
-- ==========================================

PRAGMA foreign_keys = ON;

-- ==========================================
-- TABLE : CAMPAIGNS
-- Gestion des publicités et vidéos
-- ==========================================

CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,

    media_type TEXT NOT NULL
        CHECK (media_type IN ('image', 'video')),

    media_url TEXT NOT NULL,
    fallback_url TEXT,

    duration_seconds INTEGER NOT NULL
        CHECK (duration_seconds BETWEEN 1 AND 300),

    is_active INTEGER NOT NULL DEFAULT 1
        CHECK (is_active IN (0, 1)),

    allow_early_skip INTEGER NOT NULL DEFAULT 0
        CHECK (allow_early_skip IN (0, 1)),

    created_at TEXT NOT NULL
);

-- ==========================================
-- TABLE : SCANS
-- Historique des QR codes scannés
-- ==========================================

CREATE TABLE IF NOT EXISTS scans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    campaign_id TEXT NOT NULL,

    scanned_at TEXT NOT NULL,

    platform TEXT,

    app_version TEXT,

    source TEXT NOT NULL DEFAULT 'unknown',

    FOREIGN KEY (campaign_id)
        REFERENCES campaigns(id)
        ON DELETE CASCADE
);

-- ==========================================
-- INDEX POUR AMELIORER LES RECHERCHES
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_scans_day
ON scans(scanned_at);

CREATE INDEX IF NOT EXISTS idx_scans_campaign
ON scans(campaign_id);

-- ==========================================
-- FIN DE LA BASE DE DONNEES
-- ==========================================
