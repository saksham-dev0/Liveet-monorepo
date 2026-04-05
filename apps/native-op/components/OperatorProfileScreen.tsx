import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@clerk/clerk-expo";
import { useRouter, type Href } from "expo-router";
import { useConvex } from "convex/react";
import { useCallback, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { colors, radii, card as cardStyle } from "../constants/theme";
import { BottomSheet } from "./BottomSheet";

type UserData = {
  _id: string;
  name?: string;
  email?: string;
  brandName?: string;
  imageUrl?: string;
  _creationTime: number;
};

type AccountData = {
  _id: string;
  accountType: string;
  accountHolderName?: string;
  accountNumber?: string;
  ifscCode?: string;
  upiId?: string;
  isSkipped?: boolean;
};

type ActiveSheet =
  | "personal"
  | "edit"
  | "payment"
  | "security"
  | "notifications_info"
  | "help"
  | null;

type Props = {
  /** When true, shows a back control for stack navigation from other screens. */
  showBackButton?: boolean;
};

function maskAccountNumber(num?: string): string {
  if (!num || num.length < 4) return num ?? "—";
  return "•••• " + num.slice(-4);
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function OperatorProfileScreen({ showBackButton = false }: Props) {
  const { signOut } = useAuth();
  const router = useRouter();
  const convex = useConvex();
  const insets = useSafeAreaInsets();

  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [user, setUser] = useState<UserData | null>(null);
  const [accounts, setAccounts] = useState<AccountData[]>([]);
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null);

  // Edit profile fields
  const [editName, setEditName] = useState("");
  const [editBrand, setEditBrand] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [status, userData, accountsData] = await Promise.all([
        (convex as any).query("onboarding:getOnboardingStatus", {}),
        (convex as any).query("users:getCurrentUser", {}),
        (convex as any).query("users:getOperatorAccounts", {}),
      ]);
      if (status?.property?._id) setPropertyId(status.property._id);
      if (userData) setUser(userData);
      if (Array.isArray(accountsData)) setAccounts(accountsData);
    } catch {}
  }, [convex]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const openEditSheet = () => {
    setEditName(user?.name ?? "");
    setEditBrand(user?.brandName ?? "");
    setActiveSheet("edit");
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "This will permanently delete your account and all associated data including properties, rooms, payment methods, notifications, and messages. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Account",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Are you absolutely sure?",
              `Type your account action will be permanent. All data for "${displayName}" will be erased.`,
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Yes, Delete Everything",
                  style: "destructive",
                  onPress: async () => {
                    setDeleting(true);
                    try {
                      await (convex as any).mutation(
                        "users:deleteOperatorAccount",
                        {},
                      );
                      await signOut();
                      router.replace("/(auth)" as Href);
                    } catch {
                      Alert.alert(
                        "Error",
                        "Could not delete account. Please try again.",
                      );
                    } finally {
                      setDeleting(false);
                    }
                  },
                },
              ],
            );
          },
        },
      ],
    );
  };

  const saveProfile = async () => {
    if (!editName.trim()) {
      Alert.alert("Validation", "Name cannot be empty.");
      return;
    }
    setSaving(true);
    try {
      await (convex as any).mutation("users:updateUserProfile", {
        name: editName.trim(),
        brandName: editBrand.trim() || undefined,
      });
      setUser((prev) =>
        prev
          ? { ...prev, name: editName.trim(), brandName: editBrand.trim() || undefined }
          : prev,
      );
      setActiveSheet(null);
    } catch {
      Alert.alert("Error", "Could not save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleMenuPress = (key: string) => {
    switch (key) {
      case "personal":
        setActiveSheet("personal");
        break;
      case "room-config":
        if (propertyId) {
          router.push({
            pathname: "/(onboarding)/property/room-config",
            params: { propertyId, fromProfile: "true" },
          } as any);
        }
        break;
      case "list-property":
        if (propertyId) router.push("/(app)/list-property");
        break;
      case "payment":
        setActiveSheet("payment");
        break;
      case "security":
        setActiveSheet("security");
        break;
      case "notifications":
        router.push("/(app)/notifications" as Href);
        break;
      case "help":
        setActiveSheet("help");
        break;
    }
  };

  const displayName = user?.name ?? "—";
  const displayEmail = user?.email ?? "—";
  const avatarInitial = displayName.charAt(0).toUpperCase() || "?";

  const activeAccounts = accounts.filter((a) => !a.isSkipped);

  return (
    <View style={s.container}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={[s.header, { paddingTop: Math.max(insets.top, 8) }]}>
          {showBackButton ? (
            <Pressable
              onPress={() => router.back()}
              style={s.backBtn}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={24} color={colors.black} />
            </Pressable>
          ) : null}
          <Text
            style={[
              s.title,
              showBackButton ? s.titleWithBack : s.titleStandalone,
            ]}
          >
            Profile
          </Text>
          <TouchableOpacity
            style={s.iconBtn}
            activeOpacity={0.7}
            onPress={() => router.push("/(app)/notifications" as Href)}
            accessibilityLabel="Notifications"
          >
            <Ionicons name="notifications-outline" size={22} color={colors.black} />
          </TouchableOpacity>
        </View>

        {/* ── Profile card ── */}
        <View style={[s.card, s.profileCard]}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{avatarInitial}</Text>
          </View>
          <Text style={s.userName}>{displayName}</Text>
          {user?.brandName ? (
            <Text style={s.brandName}>{user.brandName}</Text>
          ) : null}
          <Text style={s.userEmail}>{displayEmail}</Text>
          <TouchableOpacity style={s.editBtn} activeOpacity={0.7} onPress={openEditSheet}>
            <Text style={s.editBtnText}>Edit profile</Text>
          </TouchableOpacity>
        </View>

        {/* ── Menu card ── */}
        <View style={[s.card, s.menuCard]}>
          {MENU_ITEMS.filter(
            (item) => item.key !== "list-property" || propertyId != null,
          ).map((item, i, arr) => (
            <TouchableOpacity
              key={item.key}
              style={[s.menuRow, i === arr.length - 1 && s.menuRowLast]}
              activeOpacity={0.7}
              onPress={() => handleMenuPress(item.key)}
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
              router.replace("/(auth)" as Href);
            } catch (err) {
              console.error("Error signing out", err);
            }
          }}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <Text style={s.logoutText}>Log out</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.deleteAccountBtn}
          activeOpacity={0.7}
          onPress={handleDeleteAccount}
          disabled={deleting}
        >
          {deleting ? (
            <ActivityIndicator size="small" color={colors.muted} />
          ) : (
            <>
              <Ionicons name="trash-outline" size={16} color={colors.muted} />
              <Text style={s.deleteAccountText}>Delete account</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={s.bottomSpacer} />
      </ScrollView>

      {/* ── Personal Info Sheet ── */}
      <BottomSheet
        visible={activeSheet === "personal"}
        onClose={() => setActiveSheet(null)}
        title="Personal Info"
        showCloseButton
        maxHeight="60%"
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <InfoRow icon="person-outline" label="Full name" value={displayName} />
          <InfoRow icon="mail-outline" label="Email" value={displayEmail} />
          {user?.brandName ? (
            <InfoRow icon="business-outline" label="Brand name" value={user.brandName} />
          ) : null}
          <InfoRow icon="shield-checkmark-outline" label="Role" value="Operator" />
          {user?._creationTime ? (
            <InfoRow
              icon="calendar-outline"
              label="Member since"
              value={formatDate(user._creationTime)}
            />
          ) : null}
        </ScrollView>
      </BottomSheet>

      {/* ── Edit Profile Sheet ── */}
      <BottomSheet
        visible={activeSheet === "edit"}
        onClose={() => setActiveSheet(null)}
        title="Edit Profile"
        showCloseButton
        keyboardAvoiding
        maxHeight="55%"
      >
        <View>
          <Text style={s.fieldLabel}>Full name</Text>
          <TextInput
            style={s.textInput}
            value={editName}
            onChangeText={setEditName}
            placeholder="Your full name"
            placeholderTextColor={colors.muted}
            autoCapitalize="words"
          />
          <Text style={s.fieldLabel}>Brand / business name</Text>
          <TextInput
            style={s.textInput}
            value={editBrand}
            onChangeText={setEditBrand}
            placeholder="Optional"
            placeholderTextColor={colors.muted}
            autoCapitalize="words"
          />
          <TouchableOpacity
            style={[s.saveBtn, saving && s.saveBtnDisabled]}
            activeOpacity={0.8}
            onPress={saveProfile}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={s.saveBtnText}>Save changes</Text>
            )}
          </TouchableOpacity>
        </View>
      </BottomSheet>

      {/* ── Payment Methods Sheet ── */}
      <BottomSheet
        visible={activeSheet === "payment"}
        onClose={() => setActiveSheet(null)}
        title="Payment Methods"
        showCloseButton
        maxHeight="65%"
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          {activeAccounts.length === 0 ? (
            <View style={s.emptySheet}>
              <Ionicons name="card-outline" size={40} color={colors.muted} />
              <Text style={s.emptySheetTitle}>No payment methods</Text>
              <Text style={s.emptySheetSub}>
                Payment methods are configured during onboarding.
              </Text>
            </View>
          ) : (
            activeAccounts.map((acc) => (
              <View key={acc._id} style={s.accountCard}>
                <View style={s.accountIconWrap}>
                  <Ionicons
                    name={acc.accountType === "upi" ? "qr-code-outline" : "card-outline"}
                    size={20}
                    color={colors.navy}
                  />
                </View>
                <View style={s.accountInfo}>
                  <Text style={s.accountType}>
                    {acc.accountType === "upi" ? "UPI" : "Bank Account"}
                  </Text>
                  {acc.accountHolderName ? (
                    <Text style={s.accountDetail}>{acc.accountHolderName}</Text>
                  ) : null}
                  {acc.accountNumber ? (
                    <Text style={s.accountDetail}>
                      {maskAccountNumber(acc.accountNumber)}
                      {acc.ifscCode ? `  ·  ${acc.ifscCode}` : ""}
                    </Text>
                  ) : null}
                  {acc.upiId ? (
                    <Text style={s.accountDetail}>{acc.upiId}</Text>
                  ) : null}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </BottomSheet>

      {/* ── Security Sheet ── */}
      <BottomSheet
        visible={activeSheet === "security"}
        onClose={() => setActiveSheet(null)}
        title="Security"
        showCloseButton
        maxHeight="55%"
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <InfoRow icon="mail-outline" label="Verified email" value={displayEmail} />
          <InfoRow icon="shield-checkmark-outline" label="Account type" value="Operator" />
          {user?._creationTime ? (
            <InfoRow
              icon="calendar-outline"
              label="Account created"
              value={formatDate(user._creationTime)}
            />
          ) : null}
          <View style={s.securityNote}>
            <Ionicons name="lock-closed-outline" size={16} color={colors.muted} />
            <Text style={s.securityNoteText}>
              Your account is secured via email OTP authentication. To change your
              email or password, contact support.
            </Text>
          </View>
        </ScrollView>
      </BottomSheet>

      {/* ── Help & Support Sheet ── */}
      <BottomSheet
        visible={activeSheet === "help"}
        onClose={() => setActiveSheet(null)}
        title="Help & Support"
        showCloseButton
        maxHeight="60%"
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <InfoRow icon="mail-outline" label="Email support" value="support@liveet.in" />
          <InfoRow icon="call-outline" label="Phone support" value="+91 98765 43210" />
          <InfoRow icon="time-outline" label="Support hours" value="Mon – Fri, 10 AM – 6 PM IST" />
          <View style={s.helpDivider} />
          <InfoRow icon="document-text-outline" label="Privacy Policy" value="View" onPress={() => router.push("/(app)/privacy-policy" as Href)} />
          <InfoRow icon="clipboard-outline" label="Terms of Service" value="liveet.in/terms" />
          <InfoRow icon="information-circle-outline" label="App version" value="1.0.0" />
        </ScrollView>
      </BottomSheet>
    </View>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function InfoRow({
  icon,
  label,
  value,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
  onPress?: () => void;
}) {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      style={s.infoRow}
      {...(onPress
        ? {
            onPress,
            activeOpacity: 0.6,
            accessibilityRole: "button" as const,
            accessibilityLabel: `${label}: ${value}`,
            accessibilityHint: `Opens ${label}`,
          }
        : {
            accessible: true,
            accessibilityLabel: `${label}: ${value}`,
          })}
    >
      <View style={s.infoIconWrap}>
        <Ionicons name={icon} size={18} color={colors.muted} />
      </View>
      <View style={s.infoContent}>
        <Text style={s.infoLabel}>{label}</Text>
        <Text style={s.infoValue}>{value}</Text>
      </View>
      {onPress && (
        <Ionicons name="chevron-forward" size={16} color={colors.muted} />
      )}
    </Wrapper>
  );
}

const MENU_ITEMS = [
  { icon: "person-outline" as const, label: "Personal info", key: "personal" },
  { icon: "bed-outline" as const, label: "Room configuration", key: "room-config" },
  { icon: "home-outline" as const, label: "Property listing", key: "list-property" },
  { icon: "card-outline" as const, label: "Payment methods", key: "payment" },
  { icon: "shield-checkmark-outline" as const, label: "Security", key: "security" },
  { icon: "notifications-outline" as const, label: "Notifications", key: "notifications" },
  { icon: "help-circle-outline" as const, label: "Help & support", key: "help" },
];

// ── Styles ───────────────────────────────────────────────────────────────────

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
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.black,
  },
  titleStandalone: {
    flex: 1,
    textAlign: "left",
  },
  titleWithBack: {
    flex: 1,
    marginLeft: 8,
    textAlign: "left",
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
    marginBottom: 2,
  },
  brandName: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.muted,
    marginBottom: 2,
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
  deleteAccountBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    marginTop: 2,
    marginBottom: 4,
  },
  deleteAccountText: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.muted,
  },
  bottomSpacer: {
    height: 100,
  },

  // Info row (used in sheets)
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  infoIconWrap: {
    width: 32,
    alignItems: "center",
    marginTop: 2,
    marginRight: 10,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 3,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: "500",
    color: colors.navy,
  },

  // Edit form
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.navy,
    marginBottom: 6,
    marginTop: 14,
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.input,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    backgroundColor: colors.inputBg,
    color: colors.navy,
  },
  saveBtn: {
    marginTop: 20,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveBtnDisabled: {
    backgroundColor: colors.muted,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.white,
  },

  // Payment account card
  accountCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 12,
  },
  accountIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.inputBg,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  accountInfo: {
    flex: 1,
  },
  accountType: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.navy,
    marginBottom: 3,
  },
  accountDetail: {
    fontSize: 13,
    color: colors.muted,
    marginBottom: 1,
  },

  // Empty sheet state
  emptySheet: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 8,
  },
  emptySheetTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.navy,
    marginTop: 4,
  },
  emptySheetSub: {
    fontSize: 13,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 18,
  },

  // Security note
  securityNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 16,
    padding: 14,
    backgroundColor: colors.inputBg,
    borderRadius: 12,
  },
  securityNoteText: {
    flex: 1,
    fontSize: 13,
    color: colors.muted,
    lineHeight: 18,
  },

  // Help divider
  helpDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 8,
  },
});
