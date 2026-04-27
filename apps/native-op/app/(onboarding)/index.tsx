import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useConvex } from "convex/react";
import {
  colors,
  radii,
  card as cardStyle,
  container as containerStyle,
} from "../../constants/theme";

type OnboardingSectionKey = "business" | "account" | "property" | "referral";

type OnboardingSection = {
  key: OnboardingSectionKey;
  title: string;
  description: string;
  route: string;
};

const SECTIONS: OnboardingSection[] = [
  {
    key: "business",
    title: "Add business details",
    description: "Tell us about you and your business.",
    route: "/(onboarding)/personal-details",
  },
  {
    key: "account",
    title: "Add bank account details",
    description: "Choose how you'd like to receive payments.",
    route: "/(onboarding)/account",
  },
  {
    key: "property",
    title: "Add your property details",
    description: "Configure rooms, rent and other charges.",
    route: "/(onboarding)/property/basic",
  },
  {
    key: "referral",
    title: "Add referral code",
    description: "Apply a referral code if you have one.",
    route: "/(onboarding)/referral",
  },
];

export default function OnboardingHome() {
  const router = useRouter();
  const convex = useConvex();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<any | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await (convex as any).query(
          "onboarding:getOnboardingStatus",
          {},
        );
        if (!cancelled) setStatus(s);
      } catch {
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [convex]);

  const completedKeys = new Set<OnboardingSectionKey>();
  if (status?.onboardingProfile && status?.businessProfile)
    completedKeys.add("business");
  if (status?.account) completedKeys.add("account");
  if (status?.property && status?.agreement && status?.rent)
    completedKeys.add("property");
  if (status?.referralCode) completedKeys.add("referral");

  const completedCount = completedKeys.size;
  const progressPercent = Math.round(
    (completedCount / SECTIONS.length) * 100,
  );

  const userName =
    (status as any)?.user?.name && typeof (status as any).user.name === "string"
      ? (status as any).user.name.split(" ")[0]
      : "there";

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={containerStyle}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <TouchableOpacity
        style={s.backBtn}
        onPress={() => router.canGoBack() ? router.back() : router.replace("/(onboarding)" as any)}
        activeOpacity={0.7}
      >
        <Ionicons name="arrow-back" size={20} color={colors.navy} />
        <Text style={s.backText}>Back</Text>
      </TouchableOpacity>

      <View style={s.headerRow}>
        <View style={s.headerText}>
          <Text style={s.greetingLabel}>Welcome back</Text>
          <Text style={s.greetingName}>{userName}</Text>
        </View>
        <View style={s.headerPill}>
          <View style={s.headerDot} />
          <Text style={s.headerPillText}>
            {completedCount === SECTIONS.length
              ? "Almost live"
              : "Finish setup"}
          </Text>
        </View>
      </View>

      <View style={s.heroCard}>
        <View style={s.heroHeader}>
          <View>
            <Text style={s.heroLabel}>Onboarding status</Text>
            <Text style={s.heroTitle}>Get your property live</Text>
          </View>
          <View style={s.progressBadge}>
            <Text style={s.progressBadgeText}>{progressPercent}% done</Text>
          </View>
        </View>

        <View style={s.progressTrack}>
          <View
            style={[s.progressFill, { width: `${progressPercent}%` }]}
          />
        </View>

        <Text style={s.heroSubtitle}>
          Complete these steps so guests can start booking and paying online.
        </Text>
      </View>

      <View style={s.card}>
        <Text style={s.heading}>
          Follow these {SECTIONS.length} steps to go live
        </Text>

        {loading ? (
          <View style={s.loadingRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={s.loadingText}>Loading your progress...</Text>
          </View>
        ) : (
          SECTIONS.map((section, index) => {
            const done = completedKeys.has(section.key);
            const num = index + 1;
            const isLast = index === SECTIONS.length - 1;
            return (
              <View key={section.key} style={s.row}>
                <View style={s.indicatorCol}>
                  <View style={[s.circle, done && s.circleDone]}>
                    <Text style={[s.circleText, done && s.circleTextDone]}>
                      {done ? "\u2713" : num}
                    </Text>
                  </View>
                  {!isLast && <View style={[s.line, done && s.lineDone]} />}
                </View>
                <View style={s.content}>
                  <Text style={s.sectionTitle}>{section.title}</Text>
                  <Text style={s.sectionDesc}>{section.description}</Text>
                </View>
                <TouchableOpacity
                  style={[s.actionBtn, done && s.actionBtnDone]}
                  onPress={() => router.push(section.route as any)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.actionText, done && s.actionTextDone]}>
                    {done ? "Edit" : "Add"}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.pageBg,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 16,
  },
  backText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.navy,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  headerText: {
    flex: 1,
    marginRight: 12,
  },
  greetingLabel: {
    fontSize: 12,
    color: colors.muted,
  },
  greetingName: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.navy,
    marginTop: 2,
  },
  headerPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginRight: 6,
  },
  headerPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.navy,
  },
  heroCard: {
    backgroundColor: "#1E293B",
    borderRadius: 20,
    padding: 20,
    marginBottom: 18,
  },
  heroHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  heroLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.55)",
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
  },
  progressBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#D4F542",
  },
  progressBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  progressTrack: {
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: "rgba(148, 163, 184, 0.4)",
    overflow: "hidden",
    marginBottom: 12,
  },
  progressFill: {
    height: "100%",
    borderRadius: radii.pill,
    backgroundColor: "#D4F542",
  },
  heroSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: "rgba(249, 250, 251, 0.8)",
  },
  card: {
    ...cardStyle,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.navy,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.muted,
    marginBottom: 24,
    lineHeight: 20,
  },
  heading: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 20,
    color: colors.navy,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
  },
  loadingText: { fontSize: 13, color: colors.muted },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  indicatorCol: { alignItems: "center", marginRight: 16, width: 32 },
  circle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
  },
  circleDone: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  circleText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.muted,
  },
  circleTextDone: { color: colors.white },
  line: {
    width: 2.5,
    height: 40,
    marginVertical: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
  },
  lineDone: { backgroundColor: colors.primary },
  content: { flex: 1, paddingTop: 4 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.navy,
    marginBottom: 2,
  },
  sectionDesc: {
    fontSize: 13,
    color: colors.muted,
    lineHeight: 18,
  },
  actionBtn: {
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    marginTop: 2,
  },
  actionBtnDone: { backgroundColor: colors.primaryLight },
  actionText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.white,
  },
  actionTextDone: { color: colors.primary },
});
