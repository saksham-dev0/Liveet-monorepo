import "./global.css";
import { Stack } from "expo-router";
import { ConvexProvider, ConvexReactClient } from "convex/react";

const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  console.warn(
    "EXPO_PUBLIC_CONVEX_URL is not set. Convex client will not be able to connect."
  );
}

const convex = new ConvexReactClient(convexUrl ?? "");

export default function RootLayout() {
  return (
    <ConvexProvider client={convex}>
      <Stack />
    </ConvexProvider>
  );
}
