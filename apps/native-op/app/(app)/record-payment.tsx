import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useConvex } from "convex/react";

const C = {
  navy: "#1E293B",
  muted: "#6B7280",
  border: "#E2E8F0",
  inputBg: "#F3F4F6",
  white: "#FFFFFF",
  error: "#DC2626",
  pageBg: "#EEF2F6",
  surfaceGray: "#F1F5F9",
  accent: "#D4F542",
  accentText: "#1A1A1A",
  positive: "#16A34A",
  subtle: "#94A3B8",
};

const PAYMENT_STATUSES = [
  { key: "paid" as const, label: "Paid", fg: "#15803D", bg: "#DCFCE7", dot: "#16A34A", hint: "Full amount received" },
  { key: "partial" as const, label: "Partial", fg: "#1A1A1A", bg: "#E9F5BE", dot: "#84CC16", hint: "Part of amount received" },
  { key: "pending" as const, label: "Pending", fg: "#92400E", bg: "#FEF3C7", dot: "#D97706", hint: "Awaiting payment" },
];

type PaymentStatus = "paid" | "partial" | "pending";

type PaymentHistoryEntry = {
  id: string;
  amount: number;
  status: PaymentStatus;
  note?: string;
  items?: string[];
  createdAt: number;
};

type TenantDetail = {
  _id: string;
  studentName: string;
  studentPhone: string;
  roomNumber?: string | null;
  floorLabel?: string | null;
  roomType?: string | null;
  rent?: number;
  advance?: number;
  security?: number;
  booking?: number;
  maintenance?: number;
  customCharges?: { id: string; label: string; amount: number }[];
  moveInAmount?: number;
  paymentStatus: PaymentStatus;
  paymentHistory?: PaymentHistoryEntry[];
};

function fmtINR(n?: number) {
  return "₹" + (Number(n) || 0).toLocaleString("en-IN");
}
function fmtINRShort(n?: number) {
  const v = Number(n) || 0;
  if (v >= 100000) return "₹" + (v / 100000).toFixed(v % 100000 === 0 ? 0 : 1) + "L";
  if (v >= 1000) return "₹" + (v / 1000).toFixed(v % 1000 === 0 ? 0 : 1) + "k";
  return "₹" + v;
}
function getInitials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("") || "?";
}

// Already-collected row (disabled)
function CollectedLine({
  label, amount, isFirst, isCustom,
}: { label: string; amount: number; isFirst?: boolean; isCustom?: boolean }) {
  return (
    <View
      style={[
        styles.bookingLine,
        !isFirst && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
        { opacity: 0.5 },
      ]}
    >
      <View style={[styles.checkbox, styles.checkboxCollected]}>
        <Ionicons name="checkmark" size={12} color={C.white} />
      </View>
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Text style={styles.bookingLineLabel}>{label}</Text>
        {isCustom && (
          <View style={styles.customBadge}><Text style={styles.customBadgeText}>CUSTOM</Text></View>
        )}
        <View style={styles.collectedBadge}>
          <Text style={styles.collectedBadgeText}>COLLECTED</Text>
        </View>
      </View>
      <Text style={styles.bookingLineAmount}>{fmtINR(amount)}</Text>
    </View>
  );
}

// Selectable row
function SelectLine({
  label, amount, isOn, onToggle, isFirst, isCustom,
}: {
  label: string; amount: number; isOn: boolean; onToggle: () => void;
  isFirst?: boolean; isCustom?: boolean;
}) {
  const disabled = amount === 0;
  return (
    <TouchableOpacity
      style={[
        styles.bookingLine,
        !isFirst && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
      ]}
      onPress={() => !disabled && onToggle()}
      activeOpacity={disabled ? 1 : 0.7}
    >
      <View style={[styles.checkbox, isOn && styles.checkboxOn]}>
        {isOn && <Ionicons name="checkmark" size={12} color={C.accent} />}
      </View>
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Text style={[styles.bookingLineLabel, disabled && { opacity: 0.45 }]}>{label}</Text>
        {isCustom && (
          <View style={styles.customBadge}><Text style={styles.customBadgeText}>CUSTOM</Text></View>
        )}
        {disabled && <Text style={{ fontSize: 10.5, color: C.subtle }}>No amount set</Text>}
      </View>
      <Text style={[styles.bookingLineAmount, { opacity: disabled ? 0.45 : 1 }]}>{fmtINR(amount)}</Text>
    </TouchableOpacity>
  );
}

