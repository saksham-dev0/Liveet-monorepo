import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { useConvex } from "convex/react";
import { useEffect, useState } from "react";

export default function Index() {
  const { isLoaded, isSignedIn } = useAuth();
  const convex = useConvex();
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    (convex as any)
      .query("users:getCurrentUser", {})
      .then((user: { hasCompletedOnboarding?: boolean } | null) => {
        setOnboardingDone(user?.hasCompletedOnboarding ?? false);
      })
      .catch(() => setOnboardingDone(false));
  }, [isLoaded, isSignedIn, convex]);

  if (!isLoaded || (isSignedIn && onboardingDone === null)) {
    return (
      <View className="flex-1 items-center justify-center bg-brand-page-bg">
        <ActivityIndicator color="#3083FF" />
      </View>
    );
  }

  if (!isSignedIn) {
    return <Redirect href="/(auth)" />;
  }

  if (onboardingDone) {
    return <Redirect href="/(app)" />;
  }

  return <Redirect href="/(onboarding)/welcome" />;
}
