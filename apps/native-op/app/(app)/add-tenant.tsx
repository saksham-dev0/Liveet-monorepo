import React, { useMemo, useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useConvex } from "convex/react";

// ─── Tokens ─────────────────────────────────────────────────
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
  progressTrack: "#E2E8F0",
};

const COURSE_OPTIONS = [
  "B.Tech CSE", "B.Tech ECE", "B.Tech ME",
  "B.Sc", "B.Com", "BBA", "BCA",
  "M.Tech", "MBA", "MCA",
  "MBBS", "Law", "Other",
];

const PAYMENT_STATUSES = [
  { key: "paid" as const, label: "Paid", fg: "#15803D", bg: "#DCFCE7", dot: "#16A34A", hint: "Tenant has cleared the move-in amount" },
  { key: "partial" as const, label: "Partial", fg: "#1A1A1A", bg: "#E9F5BE", dot: "#84CC16", hint: "Part of move-in amount received" },
  { key: "pending" as const, label: "Pending", fg: "#92400E", bg: "#FEF3C7", dot: "#D97706", hint: "Awaiting payment from tenant" },
];

const BOOKING_LINES = [
  { key: "rent" as const, label: "Rent (monthly)" },
  { key: "advance" as const, label: "Advance" },
  { key: "security" as const, label: "Security deposit" },
  { key: "booking" as const, label: "Booking amount" },
  { key: "maintenance" as const, label: "Maintenance" },
];

type PaymentStatus = "paid" | "partial" | "pending";

interface CustomCharge {
  id: string;
  label: string;
  amount: string;
}

interface FormState {
  studentName: string;
  studentPhone: string;
  studentEmail: string;
  course: string;
  parentName: string;
  parentPhone: string;
  parentEmail: string;
  roomId: string;
  rent: string;
  advance: string;
  security: string;
  booking: string;
  maintenance: string;
  customCharges: CustomCharge[];
  bookingItems: Record<string, boolean>;
  moveIn: string;
  paymentStatus: PaymentStatus;
}

// ─── Helpers ─────────────────────────────────────────────────
function fmtINR(n: string | number) {
  const v = Number(n) || 0;
  return "₹" + v.toLocaleString("en-IN");
}

function fmtINRShort(n: number) {
  if (n >= 100000) return "₹" + (n / 100000).toFixed(n % 100000 === 0 ? 0 : 1) + "L";
  if (n >= 1000) return "₹" + (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + "k";
  return "₹" + n;
}

function getInitials(name: string) {
  return (name || "")
    .split(" ").filter(Boolean).slice(0, 2)
    .map((s) => s[0]?.toUpperCase()).join("") || "+";
}

// ─── Avatar ───────────────────────────────────────────────────
function StudentAvatar({ name }: { name: string }) {
  const initials = getInitials(name);
  return (
    <View style={[
      styles.avatar,
      { backgroundColor: name ? C.navy : C.surfaceGray, borderWidth: name ? 0 : 1.5 },
    ]}>
      <Text style={[styles.avatarText, { color: name ? C.accent : C.muted }]}>
        {initials}
      </Text>
      <View style={styles.avatarBadge}>
        <Ionicons name="camera" size={9} color={C.navy} />
      </View>
    </View>
  );
}

// ─── Section header ───────────────────────────────────────────
function SectionHead({
  num, title, sub, icon, accent,
}: {
  num: string; title: string; sub?: string; icon: any; accent?: boolean;
}) {
  return (
    <View style={styles.sectionHead}>
      <View style={[styles.sectionIcon, { backgroundColor: accent ? C.accent : C.navy }]}>
        <Ionicons name={icon} size={15} color={accent ? C.accentText : C.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
          <Text style={styles.sectionNum}>0{num}</Text>
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        {sub && <Text style={styles.sectionSub}>{sub}</Text>}
      </View>
    </View>
  );
}

// ─── Text field ───────────────────────────────────────────────
function TextField({
  label, value, onChange, placeholder, required, keyboardType, icon, autoCapitalize,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; required?: boolean; keyboardType?: any;
  icon?: any; autoCapitalize?: any;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.fieldLabel}>
        {label}{required && <Text style={{ color: C.error }}> *</Text>}
      </Text>
      <View style={[
        styles.inputWrap,
        focused && styles.inputWrapFocused,
      ]}>
        {icon && <Ionicons name={icon} size={15} color={C.muted} style={{ marginRight: 4 }} />}
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={C.subtle}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize ?? "words"}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </View>
    </View>
  );
}

