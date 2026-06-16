import React, { useEffect } from "react";
import { Tabs } from "expo-router";
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
import { usePathname } from "expo-router";
import { colors } from "../../constants/theme";

const BAR_SIDE_MARGIN = 24;
const BAR_H_PADDING = 6;
const EASE = Easing.bezier(0.4, 0, 0.2, 1);

type TabConfig = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconOutline: keyof typeof Ionicons.glyphMap;
};

const NAV_TABS: Record<string, TabConfig> = {
  index: {
    label: "Home",
    icon: "home",
    iconOutline: "home-outline",
  },
  favorites: {
    label: "Saved",
    icon: "bookmark",
    iconOutline: "bookmark-outline",
  },
  chats: {
    label: "Chats",
    icon: "chatbubble-ellipses",
    iconOutline: "chatbubble-ellipses-outline",
  },
  community: {
    label: "Social",
    icon: "people",
    iconOutline: "people-outline",
  },
  profile: {
    label: "Profile",
    icon: "person",
    iconOutline: "person-outline",
  },
};

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const pathname = usePathname();
  const activeTab = state.index;

  const TAB_ROOTS = ["/favorites"];
  const HIDDEN_PATHS = ["/kyc/"];
  const isNestedScreen =
    TAB_ROOTS.some((root) => pathname.startsWith(root + "/")) ||
    HIDDEN_PATHS.some((p) => pathname.startsWith(p));
  if (isNestedScreen) return null;

  const pillInnerWidth = screenWidth - BAR_SIDE_MARGIN * 2 - BAR_H_PADDING * 2;
  const tabWidth = pillInnerWidth / state.routes.length;

  return (
    <View style={[styles.navBarOuter, { bottom: insets.bottom + 4 }]}>
      <View style={styles.navBarPill}>
        <View style={styles.navTabs}>
          {state.routes.map((route, index) => {
            const isActive = index === activeTab;
            const tab = NAV_TABS[route.name];
            if (!tab) return null;
            return (
              <Pressable
                key={route.key}
                style={[styles.navTab, { width: tabWidth }]}
                onPress={() => navigation.navigate(route.name)}
              >
                <View style={styles.navTabContent}>
                  <View style={[styles.iconPill, isActive && styles.iconPillActive]}>
                    <Ionicons
                      name={isActive ? tab.icon : tab.iconOutline}
                      size={22}
                      color={isActive ? "#1A1A1A" : "rgba(255,255,255,0.6)"}
                    />
                  </View>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.navLabel,
                      { color: isActive ? "#D4F542" : "rgba(255,255,255,0.6)" },
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
    </View>
  );
}

export default function AppLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.pageBg }}>
      <StatusBar barStyle="dark-content" />
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props: BottomTabBarProps) => <CustomTabBar {...props} />}
      >
        <Tabs.Screen name="index" options={{ title: "Home", gestureEnabled: false } as any} />
        <Tabs.Screen name="favorites" options={{ title: "Saved" }} />
        <Tabs.Screen name="chats" options={{ title: "Chats" }} />
        <Tabs.Screen name="community" options={{ title: "Social" }} />
        <Tabs.Screen name="profile" options={{ title: "Profile" }} />
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
    flex: 1,
    paddingVertical: BAR_H_PADDING,
    paddingHorizontal: BAR_H_PADDING,
  },
  navTab: {
    flex: 1,
  },
  navTabContent: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    gap: 4,
  },
  iconPill: {
    width: 44,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  iconPillActive: {
    backgroundColor: "#D4F542",
  },
  navLabel: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.1,
  },
});
