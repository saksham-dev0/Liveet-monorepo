import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useConvex } from "convex/react";
import { useFocusEffect } from "@react-navigation/native";
import { colors, radii, cardShadow } from "../../../constants/theme";

type PaymentDetail = {
  encodedId: string;
  applicationId: string;
  tenantName: string;
  tenantImageUrl?: string;
  tenantPhone?: string;
  roomNumber?: string;
  roomCategory?: string;
  propertyName?: string;
  amount: number;
  rentAmount: number;
  months: number;
  securityDeposit: number;
  periodStart: number;
  periodEnd: number;
  paidAt: number;
  paymentMode?: string;
  description: string;
  status: "paid" | "pending";
  agreementDuration?: string;
  rentCycle?: string;
  summary: {
    totalPaid: number;
    pendingAmount: number;
  };
};

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

function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPeriod(start: number, end: number): string {
  const s = new Date(start);
  const e = new Date(end - 1);
  const opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short" };
  const yearOpts: Intl.DateTimeFormatOptions = { ...opts, year: "2-digit" };
  return `${s.toLocaleDateString("en-IN", opts)} – ${e.toLocaleDateString("en-IN", yearOpts)}`;
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={s.sectionHeader}>{title}</Text>;
}

function DetailCard({ children }: { children: React.ReactNode }) {
  return <View style={s.detailCard}>{children}</View>;
}

function Row({
  label,
  value,
  bold,
  dashed,
}: {
  label: string;
  value: string;
  bold?: boolean;
  dashed?: boolean;
}) {
  return (
    <>
      {dashed && <View style={s.dashedDivider} />}
      <View style={s.row}>
        <Text style={s.rowLabel}>{label}</Text>
        <Text style={[s.rowValue, bold && s.rowValueBold]}>{value}</Text>
      </View>
    </>
  );
}

function GridRow({
  items,
}: {
  items: { label: string; value: string }[];
}) {
  return (
    <View style={s.gridRow}>
      {items.map((item) => (
        <View key={item.label} style={s.gridCell}>
          <Text style={s.gridLabel}>{item.label}</Text>
          <Text style={s.gridValue}>{item.value}</Text>
        </View>
      ))}
    </View>
  );
}