// ─── Phone field ──────────────────────────────────────────────
function PhoneField({
  label, value, onChange, required,
}: {
  label: string; value: string; onChange: (v: string) => void; required?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.fieldLabel}>
        {label}{required && <Text style={{ color: C.error }}> *</Text>}
      </Text>
      <View style={[styles.inputWrap, focused && styles.inputWrapFocused, { padding: 0 }]}>
        <View style={styles.phonePrefixWrap}>
          <Text style={styles.phonePrefix}>+91</Text>
        </View>
        <TextInput
          style={[styles.input, { paddingLeft: 14, flex: 1 }]}
          value={value}
          onChangeText={(t) => onChange(t.replace(/\D/g, "").slice(0, 10))}
          placeholder="98765 43210"
          placeholderTextColor={C.subtle}
          keyboardType="phone-pad"
          autoCapitalize="none"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </View>
    </View>
  );
}

// ─── Charge row ───────────────────────────────────────────────
function ChargeRow({
  label, value, onChange, last,
}: {
  label: string; value: string; onChange: (v: string) => void; last?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.chargeRow, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.chargeLabel}>{label}</Text>
      <View style={[styles.chargeInput, focused && styles.chargeInputFocused]}>
        <Text style={styles.chargePrefix}>₹</Text>
        <TextInput
          style={styles.chargeTextInput}
          value={value}
          onChangeText={(t) => onChange(t.replace(/[^\d]/g, ""))}
          placeholder="0"
          placeholderTextColor={C.subtle}
          keyboardType="numeric"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </View>
    </View>
  );
}

// ─── Custom charge row ────────────────────────────────────────
function CustomChargeRow({
  item, onLabel, onAmount, onRemove,
}: {
  item: CustomCharge; onLabel: (v: string) => void;
  onAmount: (v: string) => void; onRemove: () => void;
}) {
  const [amtFocused, setAmtFocused] = useState(false);
  return (
    <View style={styles.customChargeRow}>
      <TouchableOpacity style={styles.removeBtn} onPress={onRemove}>
        <View style={{ width: 10, height: 2, backgroundColor: C.muted, borderRadius: 1 }} />
      </TouchableOpacity>
      <TextInput
        style={styles.customLabelInput}
        value={item.label}
        onChangeText={onLabel}
        placeholder="Charge name"
        placeholderTextColor={C.subtle}
        autoCapitalize="words"
      />
      <View style={[styles.chargeInput, amtFocused && styles.chargeInputFocused]}>
        <Text style={styles.chargePrefix}>₹</Text>
        <TextInput
          style={styles.chargeTextInput}
          value={item.amount}
          onChangeText={(t) => onAmount(t.replace(/[^\d]/g, ""))}
          placeholder="0"
          placeholderTextColor={C.subtle}
          keyboardType="numeric"
          onFocus={() => setAmtFocused(true)}
          onBlur={() => setAmtFocused(false)}
        />
      </View>
    </View>
  );
}

