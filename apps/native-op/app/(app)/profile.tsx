import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { useConvex } from "convex/react";
import { useEffect, useState } from "react";
import { colors, radii, card as cardStyle, cardShadow } from "../../constants/theme";

const MENU_ITEMS = [
  { icon: "person-outline" as const, label: "Personal info", href: "#" },
  { icon: "bed-outline" as const, label: "Room configuration", href: "room-config" },
  { icon: "card-outline" as const, label: "Payment methods", href: "#" },
  { icon: "shield-checkmark-outline" as const, label: "Security", href: "#" },
  { icon: "notifications-outline" as const, label: "Notifications", href: "#" },
  { icon: "help-circle-outline" as const, label: "Help & support", href: "#" },
];

export default function ProfileScreen() {
  const { signOut } = useAuth();
  const router = useRouter();
  const convex = useConvex();
  const [propertyId, setPropertyId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const status = await (convex as any).query(
          "onboarding:getOnboardingStatus",
          {},
        );
        if (status?.property?._id) setPropertyId(status.property._id);
      } catch {}
    })();
  }, [convex]);

  const handleMenuPress = (href: string) => {
    if (href === "room-config" && propertyId) {
      router.push({
        pathname: "/(onboarding)/property/room-config",
        params: { propertyId, fromProfile: "true" },
      } as any);
    }
  };

  return (
    <View style={s.container}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.header}>
          <Text style={s.title}>Profile</Text>
          <TouchableOpacity style={s.iconBtn} activeOpacity={0.7}>
            <Ionicons name="settings-outline" size={22} color={colors.black} />
          </TouchableOpacity>
        </View>

        <View style={[s.card, s.profileCard]}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>M</Text>
          </View>
          <Text style={s.userName}>Maya Johnson</Text>
          <Text style={s.userEmail}>maya.johnson@email.com</Text>
          <TouchableOpacity style={s.editBtn} activeOpacity={0.7}>
            <Text style={s.editBtnText}>Edit profile</Text>
          </TouchableOpacity>
        </View>

        <View style={[s.card, s.menuCard]}>
          {MENU_ITEMS.map((item, i) => (
            <TouchableOpacity
              key={i}
              style={[
                s.menuRow,
                i === MENU_ITEMS.length - 1 && s.menuRowLast,
              ]}
              activeOpacity={0.7}
              onPress={() => handleMenuPress(item.href)}
            >
              <View style={s.menuIconWrap}>
                <Ionicons name={item.icon} size={20} color={colors.muted} />
              </View>
              <Text style={s.menuLabel}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={s.logoutBtn}
          activeOpacity={0.7}
          onPress={async () => {
            try {
              await signOut();
            } catch (err) {
              console.error("Error signing out", err);
            }
          }}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <Text style={s.logoutText}>Log out</Text>
        </TouchableOpacity>

        <View style={s.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.pageBg,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.black,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  card: {
    ...cardStyle,
    marginBottom: 16,
  },
  profileCard: {
    padding: 24,
    alignItems: "center",
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.spentCard,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: "700",
    color: colors.white,
  },
  userName: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.black,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: colors.muted,
    marginBottom: 16,
  },
  editBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  editBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.black,
  },
  menuCard: {
    padding: 0,
    overflow: "hidden",
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuRowLast: {
    borderBottomWidth: 0,
  },
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.inputBg,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: colors.black,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    marginTop: 8,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.error,
  },
  bottomSpacer: {
    height: 100,
  },
});
