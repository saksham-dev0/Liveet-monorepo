import React, { useEffect } from "react";
import { Tabs, useRouter } from "expo-router";
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
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { colors } from "../../constants/theme";

const BAR_SIDE_MARGIN = 24;
const BAR_H_PADDING = 6;
const PLUS_GAP = 76; // reserved space for the "+" in the center of the bar
const EASE = Easing.bezier(0.4, 0, 0.2, 1);

const NAV_TABS = [
  {
    label: "Dashboard",
    icon: "home" as const,
    iconOutline: "home-outline" as const,
  },
  {
    label: "Transactions",
    icon: "swap-horizontal" as const,
    iconOutline: "swap-horizontal-outline" as const,
  },
  {
    label: "Chats",
    icon: "chatbubble-ellipses" as const,
    iconOutline: "chatbubble-ellipses-outline" as const,
  },
  {
    label: "Manage",
    icon: "options" as const,
    iconOutline: "options-outline" as const,
  },
];

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const activeTab = state.index;

  const pillInnerWidth = screenWidth - BAR_SIDE_MARGIN * 2;
  const tabWidth = (pillInnerWidth - BAR_H_PADDING * 2 - PLUS_GAP) / NAV_TABS.length;
  const highlightX = useSharedValue(0);

  useEffect(() => {
    const x = activeTab * tabWidth + (activeTab >= 2 ? PLUS_GAP : 0);
    highlightX.value = withTiming(x, {
      duration: 300,
      easing: EASE,
    });
  }, [activeTab, tabWidth]);

  const highlightStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: highlightX.value }],
  }));

  return (
    <View style={[styles.navBarOuter, { bottom: insets.bottom + 4 }]}>
      <View style={styles.navBarPill}>
        <View style={styles.navTabs}>
          {/* Sliding highlight */}
          <Animated.View
            style={[
              styles.slidingHighlight,
              { width: tabWidth },
              highlightStyle,
            ]}
          />

          {state.routes.slice(0, 2).map((route, localIndex) => {
            const globalIndex = localIndex;
            const isActive = globalIndex === activeTab;
            const tab = NAV_TABS[globalIndex];
            return (
              <Pressable
                key={route.key}
                style={[styles.navTab, { width: tabWidth }]}
                onPress={() => navigation.navigate(route.name)}
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
                        color: isActive ? "#fff" : "rgba(255,255,255,0.45)",
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

          {state.routes.slice(2).map((route, localIndex) => {
            const globalIndex = localIndex + 2;
            const isActive = globalIndex === activeTab;
            const tab = NAV_TABS[globalIndex];
            return (
              <Pressable
                key={route.key}
                style={[styles.navTab, { width: tabWidth }]}
                onPress={() => navigation.navigate(route.name)}
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
                        color: isActive ? "#fff" : "rgba(255,255,255,0.45)",
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

      {/* Center "+" button */}
      <Pressable
        style={styles.plusBtn}
        onPress={() => router.push("/(onboarding)/property/basic")}
        accessibilityRole="button"
        accessibilityLabel="Add"
      >
        <Ionicons name="add" size={30} color={colors.primary} />
      </Pressable>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.pageBg }}>
      <StatusBar barStyle="dark-content" />
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props: BottomTabBarProps) => <CustomTabBar {...props} />}
      >
        <Tabs.Screen name="index" options={{ title: "Dashboard" }} />
        <Tabs.Screen name="transfer" options={{ title: "Transactions" }} />
        <Tabs.Screen name="analytics" options={{ title: "Chats" }} />
        <Tabs.Screen name="profile" options={{ title: "Manage" }} />
      </Tabs>
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
    backgroundColor: "#1E293B",
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
    transform: [
      { translateX: -30 }, // 60 / 2
      { translateY: -30 }, // 60 / 2
    ],
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
