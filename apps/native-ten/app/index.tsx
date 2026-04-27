import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { useConvex } from "convex/react";

export default function Index() {
  const { isLoaded, isSignedIn } = useAuth();
  const convex = useConvex();
  const [checked, setChecked] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setChecked(true);
      return;
    }
    // Returning authenticated user — check if they completed onboarding
    (convex as any)
      .query("users:getCurrentUser", {})
      .then((user: any) => {
        // Only redirect to onboarding if explicitly false (new user who hasn't completed)
        // undefined/null = old user without this field → skip onboarding
        setHasCompletedOnboarding(user?.hasCompletedOnboarding === false ? false : true);
        setChecked(true);
      })
      .catch(() => {
        setHasCompletedOnboarding(true);
        setChecked(true);
      });
  }, [isLoaded, isSignedIn, convex]);

  if (!isLoaded || !checked) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator />
      </View>
    );
  }

  if (!isSignedIn) {
    return <Redirect href="/(auth)" />;
  }

  if (hasCompletedOnboarding === false) {
    return <Redirect href="/(onboarding)" />;
  }

  return <Redirect href="/(app)" />;
}
