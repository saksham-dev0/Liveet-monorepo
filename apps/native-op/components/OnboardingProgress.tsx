import { StyleSheet, Text, View } from "react-native";
import { colors } from "../constants/theme";

const STEP_NAMES = [
  "Personal Details",
  "Property Details",
  "Occupancy Type",
  "Room Setup",
  "Agreement & Rent",
  "Tenant Setup",
];

interface Props {
  step: number;
  total?: number;
}

export function OnboardingProgress({ step, total = 6 }: Props) {
  const pct = Math.round((step / total) * 100);
  return (
    <View style={s.wrapper}>
      <View style={s.topRow}>
        <Text style={s.stepText}>Step {step} of {total}</Text>
        <Text style={s.pctText}>{pct}%</Text>
      </View>
      <View style={s.track}>
        <View style={[s.fill, { width: `${pct}%` as any }]} />
      </View>
      <View style={s.dotsRow}>
        {Array.from({ length: total }).map((_, i) => (
          <View
            key={i}
            style={[
              s.dot,
              i < step && s.dotDone,
              i === step - 1 && s.dotCurrent,
            ]}
          />
        ))}
      </View>
      <Text style={s.stepName}>{STEP_NAMES[step - 1] ?? ""}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: { marginBottom: 24 },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  stepText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  pctText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.navy,
  },
  track: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 10,
  },
  fill: {
    height: "100%",
    backgroundColor: colors.navy,
    borderRadius: 2,
  },
  dotsRow: {
    flexDirection: "row",
    gap: 4,
    marginBottom: 14,
  },
  dot: {
    height: 4,
    flex: 1,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  dotDone: { backgroundColor: colors.navy },
  dotCurrent: { backgroundColor: colors.navy },
  stepName: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.navy,
  },
});
