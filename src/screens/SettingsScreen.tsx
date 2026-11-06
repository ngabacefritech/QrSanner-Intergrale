/**
 * Écran « Connexion » : réglage de l'API de campagnes et de la journalisation.
 *
 * Par défaut rien n'est configuré : l'application reste 100 % hors ligne et
 * n'envoie aucune donnée. L'activation est un choix explicite de l'opérateur.
 *
 * Politique de sécurité : HTTPS obligatoire, sauf adresses de réseau local
 * (développement). Aucun secret n'est saisi ni stocké côté mobile.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RemoteCampaignService } from '../services/campaignService';
import { getApiConfig, setApiConfig, validateApiBaseUrl } from '../services/apiConfig';
import { resetRegistryProvider } from '../services/registryProvider';
import type { RootStackParamList } from '../navigation/types';
import { colors, radius, spacing, typography } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

type Feedback = { tone: 'ok' | 'err'; text: string } | null;

const URL_PLACEHOLDER = 'http://192.168.1.20:4000';

export function SettingsScreen({ navigation }: Props) {
  const [baseUrl, setBaseUrl] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'save' | 'test' | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const config = await getApiConfig();
      if (cancelled) return;
      setBaseUrl(config.baseUrl);
      setEnabled(config.enabled);
      setDraft(config.baseUrl);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const draftUrl = draft.trim();
  const validation = useMemo(
    () => (draftUrl.length === 0 ? null : validateApiBaseUrl(draftUrl)),
    [draftUrl]
  );
  const canSave = validation?.ok === true;

  const applyConfig = useCallback(
    async (next: { baseUrl: string; enabled: boolean }) => {
      setBusy('save');
      try {
        const saved = await setApiConfig({ baseUrl: next.baseUrl, enabled: next.enabled });
        // Le service de registre est mémoïsé : on le force à se reconstruire.
        resetRegistryProvider();
        setBaseUrl(saved.baseUrl);
        setEnabled(saved.enabled);
        setDraft(saved.baseUrl);
        setFeedback(
          saved.enabled
            ? { tone: 'ok', text: `Synchronisation active — ${saved.baseUrl}.` }
            : { tone: 'ok', text: 'Registre local de démonstration réactivé.' }
        );
      } catch {
        setFeedback({ tone: 'err', text: 'Enregistrement impossible sur cet appareil.' });
      } finally {
        setBusy(null);
      }
    },
    []
  );

  const onSave = useCallback(() => {
    Keyboard.dismiss();
    if (!validation?.ok) {
      setFeedback({ tone: 'err', text: validation ? validation.message : 'Renseigne d’abord une URL.' });
      return;
    }
    void applyConfig({ baseUrl: validation.baseUrl, enabled: true });
  }, [applyConfig, validation]);

  const onTest = useCallback(async () => {
    Keyboard.dismiss();
    if (!validation?.ok) {
      setFeedback({ tone: 'err', text: validation ? validation.message : 'Renseigne d’abord une URL.' });
      return;
    }
    setBusy('test');
    setFeedback(null);
    try {
      const service = new RemoteCampaignService(validation.baseUrl);
      const campaigns = await service.listCampaigns();
      setFeedback(
        service.degraded
          ? { tone: 'err', text: 'API injoignable : vérifie l’URL, le port et le réseau (même Wi-Fi).' }
          : {
              tone: 'ok',
              text: `API joignable — ${campaigns.length} campagne${campaigns.length > 1 ? 's' : ''} active${campaigns.length > 1 ? 's' : ''}. Enregistre pour activer.`,
            }
      );
    } catch {
      setFeedback({ tone: 'err', text: 'API injoignable : adresse refusée par la politique de sécurité.' });
    } finally {
      setBusy(null);
    }
  }, [validation]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Connexion</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retour au scanner"
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
        >
          <Text style={styles.closeButtonText}>Retour au scanner</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.body}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>API de la console</Text>
                <View style={styles.sectionBody}>
                  <Text style={styles.label}>URL DE BASE</Text>
                  <TextInput
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    onChangeText={(text) => {
                      setDraft(text);
                      setFeedback(null);
                    }}
                    placeholder={URL_PLACEHOLDER}
                    placeholderTextColor={colors.textMuted}
                    returnKeyType="done"
                    style={[styles.input, validation && !validation.ok ? styles.inputWarn : null]}
                    testID="api-url-input"
                    value={draft}
                  />
                  <Text style={[styles.hint, validation && !validation.ok ? styles.hintWarn : null]}>
                    {validation && !validation.ok
                      ? validation.message
                      : 'HTTPS exigé ; http autorisé uniquement en local (localhost, 192.168.x.x, 10.x).'}
                  </Text>

                  <View style={styles.rowButtons}>
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy !== null}
                      onPress={() => void onTest()}
                      style={({ pressed }) => [
                        styles.buttonSecondary,
                        pressed && styles.pressed,
                        busy !== null && styles.buttonDisabled,
                      ]}
                      testID="api-test"
                    >
                      {busy === 'test' ? (
                        <ActivityIndicator color={colors.primary} size="small" />
                      ) : (
                        <Text style={styles.buttonSecondaryText}>Tester la connexion</Text>
                      )}
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy !== null || !canSave}
                      onPress={onSave}
                      style={({ pressed }) => [
                        styles.buttonPrimary,
                        pressed && styles.pressed,
                        (busy !== null || !canSave) && styles.buttonDisabled,
                      ]}
                      testID="api-save"
                    >
                      {busy === 'save' ? (
                        <ActivityIndicator color={colors.background} size="small" />
                      ) : (
                        <Text style={styles.buttonPrimaryText}>Activer la synchronisation</Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Registre utilisé</Text>
                <View style={styles.sectionBody}>
                  <View style={styles.switchRow}>
                    <View style={styles.switchLabel}>
                      <Text style={styles.stateTitle}>
                        {enabled ? 'Registre distant (API)' : 'Registre local (démonstration)'}
                      </Text>
                      <Text style={styles.hint}>
                        {enabled ? baseUrl : '6 campagnes embarquées dans l’application, aucune requête réseau.'}
                      </Text>
                    </View>
                    <Switch
                      accessibilityLabel="Activer la synchronisation avec l’API"
                      testID="sync-switch"
                      onValueChange={(value) => {
                        if (!value) {
                          void applyConfig({ baseUrl: '', enabled: false });
                          return;
                        }
                        if (validation?.ok) void applyConfig({ baseUrl: validation.baseUrl, enabled: true });
                      }}
                      trackColor={{ false: 'rgba(148,163,184,0.25)', true: colors.primary }}
                      value={enabled}
                    />
                  </View>
                  <Text style={styles.hint}>
                    Registre distant : les campagnes sont lues dans la console (création, activation, retrait en
                    direct) et chaque scan y est déclaré pour alimenter les statistiques. Réseau perdu : la
                    dernière liste connue est réutilisée, puis le contenu embarqué dans le QR.
                  </Text>
                  <Text style={styles.hint}>
                    Confidentialité : seul l’identifiant anonyme de la campagne est envoyé (ni nom, ni position,
                    ni identifiant d’appareil). Aucune donnée n’est transmise si la synchronisation est désactivée.
                  </Text>
                </View>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {feedback ? (
        <View style={[styles.toast, feedback.tone === 'ok' ? styles.toastOk : styles.toastErr]}>
          <Text style={styles.toastText}>{feedback.text}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1 },
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
  label: { ...typography.subtitle, fontSize: 10.5, letterSpacing: 1.4, textTransform: 'uppercase' },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.28)',
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    color: colors.text,
    fontSize: 14,
  },
  inputWarn: { borderColor: colors.danger },
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  hintWarn: { color: colors.danger },
  rowButtons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs, flexWrap: 'wrap' },
  buttonPrimary: {
    flex: 1,
    minWidth: 180,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimaryText: { color: colors.background, fontWeight: '700', fontSize: 13.5 },
  buttonSecondary: {
    flex: 1,
    minWidth: 160,
    height: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSecondaryText: { color: colors.primary, fontWeight: '600', fontSize: 13.5 },
  buttonDisabled: { opacity: 0.5 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  switchLabel: { flex: 1, gap: 2 },
  stateTitle: { color: colors.text, fontSize: 14.5, fontWeight: '600' },
  toast: {
    padding: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  toastOk: { backgroundColor: 'rgba(163,230,53,0.14)', borderColor: colors.border },
  toastErr: { backgroundColor: 'rgba(248,113,113,0.16)', borderColor: colors.danger },
  toastText: { color: colors.text, fontSize: 12.5, textAlign: 'center', lineHeight: 18 },
});
