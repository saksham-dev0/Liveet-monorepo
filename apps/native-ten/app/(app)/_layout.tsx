import React, { useEffect } from "react";
import { Stack, usePathname, useRouter } from "expo-router";
import {
  View,
  StyleSheet,
  Pressable,
  Text,
  useWindowDimensions,
  StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { colors } from "../../constants/theme";

const BAR_SIDE_MARGIN = 24;
const BAR_H_PADDING = 6;
const PLUS_GAP = 76; // reserved space for the "+" in the center of the bar
const EASE = Easing.bezier(0.4, 0, 0.2, 1);

const NAV_TABS = [
  { routeName: "index", label: "Discover", icon: "compass", iconOutline: "compass-outline" },
  {
    routeName: "community",
    label: "Community",
    icon: "people",
    iconOutline: "people-outline",
  },
  {
    routeName: "chats",
    label: "Messages",
    icon: "chatbubble-ellipses",
    iconOutline: "chatbubble-ellipses-outline",
  },
  { routeName: "profile", label: "Profile", icon: "person", iconOutline: "person-outline" },
] as const;

function getActiveRouteName(pathname: string | null | undefined) {
  const normalized = (pathname ?? "").replace(/\/+$/, "");
  if (!normalized) return "index";
  if (normalized === "/(app)") return "index";
  const parts = normalized.split("/").filter(Boolean);
  if (parts.includes("chats")) return "chats";
  if (parts.includes("community")) return "community";
  if (parts.includes("profile")) return "profile";
  const last = parts[parts.length - 1];
  return last && last !== "(app)" ? last : "index";
}

function BottomTabBar({ activeRouteName }: { activeRouteName: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const activeVisibleTabIndex = NAV_TABS.findIndex(
    (t) => t.routeName === activeRouteName,
  );
  const safeActiveTabIndex = activeVisibleTabIndex === -1 ? 0 : activeVisibleTabIndex;

  const pillInnerWidth = screenWidth - BAR_SIDE_MARGIN * 2;
  const tabWidth =
    (pillInnerWidth - BAR_H_PADDING * 2 - PLUS_GAP) / NAV_TABS.length;

  const highlightX = useSharedValue(0);

  useEffect(() => {
    const x =
      safeActiveTabIndex * tabWidth + (safeActiveTabIndex >= 2 ? PLUS_GAP : 0);
    highlightX.value = withTiming(x, { duration: 300, easing: EASE });
  }, [safeActiveTabIndex, tabWidth]);

  const highlightStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: highlightX.value }],
  }));

  return (
    <View style={[styles.navBarOuter, { bottom: insets.bottom + 4 }]}>
      <View style={styles.navBarPill}>
        <View style={styles.navTabs}>
          <Animated.View
            style={[
              styles.slidingHighlight,
              { width: tabWidth },
              highlightStyle,
            ]}
          />

          {NAV_TABS.slice(0, 2).map((tab) => {
            const isActive = tab.routeName === activeRouteName;
            return (
              <Pressable
                key={tab.routeName}
                style={[styles.navTab, { width: tabWidth }]}
                onPress={() => {
                  const href = tab.routeName === "index" ? "/(app)" : `/(app)/${tab.routeName}`;
                  // Use `navigate` so the previous tab screen isn't removed from the stack,
                  // which would cause Discover to remount and refetch its properties.
                  router.navigate(href as any);
                }}
              >
                <View style={styles.navTabContent}>
                  <Ionicons
                    name={isActive ? tab.icon : tab.iconOutline}
                    size={22}
                    color={isActive ? "#fff" : "rgba(255,255,255,0.45)"}
                  />
                  <Text
                    style={[
                      styles.navLabel,
                      {
                        color: isActive
                          ? "#fff"
                          : "rgba(255,255,255,0.45)",
                      },
                    ]}
                  >
                    {tab.label}
                  </Text>
                </View>
              </Pressable>
            );
          })}

          {/* center gap for the "+" */}
          <View style={{ width: PLUS_GAP }} />

          {NAV_TABS.slice(2).map((tab) => {
            const isActive = tab.routeName === activeRouteName;
            return (
              <Pressable
                key={tab.routeName}
                style={[styles.navTab, { width: tabWidth }]}
                onPress={() => {
                  const href = tab.routeName === "index" ? "/(app)" : `/(app)/${tab.routeName}`;
                  // Keep other tab screens mounted for a better UX.
                  router.navigate(href as any);
                }}
              >
                <View style={styles.navTabContent}>
                  <Ionicons
                    name={isActive ? tab.icon : tab.iconOutline}
                    size={22}
                    color={isActive ? "#fff" : "rgba(255,255,255,0.45)"}
                  />
                  <Text
                    style={[
                      styles.navLabel,
                      {
                        color: isActive
                          ? "#fff"
                          : "rgba(255,255,255,0.45)",
                      },
                    ]}
                  >
                    {tab.label}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Center "+" button (visual only for now) */}
      <Pressable
        style={styles.plusBtn}
        onPress={() => router.navigate("/(app)")}
        accessibilityRole="button"
        accessibilityLabel="Add"
      >
        <Ionicons name="add" size={30} color={colors.primary} />
      </Pressable>
    </View>
  );
}

export default function AppLayout() {
  const pathname = usePathname();
  const activeRouteName = getActiveRouteName(pathname);
  // Hide tab bar on pushed stacks (favorites, chat thread).
  const path = pathname ?? "";
  const showTabBar = !path.includes("/favorites") && !path.includes("/chats/") && !path.includes("/kyc/") && !path.endsWith("/complaint");

  return (
    <View style={{ flex: 1, backgroundColor: colors.pageBg }}>
      <StatusBar barStyle="dark-content" />

      <Stack
        screenOptions={{
          headerShown: false,
          unmountOnBlur: false,
          animation: "none",
        } as any}
      >
        <Stack.Screen name="index" options={{ animation: "none", gestureEnabled: false } as any} />
        <Stack.Screen name="community" options={{ animation: "none", gestureEnabled: false } as any} />
        <Stack.Screen name="chats" options={{ animation: "none", gestureEnabled: false } as any} />
        <Stack.Screen name="chats/[propertyId]" options={{ animation: "default" } as any} />
        <Stack.Screen name="profile" options={{ animation: "none", gestureEnabled: false } as any} />
        {/* Liked must be true stack for swipe-back */}
        <Stack.Screen name="favorites" options={{ title: "Liked" }} />
        <Stack.Screen name="favorites/[id]" options={{ animation: "none" }} />
        <Stack.Screen name="favorites/move-in/[propertyId]" options={{ title: "Move-in" }} />
        <Stack.Screen name="kyc/[propertyId]" options={{ animation: "slide_from_right" } as any} />
        <Stack.Screen name="complaint" options={{ animation: "slide_from_right" } as any} />
      </Stack>

      {showTabBar ? <BottomTabBar activeRouteName={activeRouteName} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  navBarOuter: {
    position: "absolute",
    left: BAR_SIDE_MARGIN,
    right: BAR_SIDE_MARGIN,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  navBarPill: {
    borderRadius: 30,
    overflow: "hidden",
    backgroundColor: colors.primary,
    elevation: 6,
  },
  navTabs: {
    flexDirection: "row",
    paddingVertical: BAR_H_PADDING,
    paddingHorizontal: BAR_H_PADDING,
  },
  slidingHighlight: {
    position: "absolute",
    top: BAR_H_PADDING,
    left: BAR_H_PADDING,
    bottom: BAR_H_PADDING,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  navTab: {
    flex: 0,
  },
  plusBtn: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    elevation: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    transform: [{ translateX: -30 }, { translateY: -30 }],
  },
  navTabContent: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    gap: 3,
  },
  navLabel: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
});
