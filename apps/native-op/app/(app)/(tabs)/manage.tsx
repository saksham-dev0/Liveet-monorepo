import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { Image } from "expo-image";
import { useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useConvex } from "convex/react";
import { colors, cardShadow, radii } from "../../../constants/theme";

const H_PAD = 20;
const TAB_BAR_CLEARANCE = 100;

type OnboardedTenantRow = {
  applicationId: string;
  propertyId: string;
  propertyName: string;
  legalNameAsOnId: string;
  imageUrl?: string;
  phone: string;
  moveInDate?: string;
  paymentStatus?: "paid" | "pending";
  isRentDue?: boolean;
  rentDueAmount?: number;
  isImported?: boolean;
  isLinked?: boolean;
};

export default function ManageTabScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const convex = useConvex();
  const [items, setItems] = useState<OnboardedTenantRow[] | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await (convex as any).query(
        "properties:listOnboardedTenantsForManage",
        { limit: 200 },
      );
      const list = data?.items;
      setItems(Array.isArray(list) ? list : []);
    } catch {
      setItems([]);
    }
  }, [convex]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const rentDueCount = (items ?? []).filter((i) => i.isRentDue).length;
  const paidCount = (items ?? []).filter((i) => !i.isRentDue && i.paymentStatus === "paid").length;
  const pendingCount = (items ?? []).filter((i) => i.paymentStatus === "pending").length + rentDueCount;
  const importedCount = (items ?? []).filter((i) => i.isImported && !i.paymentStatus).length;

  return (
    <View style={[s.root, { paddingTop: insets.top + 8 }]}>

      {/* ── Header ── */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Manage</Text>
          <Text style={s.headerSub}>Onboarded tenants</Text>
        </View>
        <TouchableOpacity
          style={s.headerBtn}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Refresh"
          onPress={() => { setItems(null); void refresh(); }}
        >
          <Ionicons name="refresh-outline" size={20} color={colors.navy} />
        </TouchableOpacity>
      </View>

      {items === null ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={s.loadingText}>Loading tenants…</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={s.center}>
          <View style={s.emptyIcon}>
            <Ionicons name="people-outline" size={40} color={colors.muted} />
          </View>
          <Text style={s.emptyTitle}>No onboarded tenants yet</Text>
          <Text style={s.emptySub}>
            When tenants submit their move-in application your properties, they will appear here.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={s.scroll}
          contentContainerStyle={{ paddingBottom: insets.bottom + TAB_BAR_CLEARANCE }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Stats row ── */}
          <View style={s.statsRow}>
            <View style={[s.statCard, { backgroundColor: colors.navy }]}>
              <Text style={s.statValueLight}>{items.length}</Text>
              <Text style={s.statLabelLight}>Total</Text>
            </View>
            <View style={[s.statCard, { backgroundColor: "#DCFCE7", borderColor: "#BBF7D0" }]}>
              <Text style={[s.statValue, { color: "#166534" }]}>{paidCount}</Text>
              <Text style={[s.statLabel, { color: "#16A34A" }]}>Paid</Text>
            </View>
            {importedCount > 0 ? (
              <View style={[s.statCard, { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" }]}>
                <Text style={[s.statValue, { color: "#1D4ED8" }]}>{importedCount}</Text>
                <Text style={[s.statLabel, { color: "#3B82F6" }]}>Imported</Text>
              </View>
            ) : rentDueCount > 0 ? (
              <View style={[s.statCard, { backgroundColor: "#FEE2E2", borderColor: "#FECACA" }]}>
                <Text style={[s.statValue, { color: "#991B1B" }]}>{rentDueCount}</Text>
                <Text style={[s.statLabel, { color: "#DC2626" }]}>Rent Due</Text>
              </View>
            ) : (
              <View style={[s.statCard, { backgroundColor: "#FEF3C7", borderColor: "#FDE68A" }]}>
                <Text style={[s.statValue, { color: "#92400E" }]}>{pendingCount}</Text>
                <Text style={[s.statLabel, { color: "#D97706" }]}>Pending</Text>
              </View>
            )}
          </View>

          {/* ── Section label ── */}
          <Text style={s.sectionLabel}>All tenants · {items.length}</Text>

          {/* ── Tenant cards ── */}
          <View style={s.list}>
            {items.map((row) => (
              <TouchableOpacity
                key={row.applicationId}
                style={s.card}
                activeOpacity={0.75}
                onPress={() =>
                  router.push({
                    pathname: "/(app)/tenant/[applicationId]",
                    params: { applicationId: row.applicationId },
                  } as Href)
                }
                accessibilityRole="button"
                accessibilityLabel={`View ${row.legalNameAsOnId}`}
              >
                {/* Avatar */}
                <View style={s.avatarWrap}>
                  {row.imageUrl ? (
                    <Image
                      source={{ uri: row.imageUrl }}
                      style={s.avatar}
                      contentFit="cover"
                      transition={150}
                    />
                  ) : (
                    <View style={s.avatarFallback}>
                      <Text style={s.avatarInitial}>
                        {row.legalNameAsOnId.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Info */}
                <View style={s.cardBody}>
                  <Text style={s.tenantName} numberOfLines={1}>
                    {row.legalNameAsOnId}
                  </Text>
                  <View style={s.metaRow}>
                    <Ionicons name="business-outline" size={12} color={colors.muted} />
                    <Text style={s.metaText} numberOfLines={1}>{row.propertyName}</Text>
                  </View>
                  <View style={s.metaRow}>
                    <Ionicons name="call-outline" size={12} color={colors.muted} />
                    <Text style={s.metaText} numberOfLines={1}>{row.phone}</Text>
                  </View>
                  {row.moveInDate?.trim() ? (
                    <View style={s.metaRow}>
                      <Ionicons name="calendar-outline" size={12} color={colors.muted} />
                      <Text style={s.metaText} numberOfLines={1}>Move-in: {row.moveInDate}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Right side */}
                <View style={s.cardRight}>
                  {row.isImported ? (
                    row.isLinked ? (
                      <View style={[s.pill, { backgroundColor: "#F0FDF4" }]}>
                        <View style={[s.pillDot, { backgroundColor: "#16A34A" }]} />
                        <Text style={[s.pillText, { color: "#166534" }]}>Linked</Text>
                      </View>
                    ) : row.paymentStatus ? (
                      <PaymentPill status={row.paymentStatus} isRentDue={false} rentDueAmount={0} />
                    ) : (
                      <View style={[s.pill, { backgroundColor: "#EFF6FF" }]}>
                        <View style={[s.pillDot, { backgroundColor: "#3B82F6" }]} />
                        <Text style={[s.pillText, { color: "#1D4ED8" }]}>Imported</Text>
                      </View>
                    )
                  ) : (
                    <PaymentPill status={row.paymentStatus} isRentDue={row.isRentDue} rentDueAmount={row.rentDueAmount} />
                  )}
                  <Ionicons name="chevron-forward" size={16} color={colors.muted} style={{ marginTop: 8 }} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function formatDueAmount(amount: number): string {
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}k`;
  return `₹${amount}`;
}

function PaymentPill({ status, isRentDue, rentDueAmount }: { status?: "paid" | "pending"; isRentDue?: boolean; rentDueAmount?: number }) {
  if (isRentDue) {
    return (
      <View style={[s.pill, { backgroundColor: "#FEE2E2" }]}>
        <View style={[s.pillDot, { backgroundColor: "#DC2626" }]} />
        <Text style={[s.pillText, { color: "#991B1B" }]}>
          Due{rentDueAmount ? ` ${formatDueAmount(rentDueAmount)}` : ""}
        </Text>
      </View>
    );
  }
  if (status === "paid") {
    return (
      <View style={[s.pill, { backgroundColor: "#DCFCE7" }]}>
        <View style={[s.pillDot, { backgroundColor: "#16A34A" }]} />
        <Text style={[s.pillText, { color: "#166534" }]}>Paid</Text>
      </View>
    );
  }
  if (status === "pending") {
    return (
      <View style={[s.pill, { backgroundColor: "#FEF3C7" }]}>
        <View style={[s.pillDot, { backgroundColor: "#D97706" }]} />
        <Text style={[s.pillText, { color: "#92400E" }]}>Pending</Text>
      </View>
    );
  }
  return (
    <View style={[s.pill, { backgroundColor: colors.surfaceGray }]}>
      <Text style={[s.pillText, { color: colors.muted }]}>—</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.pageBg,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: H_PAD,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.navy,
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.muted,
    marginTop: 2,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },

  // States
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingBottom: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.muted,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surfaceGray,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.navy,
    marginBottom: 8,
    textAlign: "center",
  },
  emptySub: {
    fontSize: 14,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 20,
  },

  // Scroll
  scroll: { flex: 1 },

  // Stats
  statsRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: H_PAD,
    marginBottom: 22,
  },
  statCard: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    ...cardShadow,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.navy,
  },
  statValueLight: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.white,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.muted,
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  statLabelLight: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255,255,255,0.7)",
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },

  // Section
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginHorizontal: H_PAD,
    marginBottom: 10,
  },

  // List
  list: {
    paddingHorizontal: H_PAD,
    gap: 10,
  },

  // Card
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 12,
    ...cardShadow,
  },

  // Avatar
  avatarWrap: {
    flexShrink: 0,
    width: 52,
    height: 52,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radii.card,
  },
  avatarFallback: {
    width: 52,
    height: 52,
    borderRadius: radii.card,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontSize: 19,
    fontWeight: "700",
    color: colors.white,
  },

  // Card body
  cardBody: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  tenantName: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.navy,
    marginBottom: 2,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  metaText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "500",
    color: colors.muted,
  },

  // Card right
  cardRight: {
    flexShrink: 0,
    alignItems: "flex-end",
  },

  // Pill
  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    gap: 5,
  },
  pillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pillText: {
    fontSize: 12,
    fontWeight: "700",
  },
});
