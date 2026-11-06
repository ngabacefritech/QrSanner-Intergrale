/**
 * Écran « À propos » : informations produit, registre de démonstration,
 * règles de sécurité et valeurs de QR codes à reproduire pour les tests.
 */
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { campaignService } from '../services/campaignService';
import { getApiConfig } from '../services/apiConfig';
import type { CampaignRecord } from '../types/campaign';
import { colors, radius, spacing, typography } from '../theme';

type AboutNavigation = NativeStackNavigationProp<RootStackParamList, 'About'>;

export function AboutScreen() {
  const navigation = useNavigation<AboutNavigation>();
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [registryLabel, setRegistryLabel] = useState('Registre local (démonstration)');

  const reload = useCallback(async () => {
    try {
      setCampaigns(await campaignService.listCampaigns());
      setLoadError(null);
    } catch {
      setLoadError('Registre de campagnes indisponible (mode hors ligne).');
    }
  }, []);

  useEffect(() => {
    void reload();
    void (async () => {
      const config = await getApiConfig();
      setRegistryLabel(
        config.enabled ? `Registre distant — ${config.baseUrl}` : 'Registre local (démonstration)'
      );
    })();
  }, [reload]);

  const version = Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? '1.0.0';
  const runtime = Constants.expoConfig?.sdkVersion ?? 'inconnue';

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>À propos</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retour au scanner"
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
        >
          <Text style={styles.closeButtonText}>Retour au scanner</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Section title="QRScanner">
          <Text style={styles.paragraph}>
            QRScanner lit un QR code avec la caméra, retrouve la campagne publicitaire associée,
            affiche la publicité en plein écran (image ou vidéo MP4) pendant une durée configurable,
            puis revient automatiquement au scanner.
          </Text>
          <KeyValue label="Version" value={version} />
          <KeyValue label="SDK Expo" value={runtime} />
          <KeyValue label="Registre" value={registryLabel} />
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('Settings')}
            style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}
            testID="open-settings"
          >
            <Text style={styles.linkButtonText}>Configurer la connexion API</Text>
          </Pressable>
        </Section>

        <Section title="Sécurité & confidentialité">
          <Bullet>
            Aucune donnée personnelle n’est collectée ni envoyée. Sans synchronisation activée, l’application
            n’effectue aucune requête réseau.
          </Bullet>
          <Bullet>
            Avec la synchronisation, seul l’identifiant anonyme de la campagne est échangé avec l’API (aucun
            identifiant d’appareil, aucune position).
          </Bullet>
          <Bullet>Le contenu d’un QR code n’est jamais exécuté ni ouvert dans un navigateur.</Bullet>
          <Bullet>Seuls les médias HTTPS (ou localhost en développement) sont chargés.</Bullet>
          <Bullet>Aucune clé API n’est embarquée dans l’application.</Bullet>
          <Bullet>La caméra n’est activée que sur l’écran de scan, jamais en arrière-plan.</Bullet>
        </Section>

        <Section title="Campagnes de démonstration">
          {loadError ? <Text style={styles.error}>{loadError}</Text> : null}
          {campaigns.length === 0 && !loadError ? (
            <Text style={styles.paragraph}>Chargement du registre…</Text>
          ) : null}
          {campaigns.map((campaign) => (
            <CampaignRow key={campaign.id} campaign={campaign} />
          ))}
          <Text style={styles.note}>
            Les QR codes prêts à imprimer sont dans assets/qr-codes/ (démo uniquement : aucun
            de ces liens n’est ouvert par l’application).
          </Text>
        </Section>

        <Section title="Licence & médias">
          <Text style={styles.paragraph}>
            Visuels, vidéos et textes de démonstration : contenus fictifs générés pour ce projet.
            Remplacez-les par vos propres créations avant toute diffusion.
          </Text>
        </Section>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.keyValue}>
      <Text style={styles.key}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.bulletRow}>
      <View style={styles.bulletDot} />
      <Text style={styles.paragraph}>{children}</Text>
    </View>
  );
}

function CampaignRow({ campaign }: { campaign: CampaignRecord }) {
  const media =
    campaign.mediaSource.kind === 'asset'
      ? `asset local · ${campaign.mediaType}`
      : `HTTPS distant · ${campaign.mediaType}`;
  return (
    <View style={styles.campaignRow}>
      <View style={styles.campaignHead}>
        <Text style={styles.campaignId}>{campaign.id}</Text>
        <View style={[styles.badge, campaign.isActive ? styles.badgeActive : styles.badgeOff]}>
          <Text style={styles.badgeText}>{campaign.isActive ? 'ACTIVE' : 'INACTIVE'}</Text>
        </View>
      </View>
      <Text style={styles.campaignTitle}>{campaign.title}</Text>
      <Text style={styles.campaignMeta}>
        {media} · {campaign.durationSeconds} s
      </Text>
      <Text style={styles.campaignValue}>{campaign.qrCodeValue}</Text>
      {campaign.description ? <Text style={styles.campaignDesc}>{campaign.description}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl + 22,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTitle: { ...typography.title, fontSize: 20 },
  closeButton: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  closeButtonText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  pressed: { opacity: 0.7 },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 60 },
  section: { gap: spacing.sm },
  sectionTitle: {
    ...typography.subtitle,
    color: colors.success,
    textTransform: 'uppercase',
    fontSize: 11,
    letterSpacing: 1.6,
  },
  sectionBody: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(148,163,184,0.18)',
    padding: spacing.md,
    gap: 10,
  },
  paragraph: { color: colors.textMuted, fontSize: 13.5, lineHeight: 20 },
  error: { color: colors.danger, fontSize: 13 },
  keyValue: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingTop: 2 },
  key: { color: colors.textMuted, fontSize: 13 },
  value: { ...typography.mono, color: colors.text, fontSize: 12.5, flexShrink: 1, textAlign: 'right' },
  bulletRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  bulletDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary, marginTop: 7 },
  campaignRow: { gap: 4, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(148,163,184,0.16)' },
  campaignHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  campaignId: { ...typography.mono, color: colors.primary, fontSize: 12 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill },
  badgeActive: { backgroundColor: 'rgba(163,230,53,0.16)' },
  badgeOff: { backgroundColor: 'rgba(248,113,113,0.16)' },
  badgeText: { fontSize: 9.5, letterSpacing: 1, color: colors.text, fontWeight: '700' },
  campaignTitle: { color: colors.text, fontSize: 14.5, fontWeight: '600' },
  campaignMeta: { color: colors.textMuted, fontSize: 12 },
  campaignValue: { ...typography.mono, fontSize: 11.5, color: colors.textMuted },
  campaignDesc: { color: colors.textMuted, fontSize: 12, fontStyle: 'italic' },
  note: { color: colors.warning, fontSize: 12, lineHeight: 18 },
  linkButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    marginTop: 2,
  },
  linkButtonText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
});
