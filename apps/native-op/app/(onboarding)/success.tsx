import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useConvex } from "convex/react";
import { colors, radii, card as cardStyle } from "../../constants/theme";

export default function OnboardingSuccessScreen() {
  const router = useRouter();
  const convex = useConvex();
  const [completing, setCompleting] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await (convex as any).query(
          "onboarding:getOnboardingStatus",
          {},
        );
        const primaryPropertyId = status?.primaryPropertyId ?? status?.property?._id;
        await (convex as any).mutation("onboarding:completeOnboarding", {
          primaryPropertyId: primaryPropertyId ?? undefined,
        });
      } catch {
      } finally {
        if (!cancelled) setCompleting(false);
      }
    })();
    return () => { cancelled = true; };
  }, [convex]);

  return (
    <View style={s.container}>
      <View style={[cardStyle, s.cardOverride]}>
        {completing ? (
          <ActivityIndicator color={colors.primary} size="large" />
        ) : (
          <>
            <View style={s.iconCircle}>
              <Text style={s.iconText}>{"\u2713"}</Text>
            </View>
            <Text style={s.title}>Details submitted successfully</Text>
            <Text style={s.subtitle}>
              Your account is all set up. Let's get started!
            </Text>
          </>
        )}
        <TouchableOpacity
          style={s.doneBtn}
          onPress={() => router.replace("/(app)/(tabs)")}
        >
          <Text style={s.doneBtnText}>Done</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  cardOverride: {
    width: "100%",
    maxWidth: 420,
    padding: 36,
    alignItems: "center",
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  iconText: { fontSize: 40, color: colors.white, fontWeight: "700" },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.navy,
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: colors.muted,
    marginBottom: 32,
    textAlign: "center",
    lineHeight: 20,
  },
  doneBtn: {
    borderRadius: radii.pill,
    paddingVertical: 15,
    paddingHorizontal: 52,
    backgroundColor: colors.primary,
  },
  doneBtnText: { fontSize: 16, fontWeight: "700", color: colors.white },
});