function TotalCard({ total, collected }: { total: number; collected: string }) {
  const paid = Number(collected) || 0;
  const balance = total - paid;
  return (
    <View style={styles.totalCard}>
      <View style={styles.totalCardDecor} />
      <Text style={styles.totalCardLabel}>New payment total</Text>
      <Text style={styles.totalAmount}>{fmtINR(total)}</Text>
      {total > 0 && (
        <View style={styles.totalCardFooter}>
          <View>
            <Text style={styles.totalCardFooterLabel}>Collecting</Text>
            <Text style={styles.totalCardCollected}>{fmtINR(paid)}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.totalCardFooterLabel}>Balance</Text>
            <Text style={[styles.totalCardBalance, { color: balance > 0 ? "#FCA5A5" : "rgba(255,255,255,0.85)" }]}>
              {balance > 0 ? "−" : ""}{fmtINR(Math.abs(balance))}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

function PaymentStatusPicker({ value, onChange }: { value: PaymentStatus; onChange: (v: PaymentStatus) => void }) {
  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      {PAYMENT_STATUSES.map((s) => {
        const active = value === s.key;
        return (
          <TouchableOpacity
            key={s.key}
            style={[styles.statusPill, { backgroundColor: active ? s.bg : C.white, borderColor: active ? s.dot : C.border }]}
            onPress={() => onChange(s.key)}
            activeOpacity={0.7}
          >
            <View style={[styles.statusDot, { backgroundColor: s.dot }]} />
            <Text style={[styles.statusLabel, { color: active ? s.fg : C.navy }]}>{s.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function RecordPaymentScreen() {
  const { tenantId } = useLocalSearchParams<{ tenantId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const convex = useConvex();

  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<Record<string, boolean>>({});
  const [collected, setCollected] = useState("");
  const [status, setStatus] = useState<PaymentStatus>("paid");

  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    (convex as any).query("tenants:getTenantById", { tenantId })
      .then((t: TenantDetail | null) => {
        if (!t) {
          setLoadError("Tenant not found.");
          return;
        }
        setTenant(t);
        // Default: only uncollected items checked
        const alreadyPaidKeys = new Set(
          (t.paymentHistory ?? []).flatMap((e) => e.items ?? [])
        );
        const allLines = [
          { key: "Rent (monthly)", amount: t.rent ?? 0 },
          { key: "Advance", amount: t.advance ?? 0 },
          { key: "Security deposit", amount: t.security ?? 0 },
          { key: "Booking amount", amount: t.booking ?? 0 },
          { key: "Maintenance", amount: t.maintenance ?? 0 },
          ...(t.customCharges ?? []).map((c) => ({ key: `custom-${c.id}`, amount: c.amount })),
        ];
        const defaults: Record<string, boolean> = {};
        allLines.forEach((l) => {
          if (!alreadyPaidKeys.has(l.key) && l.amount > 0) {
            defaults[l.key] = true;
          }
        });
        setItems(defaults);
      })
      .catch((e: any) => {
        setLoadError(e?.message ?? "Failed to load tenant.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [convex, tenantId]);

  // Items already collected (from history)
  const alreadyPaidLabels = useMemo(
    () => new Set((tenant?.paymentHistory ?? []).flatMap((e) => e.items ?? [])),
    [tenant?.paymentHistory]
  );

  const totalAlreadyCollected = useMemo(
    () => (tenant?.paymentHistory ?? []).reduce((s, e) => s + e.amount, 0),
    [tenant?.paymentHistory]
  );

  // All charge lines
  const ALL_LINES = useMemo(() => {
    if (!tenant) return [];
    return [
      { key: "Rent (monthly)", label: "Rent (monthly)", amount: tenant.rent ?? 0 },
      { key: "Advance", label: "Advance", amount: tenant.advance ?? 0 },
      { key: "Security deposit", label: "Security deposit", amount: tenant.security ?? 0 },
      { key: "Booking amount", label: "Booking amount", amount: tenant.booking ?? 0 },
      { key: "Maintenance", label: "Maintenance", amount: tenant.maintenance ?? 0 },
      ...(tenant.customCharges ?? []).map((c) => ({
        key: `custom-${c.id}`, label: c.label || "Custom charge", amount: c.amount, isCustom: true,
      })),
    ].filter((l) => l.amount > 0 || alreadyPaidLabels.has(l.key));
  }, [tenant, alreadyPaidLabels]);

  const collectedLines = useMemo(() => ALL_LINES.filter((l) => alreadyPaidLabels.has(l.key)), [ALL_LINES, alreadyPaidLabels]);
  const newLines = useMemo(() => ALL_LINES.filter((l) => !alreadyPaidLabels.has(l.key)), [ALL_LINES, alreadyPaidLabels]);

  const total = useMemo(
    () => newLines.reduce((s, l) => s + (items[l.key] ? l.amount : 0), 0),
    [newLines, items]
  );

  useEffect(() => {
    if (status === "paid" && total > 0) {
      setCollected(String(total));
    }
  }, [total, status]);

  const handleSave = useCallback(async () => {
    if (!tenantId || saving) return;
    const amt = Number(collected) || 0;
    if (amt <= 0) {
      Alert.alert("Enter amount", "Please enter the amount collected.");
      return;
    }
    setSaving(true);
    try {
      const selectedLabels = newLines.filter((l) => items[l.key]).map((l) => l.key);
      await (convex as any).mutation("tenants:recordPayment", {
        tenantId,
        amountCollected: amt,
        paymentStatus: status,
        items: selectedLabels,
      });
      router.back();
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Could not save payment.");
    } finally {
      setSaving(false);
    }
  }, [tenantId, collected, status, saving, convex, newLines, items]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.pageBg }}>
        <ActivityIndicator color={C.navy} />
      </View>
    );
  }

  if (loadError || !tenant) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.pageBg }}>
        <Text style={{ color: C.navy, marginBottom: 16 }}>{loadError ?? "Tenant not found."}</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: C.navy, textDecorationLine: "underline" }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.pageBg }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={18} color={C.navy} />
        </TouchableOpacity>
        <View style={{ alignItems: "center" }}>
          <Text style={styles.topBarSub}>Record payment</Text>
          <Text style={styles.topBarTitle}>{tenant.studentName}</Text>
        </View>
        <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Tenant header card */}
        <View style={styles.section}>
          <View style={styles.tenantCard}>
            <View style={styles.tenantAvatar}>
              <Text style={styles.tenantAvatarText}>{getInitials(tenant.studentName)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.tenantName}>{tenant.studentName}</Text>
              <Text style={styles.tenantSub}>
                {[tenant.roomNumber ? `Room #${tenant.roomNumber}` : null, tenant.floorLabel, tenant.roomType]
                  .filter(Boolean).join(" · ")}
              </Text>
            </View>
            <View style={styles.rentBadge}>
              <Text style={styles.rentBadgeText}>{fmtINRShort(tenant.rent)}/mo</Text>
            </View>
          </View>
        </View>

        {/* Already collected section (disabled) */}
        {collectedLines.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeadRow}>
              <View style={[styles.sectionIconWrap, { backgroundColor: C.positive }]}>
                <Ionicons name="checkmark-done-outline" size={16} color={C.white} />
              </View>
              <View>
                <Text style={styles.sectionTitle}>Already collected</Text>
                <Text style={styles.sectionSub}>{fmtINR(totalAlreadyCollected)} received so far</Text>
              </View>
            </View>
            <View style={[styles.card, { opacity: 0.75 }]}>
              {collectedLines.map((line, i) => (
                <CollectedLine
                  key={line.label}
                  label={line.label}
                  amount={line.amount}
                  isFirst={i === 0}
                  isCustom={"isCustom" in line ? (line as any).isCustom : false}
                />
              ))}
              <View style={styles.collectedSummaryRow}>
                <Text style={styles.collectedSummaryLabel}>Total collected</Text>
                <Text style={styles.collectedSummaryAmt}>{fmtINR(totalAlreadyCollected)}</Text>
              </View>
            </View>
          </View>
        )}

        {/* New payment section */}
        <View style={styles.section}>
          <View style={styles.sectionHeadRow}>
            <View style={styles.sectionIconWrap}>
              <Ionicons name="cash-outline" size={16} color={C.accent} />
            </View>
            <View>
              <Text style={styles.sectionTitle}>
                {collectedLines.length > 0 ? "New payment" : "Payment items"}
              </Text>
              <Text style={styles.sectionSub}>
                {collectedLines.length > 0 ? "Select remaining charges to collect" : "Pick the charges being collected"}
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            {newLines.length === 0 ? (
              <View style={{ paddingVertical: 20, alignItems: "center", gap: 6 }}>
                <Ionicons name="checkmark-circle" size={28} color={C.positive} />
                <Text style={{ fontSize: 13.5, fontWeight: "700", color: C.navy }}>All charges collected</Text>
                <Text style={{ fontSize: 11.5, color: C.muted }}>No pending items remaining</Text>
              </View>
            ) : (
              <>
                {newLines.map((line, i) => (
                  <SelectLine
                    key={line.label}
                    label={line.label}
                    amount={line.amount}
                    isOn={!!items[line.key]}
                    onToggle={() => setItems((prev) => ({ ...prev, [line.key]: !prev[line.key] }))}
                    isFirst={i === 0}
                    isCustom={"isCustom" in line ? (line as any).isCustom : false}
                  />
                ))}

                <TotalCard total={total} collected={collected} />

                {/* Amount input */}
                <View style={{ gap: 6 }}>
                  <Text style={styles.fieldLabel}>Amount being collected</Text>
                  <View style={styles.moneyInputWrap}>
                    <Text style={styles.moneyPrefix}>₹</Text>
                    <TextInput
                      style={styles.moneyInput}
                      value={collected}
                      onChangeText={(t) => setCollected(t.replace(/[^\d]/g, ""))}
                      placeholder="0"
                      placeholderTextColor={C.subtle}
                      keyboardType="numeric"
                    />
                  </View>
                  {total > 0 && (
                    <Text style={{ fontSize: 10.5, color: C.subtle }}>Out of {fmtINR(total)} total</Text>
                  )}
                </View>

                {total > 0 && (
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    <TouchableOpacity
                      style={styles.autofillBtn}
                      onPress={() => { setCollected(String(total)); setStatus("paid"); }}
                    >
                      <Text style={styles.autofillBtnText}>Mark full {fmtINRShort(total)} paid</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.autofillBtn, { backgroundColor: C.surfaceGray }]}
                      onPress={() => { setCollected("0"); setStatus("pending"); }}
                    >
                      <Text style={[styles.autofillBtnText, { color: C.muted }]}>Clear</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <View style={{ gap: 8 }}>
                  <Text style={styles.fieldLabel}>Payment status</Text>
                  <PaymentStatusPicker value={status} onChange={setStatus} />
                  <Text style={{ fontSize: 10.5, color: C.muted }}>
                    {PAYMENT_STATUSES.find((s) => s.key === status)?.hint}
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Save button */}
      {newLines.length > 0 && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color={C.accentText} />
            ) : (
              <Text style={styles.saveBtnText}>Record payment</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingBottom: 14, backgroundColor: C.pageBg,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: C.white, borderWidth: 1, borderColor: C.border,
    alignItems: "center", justifyContent: "center",
  },
  topBarSub: { fontSize: 10.5, color: C.muted, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase" },
  topBarTitle: { fontSize: 16, fontWeight: "800", color: C.navy, letterSpacing: -0.3 },
  cancelBtn: { paddingHorizontal: 4, paddingVertical: 8 },
  cancelText: { fontSize: 13.5, color: C.muted, fontWeight: "600" },

  section: { paddingHorizontal: 20, paddingTop: 14 },
  sectionHeadRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  sectionIconWrap: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: C.navy, alignItems: "center", justifyContent: "center",
  },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: C.navy, letterSpacing: -0.3 },
  sectionSub: { fontSize: 11.5, color: C.muted, fontWeight: "500", marginTop: 1 },

  tenantCard: {
    backgroundColor: C.white, borderRadius: 16,
    padding: 14, flexDirection: "row", alignItems: "center", gap: 12,
    borderWidth: 1, borderColor: C.border,
  },
  tenantAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: C.navy, alignItems: "center", justifyContent: "center",
  },
  tenantAvatarText: { color: C.accent, fontSize: 16, fontWeight: "800" },
  tenantName: { fontSize: 15, fontWeight: "800", color: C.navy, letterSpacing: -0.3 },
  tenantSub: { fontSize: 11.5, color: C.muted, fontWeight: "500", marginTop: 2 },
  rentBadge: { backgroundColor: C.surfaceGray, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  rentBadgeText: { fontSize: 12, fontWeight: "700", color: C.navy },

  card: {
    backgroundColor: C.white, borderRadius: 18,
    padding: 16, gap: 14, borderWidth: 1, borderColor: C.border,
  },

  bookingLine: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 12, minHeight: 48,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 7,
    borderWidth: 1.5, borderColor: C.border,
    backgroundColor: C.white, alignItems: "center", justifyContent: "center",
  },
  checkboxOn: { backgroundColor: C.navy, borderColor: C.navy },
  checkboxCollected: { backgroundColor: C.positive, borderColor: C.positive },
  bookingLineLabel: { fontSize: 13.5, fontWeight: "600", color: C.navy },
  bookingLineAmount: { fontSize: 13.5, fontWeight: "700", color: C.navy, letterSpacing: -0.2 },
  customBadge: { backgroundColor: C.surfaceGray, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 },
  customBadgeText: { fontSize: 9, fontWeight: "800", color: C.muted, letterSpacing: 0.5 },
  collectedBadge: { backgroundColor: "#DCFCE7", borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 },
  collectedBadgeText: { fontSize: 9, fontWeight: "800", color: C.positive, letterSpacing: 0.5 },

  collectedSummaryRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border,
  },
  collectedSummaryLabel: { fontSize: 12, fontWeight: "700", color: C.muted },
  collectedSummaryAmt: { fontSize: 14, fontWeight: "800", color: C.positive },

  totalCard: { backgroundColor: C.navy, borderRadius: 14, padding: 14, overflow: "hidden" },
  totalCardDecor: {
    position: "absolute", right: -20, top: -20,
    width: 90, height: 90, borderRadius: 999, backgroundColor: "rgba(212,245,66,0.08)",
  },
  totalCardLabel: { fontSize: 10, color: "rgba(255,255,255,0.6)", fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" },
  totalAmount: { fontSize: 22, fontWeight: "800", color: C.white, letterSpacing: -0.5, marginTop: 4 },
  totalCardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 10 },
  totalCardFooterLabel: { fontSize: 10, color: "rgba(255,255,255,0.5)", fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  totalCardCollected: { fontSize: 16, fontWeight: "800", color: C.accent, marginTop: 2 },
  totalCardBalance: { fontSize: 16, fontWeight: "800", marginTop: 2 },

  fieldLabel: { fontSize: 12.5, fontWeight: "700", color: C.navy },
  moneyInputWrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.inputBg, borderRadius: 14,
    borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 14, height: 52,
  },
  moneyPrefix: { fontSize: 18, fontWeight: "700", color: C.navy, marginRight: 6 },
  moneyInput: { flex: 1, fontSize: 22, fontWeight: "800", color: C.navy, letterSpacing: -0.5 },

  autofillBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, backgroundColor: C.navy, alignItems: "center" },
  autofillBtnText: { fontSize: 12, fontWeight: "700", color: C.white },

  statusPill: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5,
  },
  statusDot: { width: 7, height: 7, borderRadius: 999 },
  statusLabel: { fontSize: 12.5, fontWeight: "800" },

  footer: {
    paddingHorizontal: 20, paddingTop: 12,
    backgroundColor: C.pageBg, borderTopWidth: 1, borderTopColor: C.border,
  },
  saveBtn: { backgroundColor: C.accent, borderRadius: 16, paddingVertical: 16, alignItems: "center" },
  saveBtnText: { fontSize: 15.5, fontWeight: "800", color: C.accentText, letterSpacing: -0.2 },
});
