import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, cardShadow } from "../../constants/theme";
import { discoverEvents } from "../../constants/discoverEvents";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signOut } = useAuth();
  const { user } = useUser();
  const [activeView, setActiveView] = useState<"discover" | "dashboard">(discoverEvents.current);

  // Stay in sync when index.tsx changes the view (e.g. gate sets dashboard on mount)
  useEffect(() => {
    return discoverEvents.on(setActiveView);
  }, []);

  const handleLogout = async () => {
    await signOut();
    router.replace("/(auth)");
  };

  const handleSwitchView = (target: "discover" | "dashboard") => {
    setActiveView(target);
    discoverEvents.emit(target);
    router.navigate("/(app)" as any);
  };

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <Text style={s.title}>Profile</Text>

      <View style={s.content}>
        <View style={s.avatar}>
          <Ionicons name="person" size={40} color={colors.white} />
        </View>
        <Text style={s.name}>
          {user?.fullName || user?.primaryEmailAddress?.emailAddress || "User"}
        </Text>
        <Text style={s.email}>
          {user?.primaryEmailAddress?.emailAddress ?? ""}
        </Text>

        <View style={s.toggle}>
          <TouchableOpacity
            style={[s.toggleBtn, activeView === "discover" && s.toggleBtnActive]}
            onPress={() => handleSwitchView("discover")}
          >
            <Ionicons
              name="compass-outline"
              size={16}
              color={activeView === "discover" ? colors.white : colors.navy}
            />
            <Text style={[s.toggleText, activeView === "discover" && s.toggleTextActive]}>
              Discover
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.toggleBtn, activeView === "dashboard" && s.toggleBtnActive]}
            onPress={() => handleSwitchView("dashboard")}
          >
            <Ionicons
              name="home-outline"
              size={16}
              color={activeView === "dashboard" ? colors.white : colors.navy}
            />
            <Text style={[s.toggleText, activeView === "dashboard" && s.toggleTextActive]}>
              My Home
            </Text>
          </TouchableOpacity>
        </View>

        <View style={s.card}>
          <TouchableOpacity style={s.row}>
            <Ionicons name="settings-outline" size={20} color={colors.navy} />
            <Text style={s.rowText}>Settings</Text>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.muted}
            />
          </TouchableOpacity>
          <View style={s.divider} />
          <TouchableOpacity style={s.row}>
            <Ionicons
              name="help-circle-outline"
              size={20}
              color={colors.navy}
            />
            <Text style={s.rowText}>Help & Support</Text>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.muted}
            />
          </TouchableOpacity>
          <View style={s.divider} />
          <TouchableOpacity style={s.row} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color={colors.error} />
            <Text style={[s.rowText, { color: colors.error }]}>Log out</Text>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.muted}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.navy,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  content: { alignItems: "center", paddingTop: 24 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  name: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.navy,
    marginBottom: 4,
  },
  email: { fontSize: 14, color: colors.muted, marginBottom: 20 },
  toggle: {
    flexDirection: "row",
    backgroundColor: colors.cardBg,
    borderRadius: 24,
    padding: 4,
    marginBottom: 20,
    ...cardShadow,
  },
  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 20,
  },
  toggleBtnActive: {
    backgroundColor: colors.primary,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.navy,
  },
  toggleTextActive: {
    color: colors.white,
  },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.card,
    marginHorizontal: 20,
    width: "90%",
    ...cardShadow,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 14,
  },
  rowText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: colors.navy,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 20,
  },
});
