/** Thème sombre commun aux écrans (noir profond / bleu nuit, accents cyan et vert). */
export const colors = {
  background: '#070B1A',
  surface: '#0D142D',
  surfaceElevated: '#121B3A',
  border: 'rgba(34, 211, 238, 0.35)',
  borderStrong: 'rgba(34, 211, 238, 0.65)',
  primary: '#22D3EE',
  success: '#A3E635',
  warning: '#FBBF24',
  danger: '#F87171',
  text: '#F8FAFC',
  textMuted: '#94A3B8',
  overlay: 'rgba(7, 11, 26, 0.92)',
  scrim: 'rgba(7, 11, 26, 0.55)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const typography = {
  title: { fontSize: 26, fontWeight: '700' as const, color: colors.text, letterSpacing: 1.5 },
  subtitle: { fontSize: 14, fontWeight: '500' as const, color: colors.textMuted },
  body: { fontSize: 15, color: colors.text },
  mono: { fontSize: 12, fontFamily: 'monospace', color: colors.primary },
  countdown: { fontSize: 34, fontWeight: '700' as const, color: colors.text },
};

export const radius = { sm: 8, md: 14, lg: 22, pill: 999 } as const;
