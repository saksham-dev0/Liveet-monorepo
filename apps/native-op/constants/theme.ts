import { ViewStyle, TextStyle } from "react-native";

export const colors = {
  // Core palette aligned with dashboard + logo
  primary: "#1E293B", // used for key CTAs, matches hero card / nav bar
  primaryLight: "#E5E7EB", // subtle light state for disabled / hover
  navy: "#1E293B", // primary text-on-light + dark surfaces
  muted: "#6B7280", // secondary text (labels, helper copy)
  border: "#E2E8F0", // card & input borders
  inputBg: "#F3F4F6", // soft gray, matches transaction icon background
  cardBg: "#FFFFFF",
  pageBg: "#EEF2F6", // matches dashboard root background
  surfaceGray: "#F1F5F9",
  white: "#FFFFFF",
  error: "#DC2626",
  black: "#000000",
  progressTrack: "#D1D5DB",
  // Home / financial design accents
  trendBadge: "#D4F542", // same lime badge as dashboard change badge
  trendBadgeText: "#1A1A1A",
  spentCard: "#1E293B",
  savedCard: "#1E293B",
  investedCard: "#1E293B",
  positiveAmount: "#16A34A",
} as const;

export const radii = {
  card: 18,
  input: 12,
  pill: 999,
  chip: 999,
  checkbox: 5,
} as const;

export const cardShadow: ViewStyle = {
  shadowColor: "#0A1929",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.1,
  shadowRadius: 16,
  elevation: 6,
};

export const card: ViewStyle = {
  borderRadius: radii.card,
  padding: 22,
  backgroundColor: colors.cardBg,
  ...cardShadow,
};

export const input: ViewStyle & TextStyle = {
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: radii.input,
  paddingHorizontal: 14,
  paddingVertical: 13,
  fontSize: 15,
  backgroundColor: colors.inputBg,
  color: colors.navy,
};

export const label: TextStyle = {
  fontSize: 13,
  fontWeight: "600",
  marginTop: 16,
  marginBottom: 6,
  color: colors.navy,
};

export const stepLabel: TextStyle = {
  fontSize: 12,
  fontWeight: "500",
  color: colors.muted,
  marginBottom: 6,
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

export const title: TextStyle = {
  fontSize: 24,
  fontWeight: "800",
  color: colors.navy,
  marginBottom: 4,
};

export const subtitle: TextStyle = {
  fontSize: 14,
  color: colors.muted,
  marginBottom: 20,
  lineHeight: 20,
};

export const errorText: TextStyle = {
  color: colors.error,
  marginBottom: 10,
  fontSize: 13,
  fontWeight: "500",
};

export const loadingRow: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: 8,
  marginBottom: 12,
};

export const loadingText: TextStyle = {
  fontSize: 12,
  color: colors.muted,
};

export const primaryButton: ViewStyle = {
  flex: 1,
  borderRadius: radii.pill,
  paddingVertical: 15,
  alignItems: "center",
  backgroundColor: colors.primary,
};

export const primaryButtonDisabled: ViewStyle = {
  backgroundColor: colors.primaryLight,
};

export const primaryButtonText: TextStyle = {
  fontSize: 15,
  fontWeight: "700",
  color: colors.white,
};

export const secondaryButton: ViewStyle = {
  flex: 1,
  borderRadius: radii.pill,
  paddingVertical: 15,
  alignItems: "center",
  borderWidth: 1.5,
  borderColor: colors.border,
  backgroundColor: colors.white,
};

export const secondaryButtonText: TextStyle = {
  fontSize: 15,
  fontWeight: "600",
  color: colors.navy,
};

export const footerRow: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: 12,
  marginTop: 28,
};

export const chip: ViewStyle = {
  paddingHorizontal: 16,
  paddingVertical: 10,
  borderRadius: radii.chip,
  borderWidth: 1.5,
  borderColor: colors.border,
  backgroundColor: colors.inputBg,
};

export const chipActive: ViewStyle = {
  backgroundColor: colors.primary,
  borderColor: colors.primary,
};

export const chipText: TextStyle = {
  fontSize: 14,
  fontWeight: "500",
  color: colors.navy,
};

export const chipTextActive: TextStyle = {
  color: colors.white,
};

export const chipRow: ViewStyle = {
  flexDirection: "row",
  flexWrap: "wrap",
  gap: 8,
};

export const sectionHeader: TextStyle = {
  fontSize: 14,
  fontWeight: "700",
  marginTop: 20,
  marginBottom: 8,
  color: colors.navy,
};

export const multilineInput: TextStyle & {
  textAlignVertical?: "top" | "center" | "bottom" | "auto";
} = {
  minHeight: 80,
  textAlignVertical: "top",
};

export const container: ViewStyle = {
  flexGrow: 1,
  paddingHorizontal: 20,
  paddingTop: 12,
  paddingBottom: 32,
};