// ─── Booking line (checkbox) ──────────────────────────────────
function BookingLine({
  lineKey, label, amount, isOn, onToggle, isCustom, isFirst,
}: {
  lineKey: string; label: string; amount: number; isOn: boolean;
  onToggle: () => void; isCustom?: boolean; isFirst?: boolean;
}) {
  const disabled = amount === 0;
  return (
    <TouchableOpacity
      style={[styles.bookingLine, !isFirst && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border }]}
      onPress={() => !disabled && onToggle()}
      activeOpacity={disabled ? 1 : 0.7}
    >
      <View style={[styles.checkbox, isOn && styles.checkboxOn]}>
        {isOn && <Ionicons name="checkmark" size={12} color={C.accent} />}
      </View>
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Text style={[styles.bookingLineLabel, disabled && { opacity: 0.45 }]}>{label}</Text>
        {isCustom && (
          <View style={styles.customBadge}>
            <Text style={styles.customBadgeText}>CUSTOM</Text>
          </View>
        )}
        {disabled && !isCustom && (
          <Text style={{ fontSize: 10.5, color: C.subtle }}>Set amount above</Text>
        )}
      </View>
      <Text style={[styles.bookingLineAmount, { opacity: disabled ? 0.45 : 1 }]}>
        {fmtINR(amount)}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Booking total card ───────────────────────────────────────
function BookingTotalCard({ amount, count, moveIn }: { amount: number; count: number; moveIn: string }) {
  const paid = Number(moveIn) || 0;
  const balance = amount - paid;
  return (
    <View style={styles.totalCard}>
      <View style={styles.totalCardDecor} />
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={styles.totalCardLabel}>Booking amount to be paid</Text>
        <View style={styles.totalCountBadge}>
          <Text style={styles.totalCountText}>{count} item{count === 1 ? "" : "s"}</Text>
        </View>
      </View>
      <Text style={styles.totalAmount}>{fmtINR(amount)}</Text>
      {(paid > 0 || amount > 0) && (
        <View style={styles.totalCardFooter}>
          <View>
            <Text style={styles.totalCardFooterLabel}>Collected</Text>
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

// ─── Payment status picker ────────────────────────────────────
function PaymentStatusPicker({ value, onChange }: { value: PaymentStatus; onChange: (v: PaymentStatus) => void }) {
  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      {PAYMENT_STATUSES.map((s) => {
        const active = value === s.key;
        return (
          <TouchableOpacity
            key={s.key}
            style={[
              styles.statusPill,
              { backgroundColor: active ? s.bg : C.white, borderColor: active ? s.dot : C.border },
            ]}
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

// ─── Main screen ──────────────────────────────────────────────
interface RoomOption {
  id: string;
  roomNumber: string;
  type: string;
  capacity: number;
  floorLabel: string;
  rent?: number;
  deposit?: number;
}

export default function AddTenantScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const convex = useConvex();
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (convex as any).query("tenants:getAvailableRooms", {}).then(setRooms).catch(() => {});
  }, [convex]);
  const [form, setForm] = useState<FormState>({
    studentName: "",
    studentPhone: "",
    studentEmail: "",
    course: "",
    parentName: "",
    parentPhone: "",
    parentEmail: "",
    roomId: "",
    rent: "",
    advance: "",
    security: "",
    booking: "",
    maintenance: "",
    customCharges: [],
    bookingItems: { rent: false, advance: true, security: true, booking: true, maintenance: false },
    moveIn: "",
    paymentStatus: "pending",
  });

  const set = useCallback(<K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
  }, []);

  const toggleBookingItem = useCallback((k: string) => {
    setForm((f) => ({ ...f, bookingItems: { ...f.bookingItems, [k]: !f.bookingItems[k] } }));
  }, []);

  const addCustomCharge = useCallback(() => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    setForm((f) => ({
      ...f,
      customCharges: [...f.customCharges, { id, label: "", amount: "" }],
      bookingItems: { ...f.bookingItems, [`custom_${id}`]: true },
    }));
  }, []);

  const updateCustomCharge = useCallback((id: string, patch: Partial<CustomCharge>) => {
    setForm((f) => ({
      ...f,
      customCharges: f.customCharges.map((c) => c.id === id ? { ...c, ...patch } : c),
    }));
  }, []);

  const removeCustomCharge = useCallback((id: string) => {
    setForm((f) => {
      const next = { ...f.bookingItems };
      delete next[`custom_${id}`];
      return { ...f, customCharges: f.customCharges.filter((c) => c.id !== id), bookingItems: next };
    });
  }, []);

  const charges = { rent: form.rent, advance: form.advance, security: form.security, booking: form.booking, maintenance: form.maintenance };

  const { total, selectedCount } = useMemo(() => {
    let t = 0;
    let cnt = 0;
    BOOKING_LINES.forEach((line) => {
      if (form.bookingItems[line.key]) {
        const amt = Number(charges[line.key]) || 0;
        t += amt;
        if (amt > 0) cnt++;
      }
    });
    form.customCharges.forEach((c) => {
      if (form.bookingItems[`custom_${c.id}`]) {
        const amt = Number(c.amount) || 0;
        t += amt;
        if (amt > 0) cnt++;
      }
    });
    return { total: t, selectedCount: cnt };
  }, [form.rent, form.advance, form.security, form.booking, form.maintenance, form.bookingItems, form.customCharges]);

  const filled = {
    student: !!(form.studentName && form.studentPhone),
    parent: !!(form.parentName && form.parentPhone),
    room: !!form.roomId,
    booking: total > 0,
  };
  const canSubmit = filled.student && filled.room;

  const handleSave = useCallback(async () => {
    if (!canSubmit || saving) return;
    setSaving(true);
    try {
      await (convex as any).mutation("tenants:addTenant", {
        studentName: form.studentName,
        studentPhone: form.studentPhone,
        studentEmail: form.studentEmail || undefined,
        course: form.course || undefined,
        parentName: form.parentName || undefined,
        parentPhone: form.parentPhone || undefined,
        parentEmail: form.parentEmail || undefined,
        roomId: form.roomId ? (form.roomId as any) : undefined,
        rent: Number(form.rent) || undefined,
        advance: Number(form.advance) || undefined,
        security: Number(form.security) || undefined,
        booking: Number(form.booking) || undefined,
        maintenance: Number(form.maintenance) || undefined,
        customCharges: form.customCharges
          .filter((c) => c.label && c.amount)
          .map((c) => ({ id: c.id, label: c.label, amount: Number(c.amount) })),
        moveInAmount: Number(form.moveIn) || undefined,
        paymentStatus: form.paymentStatus,
      });
      router.back();
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Could not save tenant.");
    } finally {
      setSaving(false);
    }
  }, [form, canSubmit, saving, convex]);

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
          <Text style={styles.topBarSub}>New tenant</Text>
          <Text style={styles.topBarTitle}>Add to property</Text>
        </View>
        <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>

      {/* Progress bar */}
      <View style={styles.progressRow}>
        {Object.values(filled).map((done, i) => (
          <View key={i} style={[styles.progressDot, { backgroundColor: done ? C.navy : C.progressTrack }]} />
        ))}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Section 1: Student ─────────────────────────────── */}
        <View style={styles.section}>
          <SectionHead num="1" title="Student" sub="Tenant's personal details" icon="person-outline" />
          <View style={styles.card}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <StudentAvatar name={form.studentName} />
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>
                  Student name<Text style={{ color: C.error }}> *</Text>
                </Text>
                <TextInput
                  style={styles.nameInput}
                  value={form.studentName}
                  onChangeText={(v) => set("studentName", v)}
                  placeholder="Full name"
                  placeholderTextColor={C.subtle}
                  autoCapitalize="words"
                />
              </View>
            </View>
            <PhoneField label="Student phone" required value={form.studentPhone} onChange={(v) => set("studentPhone", v)} />
            <TextField
              label="Student email"
              value={form.studentEmail}
              onChange={(v) => set("studentEmail", v)}
              placeholder="name@email.com"
              keyboardType="email-address"
              icon="mail-outline"
              autoCapitalize="none"
            />
            <View>
              <Text style={[styles.fieldLabel, { marginBottom: 8 }]}>Course</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {COURSE_OPTIONS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.courseChip, form.course === c && styles.courseChipActive]}
                    onPress={() => set("course", form.course === c ? "" : c)}
                  >
                    <Text style={[styles.courseChipText, form.course === c && styles.courseChipTextActive]}>
                      {c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </View>

        {/* ── Section 2: Parent / Guardian ──────────────────── */}
        <View style={styles.section}>
          <SectionHead num="2" title="Parent / Guardian" sub="Emergency contact & primary payer" icon="shield-outline" />
          <View style={styles.card}>
            <TextField
              label="Parent name"
              value={form.parentName}
              onChange={(v) => set("parentName", v)}
              placeholder="Parent or guardian's full name"
              icon="person-outline"
            />
            <PhoneField label="Parent phone" value={form.parentPhone} onChange={(v) => set("parentPhone", v)} />
            <TextField
              label="Parent email"
              value={form.parentEmail}
              onChange={(v) => set("parentEmail", v)}
              placeholder="parent@email.com"
              keyboardType="email-address"
              icon="mail-outline"
              autoCapitalize="none"
            />
          </View>
        </View>

        {/* ── Section 3: Room assignment ─────────────────────── */}
        <View style={styles.section}>
          <SectionHead num="3" title="Room assignment" sub="Pick from available rooms" icon="bed-outline" />
          <View style={[styles.card, { paddingHorizontal: 0 }]}>
            <View style={{ paddingHorizontal: 16 }}>
              <Text style={styles.fieldLabel}>
                Room no.<Text style={{ color: C.error }}> *</Text>
              </Text>
            </View>
            {rooms.length === 0 ? (
              <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
                <Text style={{ fontSize: 13, color: C.muted }}>No rooms added yet. Add rooms first.</Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8, gap: 8 }}
              >
                {rooms.map((r) => {
                  const active = form.roomId === r.id;
                  return (
                    <TouchableOpacity
                      key={r.id}
                      style={[styles.roomCard, active && styles.roomCardActive]}
                      onPress={() => set("roomId", active ? "" : r.id)}
                      activeOpacity={0.7}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={[styles.roomNumber, active && { color: C.white }]}>{r.roomNumber}</Text>
                        {active && (
                          <View style={styles.roomCheckBadge}>
                            <Ionicons name="checkmark" size={9} color={C.accentText} />
                          </View>
                        )}
                      </View>
                      <Text style={[styles.roomMeta, active && { color: "rgba(255,255,255,0.7)" }]}>
                        {r.floorLabel} · {r.type}
                      </Text>
                      <Text style={[styles.roomBeds, { color: active ? C.accent : C.positive }]}>
                        {r.capacity} bed{r.capacity !== 1 ? "s" : ""}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
            {form.roomId && (
              <View style={styles.roomAssignedBanner}>
                <View style={styles.roomAssignedDot} />
                <Text style={styles.roomAssignedText}>
                  Room <Text style={{ fontWeight: "800" }}>
                    {rooms.find((r) => r.id === form.roomId)?.roomNumber}
                  </Text> will be assigned on save
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Section 4: Charges ─────────────────────────────── */}
        <View style={styles.section}>
          <SectionHead num="4" title="Charges" sub="One-time and recurring amounts" icon="cash-outline" />
          <View style={styles.card}>
            <ChargeRow label="Rent (monthly)" value={form.rent} onChange={(v) => set("rent", v)} />
            <ChargeRow label="Advance" value={form.advance} onChange={(v) => set("advance", v)} />
            <ChargeRow label="Security deposit" value={form.security} onChange={(v) => set("security", v)} />
            <ChargeRow label="Booking amount" value={form.booking} onChange={(v) => set("booking", v)} />
            <ChargeRow label="Maintenance" value={form.maintenance} onChange={(v) => set("maintenance", v)} last={form.customCharges.length === 0} />
            {form.customCharges.map((c) => (
              <CustomChargeRow
                key={c.id}
                item={c}
                onLabel={(v) => updateCustomCharge(c.id, { label: v })}
                onAmount={(v) => updateCustomCharge(c.id, { amount: v })}
                onRemove={() => removeCustomCharge(c.id)}
              />
            ))}
            <TouchableOpacity style={styles.addCustomBtn} onPress={addCustomCharge}>
              <View style={styles.addCustomIcon}>
                <Ionicons name="add" size={13} color={C.accentText} />
              </View>
              <Text style={styles.addCustomText}>Add custom charge</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Section 5: Booking payment ─────────────────────── */}
        <View style={styles.section}>
          <SectionHead num="5" title="Booking payment" sub="Pick the charges being paid at booking" icon="key-outline" accent />
          <View style={styles.card}>
            {/* Booking checklist */}
            <View>
              {BOOKING_LINES.map((line, i) => (
                <BookingLine
                  key={line.key}
                  lineKey={line.key}
                  label={line.label}
                  amount={Number(charges[line.key]) || 0}
                  isOn={!!form.bookingItems[line.key]}
                  onToggle={() => toggleBookingItem(line.key)}
                  isFirst={i === 0}
                />
              ))}
              {form.customCharges.map((c) => (
                <BookingLine
                  key={c.id}
                  lineKey={`custom_${c.id}`}
                  label={c.label || "Custom charge"}
                  amount={Number(c.amount) || 0}
                  isOn={!!form.bookingItems[`custom_${c.id}`]}
                  onToggle={() => toggleBookingItem(`custom_${c.id}`)}
                  isCustom
                />
              ))}
            </View>

            <BookingTotalCard amount={total} count={selectedCount} moveIn={form.moveIn} />

            {/* Move-in amount */}
            <View style={{ gap: 6 }}>
              <Text style={styles.fieldLabel}>Move-in amount collected</Text>
              <View style={[styles.moneyInputWrap]}>
                <Text style={styles.moneyPrefix}>₹</Text>
                <TextInput
                  style={styles.moneyInput}
                  value={form.moveIn}
                  onChangeText={(t) => set("moveIn", t.replace(/[^\d]/g, ""))}
                  placeholder="0"
                  placeholderTextColor={C.subtle}
                  keyboardType="numeric"
                />
              </View>
              {total > 0 && (
                <Text style={{ fontSize: 10.5, color: C.subtle }}>
                  Out of {fmtINR(total)} booking total
                </Text>
              )}
            </View>

            {/* Autofill buttons */}
            {total > 0 && (
              <View style={{ flexDirection: "row", gap: 6 }}>
                <TouchableOpacity
                  style={styles.autofillBtn}
                  onPress={() => { set("moveIn", String(total)); set("paymentStatus", "paid"); }}
                >
                  <Text style={styles.autofillBtnText}>Mark full {fmtINRShort(total)} paid</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.autofillBtn, { backgroundColor: C.surfaceGray }]}
                  onPress={() => { set("moveIn", "0"); set("paymentStatus", "pending"); }}
                >
                  <Text style={[styles.autofillBtnText, { color: C.muted }]}>Clear</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Payment status */}
            <View style={{ gap: 8 }}>
              <Text style={styles.fieldLabel}>Payment status</Text>
              <PaymentStatusPicker value={form.paymentStatus} onChange={(v) => set("paymentStatus", v)} />
              <Text style={{ fontSize: 10.5, color: C.muted }}>
                {PAYMENT_STATUSES.find((s) => s.key === form.paymentStatus)?.hint}
              </Text>
            </View>
          </View>
        </View>

        {/* Watermark */}
        <View style={{ alignItems: "center", paddingVertical: 12, opacity: 0.4 }}>
          <Text style={{ fontSize: 10.5, fontWeight: "700", color: C.subtle, letterSpacing: 4 }}>LIVEET</Text>
        </View>
      </ScrollView>

      {/* Sticky CTA */}
      <View style={[styles.ctaBar, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.ctaTotalBox}>
          <Text style={styles.ctaTotalLabel}>Booking</Text>
          <Text style={styles.ctaTotalAmount}>{fmtINR(total)}</Text>
        </View>
        <TouchableOpacity
          style={[styles.saveBtn, !canSubmit && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!canSubmit || saving}
          activeOpacity={0.85}
        >
          <Text style={[styles.saveBtnText, !canSubmit && { color: C.muted }]}>
            {saving ? "Saving…" : "Save tenant"}
          </Text>
          <Ionicons name="checkmark" size={16} color={canSubmit ? C.accent : C.muted} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 18, paddingBottom: 12,
    backgroundColor: C.pageBg,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: C.white, borderWidth: 1, borderColor: C.border,
    alignItems: "center", justifyContent: "center",
  },
  topBarSub: { fontSize: 10.5, color: C.muted, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" },
  topBarTitle: { fontSize: 14.5, fontWeight: "800", color: C.navy, letterSpacing: -0.3 },
  cancelBtn: {
    height: 38, paddingHorizontal: 12, borderRadius: 12,
    borderWidth: 1, borderColor: C.border,
    alignItems: "center", justifyContent: "center",
  },
  cancelText: { fontSize: 12.5, fontWeight: "700", color: C.muted },

  progressRow: {
    flexDirection: "row", gap: 6, paddingHorizontal: 18, paddingBottom: 12,
  },
  progressDot: { flex: 1, height: 4, borderRadius: 999 },

  section: { marginHorizontal: 18, marginBottom: 16 },
  card: {
    backgroundColor: C.white, borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: C.border, gap: 12,
  },

  sectionHead: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  sectionIcon: { width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  sectionNum: { fontSize: 9.5, color: C.subtle, fontWeight: "800", letterSpacing: 1.2 },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: C.navy, letterSpacing: -0.3 },
  sectionSub: { fontSize: 11, color: C.muted, fontWeight: "500", marginTop: 1 },

  avatar: {
    width: 60, height: 60, borderRadius: 30,
    alignItems: "center", justifyContent: "center",
    borderColor: C.border, borderStyle: "dashed",
  },
  avatarText: { fontSize: 18, fontWeight: "800", letterSpacing: 0.5 },
  avatarBadge: {
    position: "absolute", right: -2, bottom: -2,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: C.white, borderWidth: 2, borderColor: C.pageBg,
    alignItems: "center", justifyContent: "center",
  },

  nameInput: {
    borderBottomWidth: 1.5, borderBottomColor: C.border,
    paddingVertical: 8, fontSize: 15.5, fontWeight: "700",
    color: C.navy,
  },

  fieldLabel: { fontSize: 12.5, fontWeight: "600", color: C.muted },
  inputWrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.inputBg, borderRadius: 14,
    padding: 14, height: 48, borderWidth: 1, borderColor: "transparent",
  },
  inputWrapFocused: { borderColor: C.navy },
  input: {
    flex: 1, fontSize: 14.5, fontWeight: "500", color: C.navy,
  },
  phonePrefixWrap: {
    height: "100%", paddingHorizontal: 14,
    alignItems: "center", justifyContent: "center",
    borderRightWidth: 1, borderRightColor: "rgba(0,0,0,0.06)",
  },
  phonePrefix: { fontSize: 14, fontWeight: "700", color: C.navy },

  courseChip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
    backgroundColor: C.white, borderWidth: 1, borderColor: C.border,
  },
  courseChipActive: { backgroundColor: C.navy, borderColor: C.navy },
  courseChipText: { fontSize: 12, fontWeight: "700", color: C.navy },
  courseChipTextActive: { color: C.white },

  roomCard: {
    padding: 12, borderRadius: 14, minWidth: 100,
    backgroundColor: C.white, borderWidth: 1.5, borderColor: C.border, gap: 4,
  },
  roomCardActive: { backgroundColor: C.navy, borderColor: C.navy },
  roomNumber: { fontSize: 16, fontWeight: "800", letterSpacing: -0.4, color: C.navy },
  roomMeta: { fontSize: 10.5, fontWeight: "600", color: C.muted },
  roomBeds: { fontSize: 10, fontWeight: "700", letterSpacing: 0.2 },
  roomCheckBadge: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: C.accent, alignItems: "center", justifyContent: "center",
  },
  roomAssignedBanner: {
    marginHorizontal: 16, marginBottom: 4,
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(212,245,66,0.18)", borderRadius: 10, padding: 8,
  },
  roomAssignedDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#84CC16" },
  roomAssignedText: { fontSize: 11.5, color: C.navy, fontWeight: "700" },

  chargeRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border, gap: 12,
  },
  chargeLabel: { fontSize: 13, fontWeight: "600", color: C.navy, flex: 1 },
  chargeInput: {
    flexDirection: "row", alignItems: "center",
    borderRadius: 10, padding: 4, paddingHorizontal: 10,
    width: 130, borderWidth: 1, borderColor: "transparent",
  },
  chargeInputFocused: { borderColor: C.navy, backgroundColor: "rgba(30,41,59,0.04)" },
  chargePrefix: { color: C.muted, fontSize: 13, fontWeight: "600", marginRight: 4 },
  chargeTextInput: {
    flex: 1, textAlign: "right", fontSize: 14, fontWeight: "700",
    color: C.navy,
  },

  customChargeRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingVertical: 11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border,
  },
  removeBtn: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: C.surfaceGray,
    alignItems: "center", justifyContent: "center",
  },
  customLabelInput: {
    flex: 1, fontSize: 13, fontWeight: "600", color: C.navy,
    borderRadius: 8, padding: 4, paddingHorizontal: 8,
  },

  addCustomBtn: {
    marginTop: 4, padding: 10, borderRadius: 12,
    borderWidth: 1.5, borderColor: C.border, borderStyle: "dashed",
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  addCustomIcon: {
    width: 22, height: 22, borderRadius: 7,
    backgroundColor: C.accent, alignItems: "center", justifyContent: "center",
  },
  addCustomText: { fontSize: 12.5, fontWeight: "800", color: C.navy },

  bookingLine: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 12,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 7,
    backgroundColor: C.white, borderWidth: 1.5, borderColor: C.border,
    alignItems: "center", justifyContent: "center",
  },
  checkboxOn: { backgroundColor: C.navy, borderColor: C.navy },
  bookingLineLabel: { fontSize: 13.5, fontWeight: "700", color: C.navy },
  bookingLineAmount: { fontSize: 14, fontWeight: "800", color: C.navy },
  customBadge: {
    paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999,
    backgroundColor: "rgba(212,245,66,0.3)",
  },
  customBadgeText: { fontSize: 9, fontWeight: "800", color: C.accentText, letterSpacing: 0.5 },

  totalCard: {
    backgroundColor: C.navy, borderRadius: 16, padding: 14,
    gap: 10, overflow: "hidden",
  },
  totalCardDecor: {
    position: "absolute", right: -40, top: -40,
    width: 130, height: 130, borderRadius: 65,
    backgroundColor: "rgba(212,245,66,0.08)",
  },
  totalCardLabel: { fontSize: 10.5, color: "rgba(255,255,255,0.6)", fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase" },
  totalCountBadge: {
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999,
    backgroundColor: "rgba(212,245,66,0.14)",
  },
  totalCountText: { fontSize: 9.5, color: C.accent, fontWeight: "800", letterSpacing: 0.5 },
  totalAmount: { fontSize: 28, fontWeight: "800", color: C.white, letterSpacing: -0.8 },
  totalCardFooter: {
    flexDirection: "row", justifyContent: "space-between",
    paddingTop: 10, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.12)",
    borderStyle: "dashed",
  },
  totalCardFooterLabel: { fontSize: 9.5, color: "rgba(255,255,255,0.55)", fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },
  totalCardCollected: { fontSize: 14, fontWeight: "700", color: C.accent, letterSpacing: -0.2, marginTop: 2 },
  totalCardBalance: { fontSize: 14, fontWeight: "700", letterSpacing: -0.2, marginTop: 2 },

  moneyInputWrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(212,245,66,0.18)", borderRadius: 12,
    height: 44, paddingHorizontal: 12,
    borderWidth: 1, borderColor: "rgba(212,245,66,0.6)",
  },
  moneyPrefix: { color: C.muted, fontSize: 14, fontWeight: "700", marginRight: 6 },
  moneyInput: { flex: 1, fontSize: 15, fontWeight: "700", color: C.navy },

  autofillBtn: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
    backgroundColor: C.surfaceGray,
  },
  autofillBtnText: { fontSize: 11, fontWeight: "700", color: C.navy },

  statusPill: {
    flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center",
    gap: 4, borderWidth: 1.5,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { fontSize: 12.5, fontWeight: "800", letterSpacing: -0.2 },

  ctaBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 18, paddingTop: 12,
    backgroundColor: "transparent",
  },
  ctaTotalBox: {
    flex: 1, padding: 8, paddingHorizontal: 12, borderRadius: 12,
    backgroundColor: C.white, borderWidth: 1, borderColor: C.border,
  },
  ctaTotalLabel: { fontSize: 9.5, color: C.muted, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" },
  ctaTotalAmount: { fontSize: 15, fontWeight: "800", color: C.navy, letterSpacing: -0.3 },
  saveBtn: {
    height: 52, borderRadius: 14, paddingHorizontal: 18,
    backgroundColor: C.navy,
    flexDirection: "row", alignItems: "center", gap: 8,
    shadowColor: "#000", shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2, shadowRadius: 12, elevation: 6,
  },
  saveBtnDisabled: { backgroundColor: C.inputBg, shadowOpacity: 0, elevation: 0 },
  saveBtnText: { fontSize: 14.5, fontWeight: "800", color: C.white, letterSpacing: 0.1 },
});
