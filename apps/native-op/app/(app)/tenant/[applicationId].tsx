import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
  Linking,
  Platform,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useConvex } from "convex/react";
import {
  colors,
  radii,
  card as cardStyle,
  cardShadow,
} from "../../../constants/theme";

type ManagePayload = {
  notFound: false;
  propertyName: string;
  legalNameAsOnId: string;
  tenantImageUrl?: string;
  phone: string;
  email: string;
  moveInDate?: string;
  paymentStatus?: "paid" | "pending";
  paymentMethod?: string;
  assignedRoomId?: string;
  assignedRoomNumber?: string;
  metaLine: string;
  agreementDuration?: string;
  agreementLockIn?: string;
  checklist: {
    percentRemaining: number;
    completedCount: number;
    totalSteps: number;
    segmentFilled: boolean[];
    currentTaskLabel: string;
    steps: Array<{ key: string; label: string; done: boolean }>;
  };
};

function digitsForWhatsApp(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.length === 10) return `91${d}`;
  return d;
}

export default function TenantManageScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const convex = useConvex();
  const { applicationId } = useLocalSearchParams<{
    applicationId: string;
  }>();

  const [data, setData] = useState<ManagePayload | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checklistExpanded, setChecklistExpanded] = useState(false);

  const load = useCallback(async () => {
    if (!applicationId || typeof applicationId !== "string") {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setNotFound(false);
    try {
      const res = await (convex as any).query(
        "properties:getTenantManageDetails",
        { applicationId },
      );
      if (res?.notFound) {
        setNotFound(true);
        setData(null);
      } else {
        setData(res as ManagePayload);
      }
    } catch {
      setNotFound(true);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [convex, applicationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openWhatsApp = () => {
    if (!data?.phone) return;
    const n = digitsForWhatsApp(data.phone);
    if (!n) return;
    const url = `https://wa.me/${n}`;
    void Linking.openURL(url);
  };

  const openCall = () => {
    if (!data?.phone) return;
    const cleaned = data.phone.replace(/[^\d+]/g, "");
    void Linking.openURL(`tel:${cleaned || data.phone}`);
  };

  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.mutedSmall}>Loading tenant…</Text>
      </View>
    );
  }

  if (notFound || !data) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top, paddingHorizontal: 24 }]}>
        <Text style={styles.errorTitle}>Tenant not found</Text>
        <Text style={styles.errorBody}>
          This tenant may have been removed or you don’t have access.
        </Text>
        <Pressable
          style={styles.primaryBtn}
          onPress={() => router.back()}
        >
          <Text style={styles.primaryBtnText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const { checklist } = data;

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 120 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <Pressable
            style={styles.roundBtn}
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={22} color={colors.black} />
          </Pressable>
          <Pressable style={styles.roundBtn} hitSlop={12} accessibilityLabel="Settings">
            <Ionicons name="settings-outline" size={20} color={colors.black} />
          </Pressable>
        </View>

        <View style={styles.heroRow}>
          <View style={styles.heroText}>
            <Text style={styles.propertyName}>{data.propertyName}</Text>
            <Text style={styles.tenantName}>{data.legalNameAsOnId}</Text>
            <Text style={styles.metaLine}>{data.metaLine}</Text>
            {data.assignedRoomNumber?.trim() ? (
              <View style={styles.assignedRow}>
                <Ionicons name="bed-outline" size={16} color={colors.muted} />
                <Text style={styles.assignedText}>
                  Assigned room: {data.assignedRoomNumber}
                </Text>
              </View>
            ) : null}
          </View>
          {data.tenantImageUrl ? (
            <Image source={{ uri: data.tenantImageUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={32} color={colors.muted} />
            </View>
          )}
        </View>

        <View style={[styles.card, styles.checklistCard]}>
          <View style={styles.checklistHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Tenant move-in checklist</Text>
              <Text style={styles.checklistSub}>
                {checklist.percentRemaining}% remaining
              </Text>
            </View>
            <View style={styles.checklistActions}>
              <Pressable style={styles.iconCircle} hitSlop={8}>
                <Ionicons name="share-outline" size={18} color={colors.navy} />
              </Pressable>
              <Pressable style={styles.iconCircle} hitSlop={8}>
                <Ionicons name="time-outline" size={18} color={colors.navy} />
              </Pressable>
            </View>
          </View>

          <View style={styles.segmentRow}>
            {checklist.segmentFilled.map((filled, i) => (
              <View
                key={i}
                style={[
                  styles.segment,
                  filled ? styles.segmentOn : styles.segmentOff,
                ]}
              />
            ))}
          </View>

          <View style={styles.currentTaskRow}>
            <Ionicons name="person-add-outline" size={20} color={colors.primary} />
            <Text style={styles.currentTaskText} numberOfLines={2}>
              {checklist.currentTaskLabel}
            </Text>
          </View>

          <Pressable
            style={styles.viewAllRow}
            onPress={() => setChecklistExpanded((v) => !v)}
          >
            <Text style={styles.viewAllText}>
              {checklistExpanded ? "Hide details" : "View all"}
            </Text>
            <Ionicons
              name={checklistExpanded ? "chevron-up" : "chevron-down"}
              size={18}
              color={colors.muted}
            />
          </Pressable>

          {checklistExpanded ? (
            <View style={styles.stepList}>
              {checklist.steps.map((step) => (
                <View key={step.key} style={styles.stepRow}>
                  <Ionicons
                    name={step.done ? "checkmark-circle" : "ellipse-outline"}
                    size={20}
                    color={step.done ? colors.positiveAmount : colors.muted}
                  />
                  <Text
                    style={[
                      styles.stepLabel,
                      step.done && styles.stepLabelDone,
                    ]}
                  >
                    {step.label}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        <ActionRow
          icon="checkmark-circle"
          iconBg={colors.inputBg}
          title="Move-in date"
          subtitle={formatMoveInDisplay(data.moveInDate)}
          right={
            <View style={styles.badgeDone}>
              <Text style={styles.badgeDoneText}>Completed</Text>
            </View>
          }
        />

        <ActionRow
          icon="business-outline"
          iconBg={colors.inputBg}
          title="Shift tenant"
          subtitle="Change room or property."
          right={
            <Pressable style={styles.outlineBtnSm}>
              <Text style={styles.outlineBtnSmText}>Change</Text>
            </Pressable>
          }
        />

        <ActionRow
          icon="document-text-outline"
          iconBg={colors.inputBg}
          title="Agreement"
          subtitle={
            data.agreementDuration
              ? `Duration: ${data.agreementDuration}`
              : data.agreementLockIn
                ? `Lock-in: ${data.agreementLockIn}`
                : "Agreement on file"
          }
          right={
            <Pressable style={styles.outlineBtnSm}>
              <Text style={styles.outlineBtnSmText}>Extend stay</Text>
            </Pressable>
          }
        />

        <View style={[styles.card, styles.offboardCard]}>
          <View style={styles.offboardHeader}>
            <View style={[styles.iconCircle, { backgroundColor: colors.inputBg }]}>
              <Ionicons name="arrow-up-outline" size={18} color={colors.error} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.offboardTitle}>Tenant moving out?</Text>
              <Text style={styles.offboardBody}>
                Set a move-out date to vacate the unit. You can still view tenant
                records afterward.
              </Text>
            </View>
          </View>
          <Pressable style={styles.removeBtn}>
            <Text style={styles.removeBtnText}>Remove tenant</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>Quick links</Text>
        <Pressable
          style={styles.quickLink}
          onPress={() =>
            router.push("/(app)/(tabs)/transfer" as Href)
          }
        >
          <Text style={styles.quickLinkText}>Collections & payments</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>

        <Text style={[styles.sectionLabel, styles.viewDetailsHeading]}>
          View details
        </Text>
        <View style={styles.viewDetailsCard}>
          <View
            style={[
              styles.viewDetailsBanner,
              checklist.percentRemaining > 0
                ? styles.viewDetailsBannerPending
                : styles.viewDetailsBannerDone,
            ]}
          >
            <Ionicons
              name={
                checklist.percentRemaining > 0
                  ? "key-outline"
                  : "checkmark-circle-outline"
              }
              size={18}
              color={
                checklist.percentRemaining > 0 ? "#B45309" : "#166534"
              }
            />
            <Text
              style={
                checklist.percentRemaining > 0
                  ? styles.viewDetailsBannerTextPending
                  : styles.viewDetailsBannerTextDone
              }
            >
              {checklist.percentRemaining > 0
                ? "Onboarding checklist pending"
                : "All onboarding steps complete"}
            </Text>
          </View>

          <View style={styles.viewDetailsActions}>
            <Pressable
              style={styles.viewDetailsAction}
              onPress={() =>
                Alert.alert(
                  "Terms",
                  [
                    data.agreementDuration &&
                      `Agreement duration: ${data.agreementDuration}`,
                    data.agreementLockIn && `Lock-in: ${data.agreementLockIn}`,
                    "Rental terms are recorded with this tenancy.",
                  ]
                    .filter(Boolean)
                    .join("\n") || "No agreement terms on file for this property.",
                )
              }
            >
              <View style={styles.viewDetailsIconCircle}>
                <Ionicons name="business-outline" size={22} color={colors.navy} />
              </View>
              <Text style={styles.viewDetailsActionLabel}>Terms</Text>
            </Pressable>

            <Pressable
              style={styles.viewDetailsAction}
              onPress={() =>
                Alert.alert(
                  "Documents",
                  "ID proofs and move-in documents submitted by the tenant are stored with this application. Full document viewer is coming soon.",
                )
              }
            >
              <View style={styles.viewDetailsIconCircle}>
                <Ionicons
                  name="document-attach-outline"
                  size={22}
                  color={colors.navy}
                />
              </View>
              <Text style={styles.viewDetailsActionLabel}>Documents</Text>
            </Pressable>

            <Pressable
              style={styles.viewDetailsAction}
              onPress={() =>
                Alert.alert(
                  "Tenant profile",
                  [
                    `Name: ${data.legalNameAsOnId}`,
                    `Phone: ${data.phone}`,
                    `Email: ${data.email}`,
                  ].join("\n"),
                )
              }
            >
              <View style={styles.viewDetailsIconCircle}>
                <Ionicons name="person-outline" size={22} color={colors.navy} />
              </View>
              <Text style={styles.viewDetailsActionLabel}>Profile</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: Math.max(insets.bottom, 12),
            paddingTop: 12,
          },
        ]}
      >
        <Pressable
          style={[styles.footerBtn, styles.footerWhatsApp]}
          onPress={openWhatsApp}
        >
          <Ionicons name="logo-whatsapp" size={22} color={colors.white} />
          <Text style={styles.footerBtnText}>WhatsApp</Text>
        </Pressable>
        <Pressable
          style={[styles.footerBtn, styles.footerCall]}
          onPress={openCall}
        >
          <Ionicons name="call-outline" size={22} color={colors.white} />
          <Text style={styles.footerBtnText}>Call</Text>
        </Pressable>
      </View>
    </View>
  );
}

function formatMoveInDisplay(raw?: string): string {
  if (!raw?.trim()) return "Not set";
  const t = raw.trim();
  const parsed = Date.parse(t);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }
  return t;
}

function ActionRow({
  icon,
  iconBg,
  title,
  subtitle,
  right,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  title: string;
  subtitle: string;
  right: React.ReactNode;
}) {
  return (
    <View style={styles.actionRow}>
      <View style={[styles.actionIconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={20} color={colors.navy} />
      </View>
      <View style={styles.actionBody}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionSubtitle}>{subtitle}</Text>
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.pageBg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.pageBg,
  },
  mutedSmall: {
    marginTop: 10,
    fontSize: 14,
    color: colors.muted,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.black,
    marginBottom: 8,
    textAlign: "center",
  },
  errorBody: {
    fontSize: 15,
    color: colors.muted,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 22,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: radii.pill,
  },
  primaryBtnText: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 15,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  roundBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  heroText: {
    flex: 1,
    marginRight: 12,
  },
  propertyName: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.muted,
    marginBottom: 4,
  },
  tenantName: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.black,
    letterSpacing: -0.5,
  },
  metaLine: {
    marginTop: 6,
    fontSize: 14,
    color: colors.muted,
  },
  assignedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  assignedText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.navy,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.inputBg,
  },
  avatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.inputBg,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    ...cardStyle,
    ...cardShadow,
    marginBottom: 12,
  },
  checklistCard: {
    padding: 18,
  },
  checklistHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.black,
  },
  checklistSub: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 4,
  },
  checklistActions: {
    flexDirection: "row",
    gap: 8,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 14,
  },
  segment: {
    flex: 1,
    height: 6,
    borderRadius: 3,
  },
  segmentOn: {
    backgroundColor: colors.primary,
  },
  segmentOff: {
    backgroundColor: colors.progressTrack,
  },
  currentTaskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  currentTaskText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: colors.navy,
  },
  viewAllRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 6,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.muted,
  },
  stepList: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: 10,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  stepLabel: {
    flex: 1,
    fontSize: 14,
    color: colors.navy,
  },
  stepLabelDone: {
    color: colors.muted,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: radii.card,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    ...cardShadow,
  },
  actionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  actionBody: {
    flex: 1,
    minWidth: 0,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.black,
  },
  actionSubtitle: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
  },
  badgeDone: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  badgeDoneText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#166534",
  },
  outlineBtnSm: {
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.white,
  },
  outlineBtnSmText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.navy,
  },
  offboardCard: {
    padding: 16,
  },
  offboardHeader: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
  },
  offboardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.black,
    marginBottom: 6,
  },
  offboardBody: {
    fontSize: 14,
    color: colors.muted,
    lineHeight: 20,
  },
  removeBtn: {
    borderWidth: 1.5,
    borderColor: colors.error,
    borderRadius: radii.pill,
    paddingVertical: 14,
    alignItems: "center",
  },
  removeBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.error,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.navy,
    marginTop: 8,
    marginBottom: 10,
  },
  quickLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.white,
    padding: 16,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  quickLinkText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.black,
  },
  viewDetailsHeading: {
    marginTop: 20,
  },
  viewDetailsCard: {
    backgroundColor: colors.white,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 8,
    ...cardShadow,
  },
  viewDetailsBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radii.input,
    marginBottom: 18,
  },
  viewDetailsBannerPending: {
    backgroundColor: "#FEF3C7",
  },
  viewDetailsBannerDone: {
    backgroundColor: "#DCFCE7",
  },
  viewDetailsBannerTextPending: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#92400E",
    lineHeight: 20,
  },
  viewDetailsBannerTextDone: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#166534",
    lineHeight: 20,
  },
  viewDetailsActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 4,
  },
  viewDetailsAction: {
    flex: 1,
    alignItems: "center",
    minWidth: 0,
  },
  viewDetailsIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.inputBg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  viewDetailsActionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.navy,
    textAlign: "center",
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    backgroundColor: colors.pageBg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 8 },
    }),
  },
  footerBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: radii.pill,
  },
  footerWhatsApp: {
    backgroundColor: colors.positiveAmount,
  },
  footerCall: {
    backgroundColor: colors.primary,
  },
  footerBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.white,
  },
});
