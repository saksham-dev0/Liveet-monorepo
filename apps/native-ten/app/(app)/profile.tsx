import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { useConvex } from "convex/react";
import { colors, radii, cardShadow } from "../../constants/theme";
import { discoverEvents } from "../../constants/discoverEvents";

type RowItem = {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
  value?: string;
  destructive?: boolean;
};

function SettingsRow({ icon, label, onPress, value, destructive }: RowItem) {
  return (
    <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={0.7}>
      <View style={[s.rowIconWrap, destructive && s.rowIconWrapDestructive]}>
        <Ionicons name={icon} size={18} color={destructive ? colors.error : colors.primary} />
      </View>
      <Text style={[s.rowLabel, destructive && s.rowLabelDestructive]}>{label}</Text>
      {value ? (
        <Text style={s.rowValue}>{value}</Text>
      ) : (
        <Ionicons name="chevron-forward" size={16} color={colors.muted} />
      )}
    </TouchableOpacity>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={s.sectionTitle}>{title}</Text>;
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signOut } = useAuth();
  const { user: clerkUser } = useUser();
  const convex = useConvex();
  const [activeView, setActiveView] = useState<"discover" | "dashboard">(discoverEvents.current());
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>("");

  useEffect(() => {
    const unsub = discoverEvents.on(setActiveView);
    return () => { unsub(); };
  }, []);

  useEffect(() => {
    (convex as any).query("users:getCurrentUser", {}).then((user: any) => {
      if (user?.name) setDisplayName(user.name);
      if (user?.profileImageStorageId) {
        (convex as any)
          .query("users:getProfileImageUrl", { storageId: user.profileImageStorageId })
          .then((url: string | null) => setProfileImageUrl(url))
          .catch(() => {});
      }
    }).catch(() => {});
  }, [convex]);

  const name = displayName || clerkUser?.fullName || clerkUser?.primaryEmailAddress?.emailAddress || "User";
  const email = clerkUser?.primaryEmailAddress?.emailAddress ?? "";
  const avatarSource = profileImageUrl ?? clerkUser?.imageUrl ?? null;

  const handleLogout = () => {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/(auth)");
        },
      },
    ]);
  };

  const handleSwitchView = (target: "discover" | "dashboard") => {
    setActiveView(target);
    discoverEvents.emit(target);
    router.navigate("/(app)" as any);
  };

  const handleStub = (feature: string) => {
    Alert.alert(feature, "This feature is coming soon.");
  };

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <Text style={s.pageTitle}>Profile</Text>

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar card */}
        <View style={s.avatarCard}>
          <TouchableOpacity
            style={s.avatarWrap}
            onPress={() => router.navigate("/(app)/personal" as any)}
            activeOpacity={0.8}
          >
            {avatarSource ? (
              <Image source={{ uri: avatarSource }} style={s.avatar} />
            ) : (
              <View style={[s.avatar, s.avatarPlaceholder]}>
                <Ionicons name="person" size={28} color={colors.white} />
              </View>
            )}
          </TouchableOpacity>
          <View style={s.avatarInfo}>
            <Text style={s.avatarName} numberOfLines={1}>{name}</Text>
            <Text style={s.avatarEmail} numberOfLines={1}>{email}</Text>
          </View>
          <TouchableOpacity
            style={s.editBtn}
            onPress={() => router.navigate("/(app)/personal" as any)}
            activeOpacity={0.7}
          >
            <Ionicons name="pencil-outline" size={16} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* View toggle */}
        <View style={s.toggleCard}>
          <TouchableOpacity
            style={[s.toggleBtn, activeView === "discover" && s.toggleBtnActive]}
            onPress={() => handleSwitchView("discover")}
          >
            <Ionicons
              name="compass-outline"
              size={15}
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
              size={15}
              color={activeView === "dashboard" ? colors.white : colors.navy}
            />
            <Text style={[s.toggleText, activeView === "dashboard" && s.toggleTextActive]}>
              My Home
            </Text>
          </TouchableOpacity>
        </View>

        {/* Settings section */}
        <SectionHeader title="Settings" />
        <View style={s.card}>
          <SettingsRow
            icon="person-outline"
            label="Personal"
            onPress={() => router.navigate("/(app)/personal" as any)}
          />
          <View style={s.divider} />
          <SettingsRow
            icon="notifications-outline"
            label="Notifications"
            onPress={() => handleStub("Notifications")}
          />
          <View style={s.divider} />
          <SettingsRow
            icon="lock-closed-outline"
            label="Security"
            onPress={() => handleStub("Security")}
          />
          <View style={s.divider} />
          <SettingsRow
            icon="help-circle-outline"
            label="Help & Support"
            onPress={() => handleStub("Help & Support")}
          />
        </View>

        {/* Legal section */}
        <SectionHeader title="Legal" />
        <View style={s.card}>
          <SettingsRow
            icon="document-text-outline"
            label="Privacy Policy"
            onPress={() => router.navigate("/(app)/privacy-policy" as any)}
          />
          <View style={s.divider} />
          <SettingsRow
            icon="reader-outline"
            label="Terms & Conditions"
            onPress={() => handleStub("Terms & Conditions")}
          />
        </View>

        {/* Account actions */}
        <View style={[s.card, { marginTop: 8 }]}>
          <SettingsRow
            icon="log-out-outline"
            label="Sign Out"
            onPress={handleLogout}
            destructive
          />
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg },
  pageTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.navy,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  scroll: {
    paddingHorizontal: 20,
  },
  avatarCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.cardBg,
    borderRadius: radii.card,
    padding: 16,
    marginBottom: 12,
    gap: 14,
    ...cardShadow,
    shadowOpacity: 0.07,
    elevation: 3,
  },
  avatarWrap: {
    borderRadius: 28,
    overflow: "hidden",
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarPlaceholder: {
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInfo: {
    flex: 1,
  },
  avatarName: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.navy,
    marginBottom: 2,
  },
  avatarEmail: {
    fontSize: 13,
    color: colors.muted,
  },
  editBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: `${colors.primary}12`,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleCard: {
    flexDirection: "row",
    backgroundColor: colors.cardBg,
    borderRadius: radii.card,
    padding: 4,
    marginBottom: 20,
    ...cardShadow,
    shadowOpacity: 0.07,
    elevation: 3,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: radii.card - 4,
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
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.card,
    marginBottom: 12,
    overflow: "hidden",
    ...cardShadow,
    shadowOpacity: 0.07,
    elevation: 3,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  rowIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: `${colors.primary}12`,
    alignItems: "center",
    justifyContent: "center",
  },
  rowIconWrapDestructive: {
    backgroundColor: `${colors.error}12`,
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: colors.navy,
  },
  rowLabelDestructive: {
    color: colors.error,
  },
  rowValue: {
    fontSize: 14,
    color: colors.muted,
    fontWeight: "500",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginHorizontal: 16,
  },
});
