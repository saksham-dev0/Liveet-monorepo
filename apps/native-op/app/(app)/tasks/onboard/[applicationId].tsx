import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useConvex } from "convex/react";
import { colors, radii } from "../../../../constants/theme";

type RoomOption = { roomId: string; roomLabel: string };

type AppData = {
  propertyName: string;
  tenantName: string;
  moveInDate: string;
  assignedRoomId: string | null;
  assignedRoomNumber: string | null;
  availableRooms: RoomOption[];
  onboardingSecurityDeposit: number | null;
  onboardingAgreementDuration: string | null;
  onboardingRentCycle: string | null;
  onboardingRentCycleCustomDay: number | null;
  onboardingExtraCharges: string | null;
  selectedRentAmount: number | null;
};

/** Parses "1 month", "11 months", "1 year", "2 years" → number of months, or null */
function parseMonths(duration: string): number | null {
  const s = duration.trim().toLowerCase();
  const yearMatch = s.match(/^(\d+)\s*year/);
  if (yearMatch) return parseInt(yearMatch[1], 10) * 12;
  const monthMatch = s.match(/^(\d+)\s*month/);
  if (monthMatch) return parseInt(monthMatch[1], 10);
  return null;
}

function formatINR(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

const RENT_CYCLES = [
  { key: "1st", label: "1st of every month" },
  { key: "5th", label: "5th of every month" },
  { key: "custom", label: "Custom day" },
] as const;
type RentCycleKey = (typeof RENT_CYCLES)[number]["key"];

function SectionHeader({ title }: { title: string }) {
  return <Text style={s.sectionHeader}>{title}</Text>;
}

function FieldLabel({ text, optional }: { text: string; optional?: boolean }) {
  return (
    <View style={s.fieldLabelRow}>
      <Text style={s.fieldLabel}>{text}</Text>
      {optional && <Text style={s.optionalTag}>optional</Text>}
    </View>
  );
}

export default function OnboardTenantScreen() {
  const { applicationId } = useLocalSearchParams<{ applicationId: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const convex = useConvex();

  const [appData, setAppData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Form state
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [securityDeposit, setSecurityDeposit] = useState("");
  const [agreementDuration, setAgreementDuration] = useState("");
  const [rentCycle, setRentCycle] = useState<RentCycleKey | null>(null);
  const [rentCycleCustomDay, setRentCycleCustomDay] = useState("");
  const [extraCharges, setExtraCharges] = useState("");

  const load = useCallback(async () => {
    if (!applicationId) return;
    setLoading(true);
    try {
      const res = await (convex as any).query("moveIn:getApplicationForOnboarding", {
        applicationId,
      });
      if (!res || res.notFound) {
        setAppData(null);
        return;
      }
      setAppData(res as AppData);
      // Pre-fill from existing onboarding data
      if (res.assignedRoomId) setSelectedRoomId(res.assignedRoomId);
      if (res.onboardingSecurityDeposit != null)
        setSecurityDeposit(String(res.onboardingSecurityDeposit));
      if (res.onboardingAgreementDuration) setAgreementDuration(res.onboardingAgreementDuration);
      if (res.onboardingRentCycle) setRentCycle(res.onboardingRentCycle as RentCycleKey);
      if (res.onboardingRentCycleCustomDay != null)
        setRentCycleCustomDay(String(res.onboardingRentCycleCustomDay));
      if (res.onboardingExtraCharges) setExtraCharges(res.onboardingExtraCharges);
    } catch {
      setAppData(null);
    } finally {
      setLoading(false);
    }
  }, [applicationId, convex]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSubmit = useCallback(async () => {
    if (!applicationId || submitting) return;

    const depositNum = securityDeposit.trim()
      ? parseFloat(securityDeposit.trim())
      : undefined;
    if (securityDeposit.trim() && (isNaN(depositNum!) || depositNum! < 0)) {
      Alert.alert("Invalid input", "Security deposit must be a valid amount.");
      return;
    }

    const customDay = rentCycle === "custom" && rentCycleCustomDay.trim()
      ? parseInt(rentCycleCustomDay.trim(), 10)
      : undefined;
    if (rentCycle === "custom" && rentCycleCustomDay.trim()) {
      if (isNaN(customDay!) || customDay! < 1 || customDay! > 31) {
        Alert.alert("Invalid input", "Custom rent day must be between 1 and 31.");
        return;
      }
    }

    setSubmitting(true);
    try {
      await (convex as any).mutation("moveIn:onboardTenant", {
        applicationId,
        roomId: selectedRoomId ?? undefined,
        securityDeposit: depositNum,
        agreementDuration: agreementDuration.trim() || undefined,
        rentCycle: rentCycle ?? undefined,
        rentCycleCustomDay: customDay,
        extraCharges: extraCharges.trim() || undefined,
      });
      setSubmitted(true);
    } catch (err) {
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Something went wrong. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }, [
    applicationId,
    agreementDuration,
    convex,
    extraCharges,
    rentCycle,
    rentCycleCustomDay,
    securityDeposit,
    selectedRoomId,
    submitting,
  ]);

  if (submitted) {
    return (
      <View style={[s.root, { paddingTop: insets.top }]}>
        <View style={s.successWrap}>
          <View style={s.successCircle}>
            <Ionicons name="checkmark" size={40} color={colors.white} />
          </View>
          <Text style={s.successTitle}>Tenant onboarded!</Text>
          <Text style={s.successSubtitle}>
            {appData?.tenantName || "The tenant"} has been successfully onboarded.
          </Text>
          <Pressable
            style={s.doneBtn}
            onPress={() => {
              router.back();
              router.back();
            }}
          >
            <Text style={s.doneBtnText}>Back to Tasks</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[s.root, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={s.header}>
          <Pressable
            style={s.backBtn}
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={22} color={colors.black} />
          </Pressable>
          <Text style={s.headerTitle}>Onboard Tenant</Text>
          <View style={{ width: 44 }} />
        </View>

        {loading ? (
          <View style={s.loadingWrap}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : !appData ? (
          <View style={s.loadingWrap}>
            <Text style={s.emptyText}>Application not found or access denied.</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={s.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Tenant summary banner */}
            <View style={s.bannerCard}>
              <View style={s.bannerIcon}>
                <Ionicons name="person-outline" size={20} color={colors.white} />
              </View>
              <View style={s.bannerText}>
                <Text style={s.bannerName} numberOfLines={1}>
                  {appData.tenantName || "New tenant"}
                </Text>
                <Text style={s.bannerSub} numberOfLines={1}>
                  {appData.propertyName}
                  {appData.moveInDate ? `  ·  Move-in: ${appData.moveInDate}` : ""}
                </Text>
              </View>
            </View>

            {/* ─── Room Assignment ─── */}
            <SectionHeader title="Room Assignment" />
            {appData.availableRooms.length === 0 ? (
              <View style={s.emptyCard}>
                <Ionicons name="bed-outline" size={24} color={colors.muted} />
                <Text style={s.emptyCardText}>
                  No rooms available. Add rooms in property settings.
                </Text>
              </View>
            ) : (
              <View style={s.roomGrid}>
                {appData.availableRooms.map((room) => {
                  const sel = selectedRoomId === room.roomId;
                  return (
                    <Pressable
                      key={room.roomId}
                      style={[s.roomChip, sel && s.roomChipSelected]}
                      onPress={() =>
                        setSelectedRoomId(sel ? null : room.roomId)
                      }
                    >
                      <Text style={[s.roomChipText, sel && s.roomChipTextSelected]}>
                        {room.roomLabel}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
            {appData.assignedRoomNumber && !selectedRoomId ? (
              <Text style={s.hintText}>
                Currently assigned: Room {appData.assignedRoomNumber}
              </Text>
            ) : null}

            {/* ─── Security Deposit ─── */}
            <SectionHeader title="Security Deposit" />
            <FieldLabel text="Amount (₹)" optional />
            <TextInput
              style={s.input}
              value={securityDeposit}
              onChangeText={setSecurityDeposit}
              placeholder="e.g. 25000"
              placeholderTextColor="rgba(107,114,128,0.7)"
              keyboardType="numeric"
            />

            {/* ─── Agreement Duration ─── */}
            <SectionHeader title="Agreement Duration" />
            <FieldLabel text="Duration" optional />
            <TextInput
              style={s.input}
              value={agreementDuration}
              onChangeText={setAgreementDuration}
              placeholder="e.g. 11 months, 1 year"
              placeholderTextColor="rgba(107,114,128,0.7)"
            />

            {/* ─── Rent Cycle ─── */}
            <SectionHeader title="Rent Cycle" />
            <FieldLabel text="Due date" optional />
            <View style={s.chipRow}>
              {RENT_CYCLES.map((cycle) => {
                const active = rentCycle === cycle.key;
                return (
                  <Pressable
                    key={cycle.key}
                    style={[s.chip, active && s.chipActive]}
                    onPress={() => setRentCycle(active ? null : cycle.key)}
                  >
                    <Text style={[s.chipText, active && s.chipTextActive]}>
                      {cycle.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {rentCycle === "custom" ? (
              <View style={s.customDayWrap}>
                <FieldLabel text="Day of month (1–31)" />
                <TextInput
                  style={s.input}
                  value={rentCycleCustomDay}
                  onChangeText={setRentCycleCustomDay}
                  placeholder="e.g. 15"
                  placeholderTextColor="rgba(107,114,128,0.7)"
                  keyboardType="number-pad"
                  maxLength={2}
                />
              </View>
            ) : null}

            {/* ─── Payment Summary ─── */}
            {(() => {
              const months = parseMonths(agreementDuration);
              const rent = appData.selectedRentAmount;
              if (!months) return null;
              if (months === 1) {
                return (
                  <View style={s.paymentSummaryCard}>
                    <Text style={s.paymentSummaryTitle}>Payment summary</Text>
                    <Text style={s.paymentSummaryLine}>
                      1-month agreement — tenant pays the monthly rent cycle only.
                    </Text>
                    {rent != null && (
                      <Text style={s.paymentSummaryTotal}>
                        {formatINR(rent)}/month
                      </Text>
                    )}
                  </View>
                );
              }
              const deposit = parseFloat(securityDeposit) || 0;
              const rentPerMonth = rent ?? 0;
              const total = deposit + months * rentPerMonth;
              return (
                <View style={s.paymentSummaryCard}>
                  <Text style={s.paymentSummaryTitle}>Payment summary</Text>
                  {deposit > 0 && (
                    <Text style={s.paymentSummaryLine}>
                      Security deposit: {formatINR(deposit)}
                    </Text>
                  )}
                  {rentPerMonth > 0 && (
                    <Text style={s.paymentSummaryLine}>
                      Rent: {formatINR(rentPerMonth)} × {months} months = {formatINR(rentPerMonth * months)}
                    </Text>
                  )}
                  {(deposit > 0 || rentPerMonth > 0) && (
                    <Text style={s.paymentSummaryTotal}>
                      Total due: {formatINR(total)}
                    </Text>
                  )}
                </View>
              );
            })()}

            {/* ─── Extra Charges ─── */}
            <SectionHeader title="Extra Charges" />
            <FieldLabel text="Details" optional />
            <TextInput
              style={[s.input, s.textArea]}
              value={extraCharges}
              onChangeText={setExtraCharges}
              placeholder="e.g. Electricity at actuals, Maintenance ₹500/month"
              placeholderTextColor="rgba(107,114,128,0.7)"
              multiline
              textAlignVertical="top"
            />

            {/* Submit */}
            <Pressable
              style={[s.submitBtn, submitting && s.submitBtnDisabled]}
              onPress={() => void handleSubmit()}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={s.submitBtnText}>Confirm Onboarding</Text>
              )}
            </Pressable>
          </ScrollView>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg, paddingHorizontal: 16 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    paddingTop: 4,
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
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.black,
    textAlign: "center",
    flex: 1,
  },

  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyText: { fontSize: 14, color: colors.muted, textAlign: "center" },

  scrollContent: { paddingBottom: 40 },

  bannerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.primary,
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    marginTop: 4,
  },
  bannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  bannerText: { flex: 1 },
  bannerName: { fontSize: 15, fontWeight: "800", color: colors.white },
  bannerSub: { fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 2 },

  sectionHeader: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.black,
    marginTop: 20,
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },

  fieldLabelRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  fieldLabel: { fontSize: 13, fontWeight: "700", color: colors.navy },
  optionalTag: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: "500",
    backgroundColor: colors.inputBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },

  input: {
    backgroundColor: colors.white,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: colors.navy,
    fontWeight: "500",
  },
  textArea: { minHeight: 84, textAlignVertical: "top" },

  hintText: { fontSize: 12, color: colors.muted, marginTop: 6 },

  // Room grid
  roomGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  roomChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  roomChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  roomChipText: { fontSize: 13, fontWeight: "600", color: colors.navy },
  roomChipTextSelected: { color: colors.white },

  // Chip row (rent cycle)
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: "600", color: colors.navy },
  chipTextActive: { color: colors.white },
  customDayWrap: { marginTop: 12 },

  // Empty state card
  emptyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  emptyCardText: { fontSize: 13, color: colors.muted, flex: 1, lineHeight: 18 },

  // Payment summary
  paymentSummaryCard: {
    marginTop: 16,
    backgroundColor: colors.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 6,
  },
  paymentSummaryTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  paymentSummaryLine: {
    fontSize: 13,
    color: colors.navy,
    fontWeight: "500",
  },
  paymentSummaryTotal: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.primary,
    marginTop: 4,
  },

  // Submit button
  submitBtn: {
    marginTop: 28,
    borderRadius: radii.pill,
    paddingVertical: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { fontSize: 15, fontWeight: "700", color: colors.white },

  // Success screen
  successWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingBottom: 40,
  },
  successCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.black,
    marginBottom: 10,
  },
  successSubtitle: {
    fontSize: 14,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
  },
  doneBtn: {
    borderRadius: radii.pill,
    paddingVertical: 14,
    paddingHorizontal: 32,
    backgroundColor: colors.primary,
    alignItems: "center",
  },
  doneBtnText: { fontSize: 15, fontWeight: "700", color: colors.white },
});
