import { useState } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { colors, radii } from "../../constants/theme";

const FEATURES = [
  {
    emoji: "🏠",
    title: "Manage all your properties",
    desc: "Add rooms, set rent, track vacancies — all in one place.",
  },
  {
    emoji: "💸",
    title: "Rent collection, simplified",
    desc: "Know exactly who has paid and who hasn't, every month.",
  },
  {
    emoji: "📋",
    title: "Tenant management",
    desc: "Move-ins, move-outs, agreements and KYC without the paperwork.",
  },
  {
    emoji: "💬",
    title: "Direct tenant chat",
    desc: "Handle complaints and requests without switching apps.",
  },
];

export default function IntroScreen() {
  const router = useRouter();
  const { name } = useLocalSearchParams<{ name?: string }>();
  const displayName = name ?? "there";

  const [page, setPage] = useState(0);

  const goToSteps = () => {
    router.push({
      pathname: "/(onboarding)/personal-details" as any,
      params: { name: displayName },
    });
  };

  if (page === 0) {
    return (
      <TouchableOpacity
        style={s.container}
        activeOpacity={1}
        onPress={() => setPage(1)}
      >
        <View style={s.narrativeContent}>
          <Text style={s.narrativeText}>
            <Text style={s.narrativeHighlight}>{"Alright "}{displayName}{", "}</Text>
            <Text>{"let's get your property up and running on "}</Text>
            <Text style={s.narrativeHighlight}>{"Liveet."}</Text>
          </Text>
          <Text style={s.narrativeSub}>{"Takes less than 3 minutes. Promise."}</Text>
        </View>
        <Text style={s.tap}>Tap to continue →</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={s.container}>
      <View style={s.featuresContent}>
        {FEATURES.map((f) => (
          <View key={f.title} style={s.featureCard}>
            <Text style={s.featureEmoji}>{f.emoji}</Text>
            <View style={s.featureText}>
              <Text style={s.featureTitle}>{f.title}</Text>
              <Text style={s.featureDesc}>{f.desc}</Text>
            </View>
          </View>
        ))}

        <View style={s.ctaBlock}>
          <Text style={s.ctaHeading}>{"You're in the right place!"}</Text>
          <Text style={s.ctaSub}>
            {"Thousands of operators use Liveet to run their properties stress-free."}
          </Text>
        </View>
      </View>

      <TouchableOpacity style={s.btn} onPress={goToSteps} activeOpacity={0.8}>
        <Text style={s.btnText}>{"Let's get started"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
    paddingHorizontal: 28,
    paddingBottom: 48,
  },
  narrativeContent: {
    flex: 1,
    justifyContent: "center",
  },
  narrativeText: {
    fontSize: 32,
    fontWeight: "800",
    color: colors.navy,
    lineHeight: 44,
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  narrativeHighlight: {
    color: colors.navy,
    fontWeight: "800",
    textDecorationLine: "underline",
    textDecorationColor: colors.trendBadge,
  },
  narrativeSub: {
    fontSize: 16,
    color: colors.muted,
    lineHeight: 24,
  },
  tap: {
    alignSelf: "flex-end",
    fontSize: 16,
    fontWeight: "500",
    color: colors.navy,
  },
  featuresContent: {
    flex: 1,
    justifyContent: "center",
    gap: 12,
  },
  featureCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceGray,
    borderRadius: radii.card,
    padding: 16,
    gap: 14,
  },
  featureEmoji: {
    fontSize: 32,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.navy,
    marginBottom: 2,
  },
  featureDesc: {
    fontSize: 13,
    color: colors.muted,
    lineHeight: 18,
  },
  ctaBlock: {
    marginTop: 8,
  },
  ctaHeading: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.navy,
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  ctaSub: {
    fontSize: 14,
    color: colors.muted,
    lineHeight: 20,
  },
  btn: {
    borderRadius: radii.pill,
    paddingVertical: 17,
    alignItems: "center",
    backgroundColor: colors.navy,
  },
  btnText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.white,
  },
});
