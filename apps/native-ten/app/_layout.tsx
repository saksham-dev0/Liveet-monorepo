import "./global.css";
import React, { useCallback, useMemo } from "react";
import { Stack } from "expo-router";
import { ClerkProvider, SignedIn, SignedOut, useAuth } from "@clerk/clerk-expo";
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

export default function RootLayout() {
  // #region agent log
  fetch("http://127.0.0.1:7705/ingest/31413d30-c336-48c7-b2f1-ff91680701eb", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "d028b5",
    },
    body: JSON.stringify({
      sessionId: "d028b5",
      location: "apps/native-op/app/_layout.tsx:RootLayout",
      message: "render RootLayout",
      data: {},
      runId: "routing-op-1",
      hypothesisId: "H-structure",
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion agent log

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ClerkProvider publishableKey={clerkPublishableKey} tokenCache={tokenCache}>
        <ConvexProviderWithAuth client={convex} useAuth={useConvexClerkAuth}>
          <SignedIn>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(app)" />
            </Stack>
          </SignedIn>
          <SignedOut>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(auth)" />
            </Stack>
          </SignedOut>
        </ConvexProviderWithAuth>
      </ClerkProvider>
    </GestureHandlerRootView>
  );
}
