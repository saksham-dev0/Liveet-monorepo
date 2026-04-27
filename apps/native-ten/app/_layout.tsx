import "./global.css";
import React, { useCallback, useMemo } from "react";
import { Stack, useRouter, type Href } from "expo-router";
import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";
import * as SecureStore from "expo-secure-store";
import { GestureHandlerRootView } from "react-native-gesture-handler";

const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;
const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

if (!convexUrl) {
  console.warn(
    "EXPO_PUBLIC_CONVEX_URL is not set. Convex client will not be able to connect.",
  );
}

if (!clerkPublishableKey) {
  console.warn(
    "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is not set. Clerk will not be able to initialize.",
  );
}

const CONVEX_LOG_FILTERS = [
  "reconnect",
  "WebSocket reconnected",
  "Stream end",
  "Attempting reconnect",
  "fetching token",
  "setting auth state",
  "message not sent",
  "sent message with type",
  "received ws message",
  "received 0MB transition",
  "resuming WS",
  "pausing WS",
  "server confirmed",
  "refetching auth token",
  "restarting WS",
  "Restart called without stopping",
  "config version",
];

const shouldFilterLog = (msg: string) =>
  CONVEX_LOG_FILTERS.some((filter) => msg.includes(filter));

const convexLogger = {
  log: (...args: unknown[]) => {
    const msg = String(args[0] ?? "");
    if (shouldFilterLog(msg)) return;
    console.log(...args);
  },
  warn: (...args: unknown[]) => {
    const msg = String(args[0] ?? "");
    if (shouldFilterLog(msg)) return;
    console.warn(...args);
  },
  error: (...args: unknown[]) => console.error(...args),
  logVerbose: () => {},
};

const convex = new ConvexReactClient(convexUrl ?? "", { logger: convexLogger });

const tokenCache = {
  async getToken(key: string) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      // ignore
    }
  },
};

function useConvexClerkAuth() {
  const { isLoaded, isSignedIn, getToken } = useAuth();

  const fetchAccessToken = useCallback(
    async (options?: { forceRefreshToken?: boolean }) => {
      const token = await getToken({
        template: "convex",
        skipCache: options?.forceRefreshToken ?? false,
      });
      return token ?? null;
    },
    [getToken],
  );

  return useMemo(
    () => ({
      isLoading: !isLoaded,
      isAuthenticated: !!isSignedIn,
      fetchAccessToken,
    }),
    [isLoaded, isSignedIn, fetchAccessToken],
  );
}

function RootLayoutContent() {
  const router = useRouter();

  return (
    <ClerkProvider
      publishableKey={clerkPublishableKey}
      tokenCache={tokenCache}
      afterSignOutUrl="/"
      routerPush={(to) => {
        if (to && !String(to).startsWith("nativeten:")) router.push(to as Href);
      }}
      routerReplace={(to) => {
        if (to && !String(to).startsWith("nativeten:")) router.replace(to as Href);
      }}
    >
      <ConvexProviderWithAuth client={convex} useAuth={useConvexClerkAuth}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(onboarding)" />
          <Stack.Screen name="(app)" />
        </Stack>
      </ConvexProviderWithAuth>
    </ClerkProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <RootLayoutContent />
    </GestureHandlerRootView>
  );
}