export default function PaymentDetailScreen() {
  const router = useRouter();
  const { paymentId } = useLocalSearchParams<{ paymentId: string }>();
  const convex = useConvex();

  const [detail, setDetail] = useState<PaymentDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDetail = useCallback(async () => {
    if (!paymentId) return;
    setLoading(true);
    try {
      const data = await (convex as any).query(
        "properties:getPaymentDetailForOperator",
        { encodedId: decodeURIComponent(paymentId) },
      );
      setDetail(data ?? null);
    } catch {
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [convex, paymentId]);

  useFocusEffect(
    useCallback(() => {
      void fetchDetail();
    }, [fetchDetail]),
  );

  if (loading) {
    return (
      <View style={s.loadingContainer}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!detail) {
    return (
      <View style={s.loadingContainer}>
        <Ionicons name="alert-circle-outline" size={44} color={colors.muted} />
        <Text style={s.emptyText}>Payment not found.</Text>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backBtnText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const remaining = Math.max(0, detail.amount - detail.amount); // always 0 for paid

  return (
    <View style={s.root}>
      {/* Sticky top bar */}
      <View style={s.topBar}>
        <Pressable onPress={() => router.back()} style={s.backIcon} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={colors.navy} />
        </Pressable>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Amount + status */}
        <View style={s.amountRow}>
          <View style={s.amountLeft}>
            <Text style={s.amountText}>{formatInr(detail.amount)}</Text>
            <Text style={s.periodText}>
              {formatPeriod(detail.periodStart, detail.periodEnd)}
            </Text>
          </View>
          <View style={s.paidBadge}>
            <Text style={s.paidBadgeText}>Paid</Text>
          </View>
        </View>

        {/* Tenant row */}
        <View style={s.tenantRow}>
          <View style={s.tenantLeft}>
            {detail.tenantImageUrl ? (
              <Image
                source={{ uri: detail.tenantImageUrl }}
                style={s.tenantAvatar}
              />
            ) : (
              <View style={s.tenantAvatarPlaceholder}>
                <Ionicons name="person" size={22} color={colors.muted} />
              </View>
            )}
            <View style={s.tenantInfo}>
              <Text style={s.tenantName}>{detail.tenantName}</Text>
              <Text style={s.tenantMeta}>
                {[detail.roomNumber, detail.propertyName]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            </View>
          </View>
          {detail.tenantPhone ? (
            <View style={s.callBtn}>
              <Ionicons name="call" size={18} color={colors.positiveAmount} />
            </View>
          ) : null}
        </View>

        <View style={s.divider} />

        {/* Due calculation */}
        <SectionHeader title="Payment breakdown" />
        <DetailCard>
          <Row label="Monthly rent" value={formatInr(detail.rentAmount)} />
          {detail.months > 1 && (
            <Row label="Months covered" value={`${detail.months} months`} />
          )}
          <Row
            label="Rent total"
            value={formatInr(detail.rentAmount * detail.months)}
          />
          {detail.securityDeposit > 0 && (
            <Row
              label="Security deposit"
              value={formatInr(detail.securityDeposit)}
            />
          )}
          <Row dashed label="Total due" value={formatInr(detail.amount)} bold />
          <Row label="Paid amount" value={formatInr(detail.amount)} />
          <Row label="Remaining" value={formatInr(remaining)} />
        </DetailCard>

        {/* Due details */}
        <SectionHeader title="Payment details" />
        <DetailCard>
          <GridRow
            items={[
              { label: "Due date", value: formatDate(detail.periodStart) },
              {
                label: "Overdue date",
                value: formatDate(detail.periodStart + 5 * 24 * 60 * 60 * 1000),
              },
            ]}
          />
          <View style={s.gridDivider} />
          <GridRow
            items={[
              {
                label: "Repeats",
                value: detail.rentCycle ?? "Monthly",
              },
              { label: "Charged", value: "Fixed Amount" },
            ]}
          />
        </DetailCard>

        {/* Tenant payment summary */}
        <SectionHeader title="Tenant payment summary" />
        <DetailCard>
          <Row
            label="Total paid (all time)"
            value={formatInr(detail.summary.totalPaid)}
          />
          <Row label="Paid" value={formatInr(detail.summary.totalPaid)} />
          <Row
            dashed
            label="Pending"
            value={formatInr(detail.summary.pendingAmount)}
          />
        </DetailCard>

        {/* Transaction details */}
        <SectionHeader title="Transaction details" />
        <DetailCard>
          <View style={s.txField}>
            <Text style={s.txLabel}>Payment on</Text>
            <Text style={s.txValue}>{formatDateTime(detail.paidAt)}</Text>
          </View>
          <View style={s.txField}>
            <Text style={s.txLabel}>Amount paid</Text>
            <Text style={s.txValue}>{formatInr(detail.amount)}</Text>
          </View>
          {detail.paymentMode ? (
            <View style={s.txField}>
              <Text style={s.txLabel}>Payment mode</Text>
              <Text style={s.txValue}>{detail.paymentMode}</Text>
            </View>
          ) : null}
          <View style={s.txField}>
            <Text style={s.txLabel}>Description</Text>
            <Text style={s.txValue}>{detail.description || "—"}</Text>
          </View>
        </DetailCard>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.pageBg,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: colors.pageBg,
  },
  emptyText: {
    fontSize: 15,
    color: colors.muted,
  },
  backBtn: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  backBtnText: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: "600",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    backgroundColor: colors.pageBg,
  },
  backIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  amountLeft: { flex: 1 },
  amountText: {
    fontSize: 30,
    fontWeight: "800",
    color: colors.navy,
    marginBottom: 4,
  },
  periodText: {
    fontSize: 13,
    color: colors.muted,
  },
  paidBadge: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radii.pill,
    alignSelf: "flex-start",
    marginTop: 6,
  },
  paidBadgeText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#15803D",
  },
  tenantRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  tenantLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  tenantAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.inputBg,
  },
  tenantAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.inputBg,
    alignItems: "center",
    justifyContent: "center",
  },
  tenantInfo: { flex: 1 },
  tenantName: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.navy,
    marginBottom: 2,
  },
  tenantMeta: {
    fontSize: 12,
    color: colors.muted,
  },
  callBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginBottom: 20,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.navy,
    marginBottom: 10,
    marginTop: 4,
  },
  detailCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.card,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 20,
    ...cardShadow,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  rowLabel: {
    fontSize: 14,
    color: colors.muted,
  },
  rowValue: {
    fontSize: 14,
    color: colors.navy,
    fontWeight: "500",
  },
  rowValueBold: {
    fontWeight: "700",
    fontSize: 15,
  },
  dashedDivider: {
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: colors.border,
    marginVertical: 2,
  },
  gridRow: {
    flexDirection: "row",
    paddingVertical: 14,
  },
  gridCell: {
    flex: 1,
  },
  gridLabel: {
    fontSize: 12,
    color: colors.muted,
    marginBottom: 4,
  },
  gridValue: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.navy,
  },
  gridDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  txField: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  txLabel: {
    fontSize: 12,
    color: colors.muted,
    marginBottom: 3,
  },
  txValue: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.navy,
  },
});
