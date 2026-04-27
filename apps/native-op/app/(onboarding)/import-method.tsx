import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  colors,
  radii,
  card as cardStyle,
  container as containerStyle,
} from "../../constants/theme";

export default function ImportMethodScreen() {
  const router = useRouter();

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={[containerStyle, s.center]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={s.title}>How would you like to set up?</Text>
      <Text style={s.subtitle}>
        Choose how you want to add your property and tenant details.
      </Text>

      {/* Manual option */}
      <TouchableOpacity
        style={s.optionCard}
        activeOpacity={0.7}
        onPress={() => router.push("/(onboarding)" as any)}
      >
        <View style={s.iconCircle}>
          <Ionicons name="create-outline" size={28} color={colors.white} />
        </View>
        <Text style={s.optionTitle}>Add details manually</Text>
        <Text style={s.optionDesc}>
          Step-by-step setup — enter your property, rooms, and tenant info one
          by one.
        </Text>
        <View style={s.optionFooter}>
          <Text style={s.optionFooterText}>Get started</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.primary} />
        </View>
      </TouchableOpacity>

      {/* Import option */}
      <TouchableOpacity
        style={s.optionCard}
        activeOpacity={0.7}
        onPress={() => router.push("/(onboarding)/bulk-import" as any)}
      >
        <View style={[s.iconCircle, s.iconCircleAlt]}>
          <Ionicons name="document-text-outline" size={28} color={colors.white} />
        </View>
        <Text style={s.optionTitle}>Import from file</Text>
        <Text style={s.optionDesc}>
          Upload an Excel (.xlsx) or CSV file with your tenant data and let AI
          set everything up for you.
        </Text>
        <View style={s.pillRow}>
          <View style={s.pill}>
            <Text style={s.pillText}>.xlsx</Text>
          </View>
          <View style={s.pill}>
            <Text style={s.pillText}>.csv</Text>
          </View>
          <View style={[s.pill, s.pillAi]}>
            <Ionicons name="sparkles" size={12} color="#D4F542" />
            <Text style={[s.pillText, s.pillAiText]}>AI powered</Text>
          </View>
        </View>
        <View style={s.optionFooter}>
          <Text style={s.optionFooterText}>Upload file</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.primary} />
        </View>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.pageBg },
  center: { justifyContent: "center", minHeight: "100%" },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.navy,
    marginBottom: 6,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: colors.muted,
    textAlign: "center",
    marginBottom: 28,
    lineHeight: 20,
    paddingHorizontal: 12,
  },
  optionCard: {
    ...cardStyle,
    marginBottom: 16,
    alignItems: "center",
    paddingVertical: 28,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  iconCircleAlt: {
    backgroundColor: "#16A34A",
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.navy,
    marginBottom: 6,
  },
  optionDesc: {
    fontSize: 13,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 19,
    paddingHorizontal: 8,
    marginBottom: 14,
  },
  pillRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.muted,
  },
  pillAi: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pillAiText: {
    color: "#D4F542",
  },
  optionFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  optionFooterText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primary,
  },
});
