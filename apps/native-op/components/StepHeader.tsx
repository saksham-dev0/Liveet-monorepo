import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors } from "../constants/theme";

interface Props {
  step: number;
  total?: number;
  onBack?: () => void;
  onSkip?: () => void;
  showSkip?: boolean;
  showBack?: boolean;
}

export function StepHeader({
  step,
  total = 5,
  onBack,
  onSkip,
  showSkip = true,
  showBack = true,
}: Props) {
  return (
    <View style={s.wrapper}>
      <View style={s.row}>
        {showBack ? (
          <TouchableOpacity onPress={onBack} style={s.navBtn} activeOpacity={0.6}>
            <Text style={s.navText}>‹ Previous</Text>
          </TouchableOpacity>
        ) : (
          <View style={s.navBtn} />
        )}

        <Text style={s.counter}>{step}/{total}</Text>

        {showSkip ? (
          <TouchableOpacity onPress={onSkip} style={[s.navBtn, s.navBtnRight]} activeOpacity={0.6}>
            <Text style={s.navText}>Skip ›</Text>
          </TouchableOpacity>
        ) : (
          <View style={s.navBtn} />
        )}
      </View>

      <View style={s.segments}>
        {Array.from({ length: total }).map((_, i) => (
          <View
            key={i}
            style={[s.segment, i < step && s.segmentDone]}
          />
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: {
    marginBottom: 32,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  navBtn: {
    minWidth: 80,
  },
  navBtnRight: {
    alignItems: "flex-end",
  },
  navText: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.muted,
  },
  counter: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.navy,
  },
  segments: {
    flexDirection: "row",
    gap: 5,
  },
  segment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  segmentDone: {
    backgroundColor: colors.navy,
  },
});
