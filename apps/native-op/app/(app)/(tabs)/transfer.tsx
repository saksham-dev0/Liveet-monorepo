import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { useConvex } from "convex/react";
import { useFocusEffect } from "@react-navigation/native";
import { colors, radii, cardShadow } from "../../../constants/theme";

type PaymentItem = {
  id: string;
  applicationId: string;
  type: "move_in" | "extend";
  tenantName: string;
  tenantImageUrl?: string;
  roomNumber?: string;
  propertyName?: string;
  amount: number;
  rentAmount: number;
  months: number;
  securityDeposit: number;
  paymentMethod?: string;
  paidAt: number;
  status: "paid" | "pending";
  description: string;
  periodStart: number;
  periodEnd: number;
};

function formatPeriod(start: number, end: number): string {
  const s = new Date(start);
  const e = new Date(end - 1); // subtract 1ms to not bleed into next month
  const opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short" };
  const yearOpts: Intl.DateTimeFormatOptions = { ...opts, year: "2-digit" };
  const startStr = s.toLocaleDateString("en-IN", opts);
  const endStr = e.toLocaleDateString("en-IN", yearOpts);
  return `${startStr} – ${endStr}`;
}

function formatInr(amount: number): string {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function PaymentsScreen() {
  const router = useRouter();
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const convex = useConvex();

  const [payments, setPayments] = useState<PaymentItem[] | null>(null);
  const [totalReceived, setTotalReceived] = useState(0);
  const [tab, setTab] = useState<"paid" | "pending">("paid");
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);

  const refreshPayments = useCallback(async () => {
    try {
      const data = await (convex as any).query(
        "properties:getAllPaymentsForOperator",
        {},
      );
      const items: PaymentItem[] = data?.items ?? [];
      setPayments(items);
      setTotalReceived(
        items
          .filter((p) => p.status === "paid")
          .reduce((sum, p) => sum + p.amount, 0),
      );
    } catch {
      setPayments([]);
    }
  }, [convex]);

  const sendReminder = useCallback(
    async (item: PaymentItem) => {
      if (sendingReminder) return;
      setSendingReminder(item.id);
      try {
        await (convex as any).mutation(
          "notifications:sendRentReminder",
          { applicationId: item.applicationId },
        );
        Alert.alert("Reminder sent", `A rent reminder has been sent to ${item.tenantName}.`);
      } catch {
        Alert.alert("Failed", "Could not send reminder. Please try again.");
      } finally {
        setSendingReminder(null);
      }
    },
    [convex, sendingReminder],
  );

  useFocusEffect(
    useCallback(() => {
      if (!authLoaded || !isSignedIn) return;
      void refreshPayments();
    }, [authLoaded, isSignedIn, refreshPayments]),
  );

  const displayed = (payments ?? []).filter((p) => p.status === tab);

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Payments</Text>
      </View>

      {/* Summary row */}
      <View style={s.summaryRow}>
        <View style={[s.summaryCard, { backgroundColor: "#ECFDF5" }]}>
          <Text style={s.summaryLabel}>Received</Text>
          <Text style={[s.summaryAmount, { color: colors.positiveAmount }]}>
            {formatInr(totalReceived)}
          </Text>
        </View>
        <View style={[s.summaryCard, { backgroundColor: "#FFFBEB" }]}>
          <Text style={s.summaryLabel}>Pending</Text>
          <Text style={[s.summaryAmount, { color: "#B45309" }]}>
            {formatInr(
              (payments ?? [])
                .filter((p) => p.status === "pending")
                .reduce((s, p) => s + p.amount, 0),
            )}
          </Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={s.tabRow}>
        <Pressable
          style={[s.tab, tab === "paid" && s.tabActive]}
          onPress={() => setTab("paid")}
        >
          <Text style={[s.tabText, tab === "paid" && s.tabTextActive]}>Paid</Text>
          {tab === "paid" && <View style={s.tabUnderline} />}
        </Pressable>
        <Pressable
          style={[s.tab, tab === "pending" && s.tabActive]}
          onPress={() => setTab("pending")}
        >
          <Text style={[s.tabText, tab === "pending" && s.tabTextActive]}>Dues</Text>
          {tab === "pending" && <View style={s.tabUnderline} />}
        </Pressable>
      </View>

      {/* List */}
      {payments === null ? (
        <View style={s.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : displayed.length === 0 ? (
        <View style={s.centered}>
          <Ionicons name="receipt-outline" size={44} color={colors.border} />
          <Text style={s.emptyText}>
            {tab === "paid" ? "No payments recorded yet." : "No pending dues."}
          </Text>
        </View>
      ) : (
        <ScrollView
          style={s.list}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
        >
          {displayed.map((item) => (
            <Pressable
              key={item.id}
              style={s.paymentRow}
              onPress={() =>
                router.push(
                  `/(app)/payment/${encodeURIComponent(item.id)}` as any,
                )
              }
              android_ripple={{ color: colors.border }}
            >
              {/* Avatar */}
              {item.tenantImageUrl ? (
                <Image
                  source={{ uri: item.tenantImageUrl }}
                  style={s.avatar}
                />
              ) : (
                <View style={s.avatarPlaceholder}>
                  <Ionicons name="person" size={22} color={colors.muted} />
                </View>
              )}

              {/* Info */}
              <View style={s.rowInfo}>
                <Text style={s.rowName} numberOfLines={1}>
                  {item.tenantName}
                </Text>
                <Text style={s.rowMeta} numberOfLines={1}>
                  {[item.roomNumber, item.propertyName]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
                <Text style={s.rowAmount}>{formatInr(item.amount)}</Text>
                <Text style={s.rowPeriod}>
                  {formatPeriod(item.periodStart, item.periodEnd)}
                </Text>
              </View>

              {/* Remind button (pending only) */}
              {item.status === "pending" && (
                <Pressable
                  style={s.remindBtn}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    void sendReminder(item);
                  }}
                  hitSlop={8}
                  disabled={sendingReminder === item.id}
                >
                  {sendingReminder === item.id ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Ionicons name="notifications-outline" size={18} color={colors.primary} />
                  )}
                </Pressable>
              )}

              {/* Status badge */}
              <View
                style={[
                  s.badge,
                  item.status === "paid" ? s.badgePaid : s.badgePending,
                ]}
              >
                <Text
                  style={[
                    s.badgeText,
                    item.status === "paid"
                      ? s.badgeTextPaid
                      : s.badgeTextPending,
                  ]}
                >
                  {item.status === "paid" ? "Paid" : "Due"}
                </Text>
              </View>
            </Pressable>
          ))}
          <View style={{ height: 120 }} />
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.pageBg,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: colors.pageBg,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.navy,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  summaryCard: {
    flex: 1,
    borderRadius: radii.card,
    padding: 16,
    ...cardShadow,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.muted,
    marginBottom: 4,
  },
  summaryAmount: {
    fontSize: 20,
    fontWeight: "700",
  },
  tabRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 4,
  },
  tab: {
    marginRight: 28,
    paddingBottom: 10,
    paddingTop: 6,
    position: "relative",
  },
  tabActive: {},
  tabText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.muted,
  },
  tabTextActive: {
    color: colors.navy,
  },
  tabUnderline: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.navy,
    borderRadius: 2,
  },
  list: { flex: 1 },
  listContent: { paddingTop: 4 },
  paymentRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.cardBg,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.inputBg,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.inputBg,
    alignItems: "center",
    justifyContent: "center",
  },
  rowInfo: {
    flex: 1,
  },
  rowName: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.navy,
    marginBottom: 2,
  },
  rowMeta: {
    fontSize: 12,
    color: colors.muted,
    marginBottom: 6,
  },
  rowAmount: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.navy,
    marginBottom: 2,
  },
  rowPeriod: {
    fontSize: 12,
    color: colors.muted,
  },
  remindBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    alignSelf: "flex-start",
  },
  badgePaid: {
    backgroundColor: "#DCFCE7",
  },
  badgePending: {
    backgroundColor: "#FEF3C7",
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  badgeTextPaid: {
    color: "#15803D",
  },
  badgeTextPending: {
    color: "#B45309",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: colors.muted,
    textAlign: "center",
  },
});
