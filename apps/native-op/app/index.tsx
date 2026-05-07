import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { useConvex } from "convex/react";

type OnboardingRoute = "/(app)/(tabs)" | "/(onboarding)" | "/(onboarding)/import-method";

export default function Index() {
  const { isLoaded, isSignedIn } = useAuth();
  const convex = useConvex();
  const [loading, setLoading] = useState(true);
  const [redirect, setRedirect] = useState<OnboardingRoute | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const status = await (convex as any).query("onboarding:getOnboardingStatus", {});
        if (cancelled) return;

        if (status?.hasCompletedOnboarding) {
          setRedirect("/(app)/(tabs)");
          return;
        }

        // Determine if user has started any onboarding step
        const hasStarted =
          !!status?.onboardingProfile ||
          !!status?.businessProfile ||
          !!status?.account ||
          !!status?.property;

        setRedirect(hasStarted ? "/(onboarding)" : "/(onboarding)/import-method");
      } catch {
        if (!cancelled) setRedirect("/(onboarding)/import-method");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isLoaded, isSignedIn, convex]);

  if (!isLoaded || loading) {
    return (
      <View className="flex-1 items-center justify-center bg-brand-page-bg">
        <ActivityIndicator color="#3083FF" />
      </View>
    );
  }

  if (!isSignedIn) {
    return <Redirect href="/(auth)" />;
  }

  return <Redirect href={redirect ?? "/(onboarding)/import-method"} />;
}
