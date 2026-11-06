
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Chemin de la base SQLite
const DB_PATH = path.resolve(__dirname, "../data/qrscanner.db");

// Dossier des sauvegardes
const BACKUP_DIR = path.resolve(__dirname, "../backups");

let db;

async function main() {
    try {
        console.log("\n===== QRSCANNER MIGRATION =====\n");

        // Vérifier la base
        if (!fs.existsSync(DB_PATH)) {
            throw new Error(`Base introuvable : ${DB_PATH}`);
        }

        db = new Database(DB_PATH);
        db.pragma("foreign_keys = ON");

        console.log("Base détectée :", DB_PATH);

        // 1. Sauvegarde automatique
        fs.mkdirSync(BACKUP_DIR, { recursive: true });

        const timestamp = new Date()
            .toISOString()
            .replace(/[:.]/g, "-");

        const backupPath = path.join(
            BACKUP_DIR,
            `qrscanner-backup-${timestamp}.db`
        );

        await db.backup(backupPath);

        console.log("Sauvegarde créée :", backupPath);

        // 2. Table de suivi des migrations
        db.exec(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version INTEGER PRIMARY KEY,
                description TEXT NOT NULL,
                applied_at TEXT NOT NULL
            );
        `);

        // 3. Vérification des colonnes
        function checkColumns(table, requiredColumns) {
            const columns = db.prepare(
                `PRAGMA table_info("${table}")`
            ).all();

            const existing = columns.map(col => col.name);

            const missing = requiredColumns.filter(
                column => !existing.includes(column)
            );

            if (missing.length) {
                throw new Error(
                    `Colonnes manquantes dans ${table} : ${missing.join(", ")}`
                );
            }
        }

        // 4. Migration version 1
        const version = 1;

        const applied = db.prepare(`
            SELECT version
            FROM schema_migrations
            WHERE version = ?
        `).get(version);

        if (!applied) {
            const migration = db.transaction(() => {

                // Création uniquement si les tables n'existent pas
                db.exec(`
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
                        is_active INTEGER NOT NULL DEFAULT 1,
                        allow_early_skip INTEGER NOT NULL DEFAULT 0,
                        created_at TEXT NOT NULL
                    );

                    CREATE TABLE IF NOT EXISTS scans (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        campaign_id TEXT NOT NULL,
                        scanned_at TEXT NOT NULL,
                        platform TEXT,
                        app_version TEXT,
                        source TEXT NOT NULL DEFAULT 'unknown'
                    );

                    CREATE INDEX IF NOT EXISTS idx_scans_day
                    ON scans(scanned_at);

                    CREATE INDEX IF NOT EXISTS idx_scans_campaign
                    ON scans(campaign_id);
                `);

                // Vérification de la structure existante
                checkColumns("campaigns", [
                    "id",
                    "title",
                    "description",
                    "media_type",
                    "media_url",
                    "fallback_url",
                    "duration_seconds",
                    "is_active",
                    "allow_early_skip",
                    "created_at"
                ]);

                checkColumns("scans", [
                    "id",
                    "campaign_id",
                    "scanned_at",
                    "platform",
                    "app_version",
                    "source"
                ]);

                // Enregistrer la migration
                db.prepare(`
                    INSERT INTO schema_migrations
                    (version, description, applied_at)
                    VALUES (?, ?, ?)
                `).run(
                    version,
                    "Structure initiale QRScanner",
                    new Date().toISOString()
                );
            });

            migration();

            console.log("Migration V1 appliquée.");
        } else {
            console.log("Migration V1 déjà appliquée.");
        }

        // 5. Vérification finale
        const campaigns = db.prepare(
            "SELECT COUNT(*) AS total FROM campaigns"
        ).get().total;

        const scans = db.prepare(
            "SELECT COUNT(*) AS total FROM scans"
        ).get().total;

        console.log("\n===== RESULTAT =====");
        console.log("Campagnes :", campaigns);
        console.log("Scans :", scans);
        console.log("Migration terminée avec succès !");

    } catch (error) {
        console.error("\nERREUR :", error.message);
        process.exitCode = 1;

    } finally {
        if (db) db.close();
    }
}

await main();
