import React, { memo, useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ScrollView,
  TextInput,
  Modal,
  Pressable,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useConvex } from "convex/react";
import { useRouter, useFocusEffect } from "expo-router";

// ─── Design tokens ────────────────────────────────────────────
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

const STATUS_MAP: Record<
  string,
  { label: string; fg: string; bg: string; dot: string }
> = {
  paid: { label: "Paid", fg: "#15803D", bg: "#DCFCE7", dot: "#16A34A" },
  partial: { label: "Partial", fg: "#92400E", bg: "#FEF3C7", dot: "#D97706" },
  pending: { label: "Pending", fg: "#1A1A1A", bg: "#E9F5BE", dot: "#84CC16" },
};

type PaymentHistoryEntry = {
  id: string;
  amount: number;
  status: "paid" | "partial" | "pending";
  note?: string;
  items?: string[];
  createdAt: number;
};

type Tenant = {
  _id: string;
  studentName: string;
  studentPhone: string;
  studentEmail?: string;
  course?: string;
  parentName?: string;
  parentPhone?: string;
  rent?: number;
  security?: number;
  advance?: number;
  booking?: number;
  maintenance?: number;
  customCharges?: { id: string; label: string; amount: number }[];
  moveInAmount?: number;
  paymentStatus: "paid" | "partial" | "pending";
  paymentHistory?: PaymentHistoryEntry[];
  createdAt: number;
  roomNumber?: string | null;
  roomType?: string | null;
  floorLabel?: string | null;
  propertyName: string;
};

function fmtINR(n?: number) {
  const v = Number(n) || 0;
  return "₹" + v.toLocaleString("en-IN");
}

function fmtINRShort(n?: number) {
  const v = Number(n) || 0;
  if (v >= 100000) return "₹" + (v / 100000).toFixed(v % 100000 === 0 ? 0 : 1) + "L";
  if (v >= 1000) return "₹" + (v / 1000).toFixed(v % 1000 === 0 ? 0 : 1) + "k";
  return "₹" + v;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("") || "?";
}

// ─── Avatar ───────────────────────────────────────────────────
function Avatar({ name, size = 40, accent = false }: { name: string; size?: number; accent?: boolean }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: accent ? C.navy : C.surfaceGray,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <Text
        style={{
          color: accent ? C.accent : C.navy,
          fontSize: size * 0.36,
          fontWeight: "800",
          letterSpacing: -0.2,
        }}
      >
        {getInitials(name)}
      </Text>
    </View>
  );
}

// ─── Status Pill ──────────────────────────────────────────────
function StatusPill({ status, small = false }: { status: string; small?: boolean }) {
  const s = STATUS_MAP[status];
  if (!s) return null;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: small ? 7 : 9,
        paddingVertical: small ? 2 : 4,
        borderRadius: 999,
        backgroundColor: s.bg,
      }}
    >
      <View style={{ width: 5, height: 5, borderRadius: 999, backgroundColor: s.dot }} />
      <Text
        style={{
          fontSize: small ? 10 : 11,
          fontWeight: "800",
          color: s.fg,
          letterSpacing: 0.2,
        }}
      >
        {s.label}
      </Text>
    </View>
  );
}

// ─── Stats Strip ──────────────────────────────────────────────
function StatsStrip({
  active,
  paid,
  partial,
  pending,
}: {
  active: number;
  paid: number;
  partial: number;
  pending: number;
}) {
  const stats = [
    { label: "Active", val: active, sub: "tenants", tint: C.navy },
    { label: "Paid", val: paid, sub: "tenants", tint: "#0F766E" },
    { label: "Partial", val: partial, sub: "tenants", tint: "#A16207" },
    { label: "Pending", val: pending, sub: "tenants", tint: "#991B1B" },
  ];
  return (
    <View style={s.statsRow}>
      {stats.map((st) => (
        <View key={st.label} style={s.statCard}>
          <View style={[s.statBar, { backgroundColor: st.tint }]} />
          <Text style={s.statLabel}>{st.label}</Text>
          <Text style={s.statVal}>{st.val}</Text>
          <Text style={s.statSub}>{st.sub}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Filter Chips ─────────────────────────────────────────────
function FilterChips({
  value,
  onChange,
  counts,
}: {
  value: string;
  onChange: (v: string) => void;
  counts: Record<string, number>;
}) {
  const tabs = [
    { key: "all", label: "All" },
    { key: "paid", label: "Paid" },
    { key: "partial", label: "Partial" },
    { key: "pending", label: "Pending" },
  ];
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.filterRow}
    >
      {tabs.map((tab) => {
        const active = value === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            onPress={() => onChange(tab.key)}
            style={[s.filterChip, active && s.filterChipActive]}
          >
            <Text style={[s.filterChipText, active && s.filterChipTextActive]}>
              {tab.label}
            </Text>
            <View
              style={[
                s.filterBadge,
                active && s.filterBadgeActive,
              ]}
            >
              <Text
                style={[
                  s.filterBadgeText,
                  active && s.filterBadgeTextActive,
                ]}
              >
                {counts[tab.key] ?? 0}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// ─── Tenant Card ──────────────────────────────────────────────
const TenantCard = memo(function TenantCard({
  tenant,
  onOpen,
}: {
  tenant: Tenant;
  onOpen: (t: Tenant) => void;
}) {
  const needsAttention = tenant.paymentStatus === "partial" || tenant.paymentStatus === "pending";
  return (
    <TouchableOpacity
      style={[s.card, needsAttention && s.cardAlert]}
      onPress={() => onOpen(tenant)}
      activeOpacity={0.75}
    >
      <Avatar name={tenant.studentName} size={44} accent={needsAttention} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={s.cardNameRow}>
          <Text style={s.cardName} numberOfLines={1}>
            {tenant.studentName}
          </Text>
          {tenant.roomNumber ? (
            <View style={s.roomBadge}>
              <Text style={s.roomBadgeText}>#{tenant.roomNumber}</Text>
            </View>
          ) : null}
        </View>
        <Text style={s.cardCourse} numberOfLines={1}>
          {tenant.course ?? "—"}
        </Text>
        <View style={s.cardFooter}>
          <StatusPill status={tenant.paymentStatus} small />
          <Text
            style={[
              s.cardBalance,
              needsAttention && { color: C.error },
            ]}
          >
            Rent {fmtINRShort(tenant.rent)}/mo
          </Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color={C.subtle} />
    </TouchableOpacity>
  );
});

// ─── Detail Sheet ─────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function QuickAction({
  icon,
  label,
  accent,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  accent?: boolean;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[s.quickAction, accent && s.quickActionAccent]}
      activeOpacity={0.75}
    >
      {icon}
      <Text style={[s.quickActionLabel, accent && { color: C.accentText }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function DetailSheet({
  tenant,
  onClose,
}: {
  tenant: Tenant;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"overview" | "payments">("overview");
  const router = useRouter();

  const handleCall = useCallback(() => {
    Linking.openURL(`tel:${tenant.studentPhone}`);
  }, [tenant.studentPhone]);

  const handleEmail = useCallback(() => {
    if (tenant.studentEmail) Linking.openURL(`mailto:${tenant.studentEmail}`);
  }, [tenant.studentEmail]);

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <View style={s.sheet}>
        <View style={s.sheetHandle} />
        <View style={[s.dragBar]}>
          <View style={s.dragPill} />
        </View>

        {/* Header */}
        <View style={s.sheetHeader}>
          <Avatar name={tenant.studentName} size={52} accent />
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={s.sheetNameRow}>
              <Text style={s.sheetName} numberOfLines={1}>
                {tenant.studentName}
              </Text>
              <StatusPill status={tenant.paymentStatus} small />
            </View>
            <Text style={s.sheetSub}>
              {[tenant.roomNumber ? `Room #${tenant.roomNumber}` : null, tenant.floorLabel, tenant.roomType]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          </View>
          <TouchableOpacity style={s.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={14} color={C.navy} />
          </TouchableOpacity>
        </View>

        {/* Quick actions */}
        <View style={s.quickActionsRow}>
          <QuickAction
            icon={<Ionicons name="call-outline" size={16} color={C.navy} />}
            label="Call"
            onPress={handleCall}
          />
          <QuickAction
            icon={<Ionicons name="mail-outline" size={16} color={C.navy} />}
            label="Email"
            onPress={handleEmail}
          />
          <QuickAction
            icon={<Ionicons name="chatbubble-outline" size={16} color={C.navy} />}
            label="Message"
          />
          <QuickAction
            icon={<Ionicons name="cash-outline" size={16} color={C.accentText} />}
            label="Collect"
            accent
            onPress={() => {
              router.push(`/(app)/record-payment?tenantId=${tenant._id}`);
              onClose();
            }}
          />
        </View>

        {/* Tabs */}
        <View style={s.tabBar}>
          {(["overview", "payments"] as const).map((k) => (
            <TouchableOpacity
              key={k}
              style={[s.tabBtn, tab === k && s.tabBtnActive]}
              onPress={() => setTab(k)}
            >
              <Text style={[s.tabBtnText, tab === k && s.tabBtnTextActive]}>
                {k === "overview" ? "Overview" : "Payments"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Body */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.sheetBody}>
          {tab === "overview" ? (
            <>
              {/* Balance card */}
              <View style={s.balanceCard}>
                <View>
                  <Text style={s.balanceCardLabel}>Security / Deposit</Text>
                  <Text style={s.balanceCardVal}>
                    {fmtINR(tenant.security)}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={s.balanceCardLabel}>Rent / mo</Text>
                  <Text style={[s.balanceCardVal, { color: C.white }]}>
                    {fmtINR(tenant.rent)}
                  </Text>
                </View>
              </View>

              {/* Contact */}
              <View style={s.section}>
                <View style={s.sectionHeader}>
                  <View style={s.sectionIcon}>
                    <Ionicons name="person-outline" size={14} color={C.navy} />
                  </View>
                  <Text style={s.sectionTitle}>Contact</Text>
                </View>
                <InfoRow label="Phone" value={`+91 ${tenant.studentPhone}`} />
                {tenant.studentEmail ? (
                  <InfoRow label="Email" value={tenant.studentEmail} />
                ) : null}
                {tenant.course ? (
                  <InfoRow label="Course" value={tenant.course} />
                ) : null}
              </View>

              {/* Parent */}
              {tenant.parentName ? (
                <View style={s.section}>
                  <View style={s.sectionHeader}>
                    <View style={s.sectionIcon}>
                      <Ionicons name="shield-outline" size={14} color={C.navy} />
                    </View>
                    <Text style={s.sectionTitle}>Guardian</Text>
                  </View>
                  <InfoRow label="Name" value={tenant.parentName} />
                  {tenant.parentPhone ? (
                    <InfoRow label="Phone" value={`+91 ${tenant.parentPhone}`} />
                  ) : null}
                </View>
              ) : null}

              {/* Move-in */}
              <View style={s.section}>
                <View style={s.sectionHeader}>
                  <View style={s.sectionIcon}>
                    <Ionicons name="document-text-outline" size={14} color={C.navy} />
                  </View>
                  <Text style={s.sectionTitle}>Move-in</Text>
                </View>
                <InfoRow
                  label="Move-in date"
                  value={new Date(tenant.createdAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                />
                {tenant.moveInAmount ? (
                  <InfoRow label="Move-in amount" value={fmtINR(tenant.moveInAmount)} />
                ) : null}
                {tenant.advance ? (
                  <InfoRow label="Advance" value={fmtINR(tenant.advance)} />
                ) : null}
              </View>
            </>
          ) : (
            <>
              {/* Payment summary */}
              {(() => {
                const totalCharges =
                  (tenant.advance ?? 0) +
                  (tenant.security ?? 0) +
                  (tenant.booking ?? 0) +
                  (tenant.maintenance ?? 0) +
                  (tenant.customCharges ?? []).reduce((sum, c) => sum + c.amount, 0);
                const collected = (tenant.paymentHistory ?? []).reduce((sum, e) => sum + e.amount, 0);
                const balance = Math.max(0, totalCharges - collected);
                return (
                  <>
                    <View style={s.payRow}>
                      <View style={[s.payCard, { flex: 1 }]}>
                        <Text style={s.payCardLabel}>Total charges</Text>
                        <Text style={s.payCardVal}>{fmtINR(totalCharges)}</Text>
                      </View>
                      <View style={[s.payCard, { flex: 1 }]}>
                        <Text style={s.payCardLabel}>Collected</Text>
                        <Text style={[s.payCardVal, { color: C.positive }]}>{fmtINR(collected)}</Text>
                      </View>
                    </View>
                    {totalCharges > 0 && (
                      <View style={[s.payCard, { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}>
                        <Text style={s.payCardLabel}>Balance due</Text>
                        <Text style={[s.payCardVal, { color: balance > 0 ? C.error : C.positive, fontSize: 16 }]}>
                          {balance > 0 ? fmtINR(balance) : "Fully paid"}
                        </Text>
                      </View>
                    )}
                  </>
                );
              })()}

              <TouchableOpacity
                style={s.recordBtn}
                onPress={() => {
                  router.push(`/(app)/record-payment?tenantId=${tenant._id}`);
                  onClose();
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={14} color={C.accentText} />
                <Text style={s.recordBtnText}>Record a payment</Text>
              </TouchableOpacity>

              <View style={s.section}>
                <View style={s.sectionHeader}>
                  <Text style={s.sectionTitle}>History</Text>
                </View>
                {(tenant.paymentHistory && tenant.paymentHistory.length > 0) ? (
                  [...tenant.paymentHistory].reverse().map((entry) => {
                    const dotColor = entry.status === "paid" ? C.positive : entry.status === "partial" ? "#D97706" : "#DC2626";
                    return (
                      <View key={entry.id} style={s.historyRow}>
                        <View style={[s.historyDot, { backgroundColor: dotColor }]} />
                        <View style={{ flex: 1 }}>
                          <View style={s.historyMeta}>
                            <Text style={s.historyMonth}>{entry.note ?? "Payment"}</Text>
                            <Text style={[s.historyAmt, { color: dotColor }]}>
                              {fmtINR(entry.amount)}
                            </Text>
                          </View>
                          {entry.items && entry.items.length > 0 && (
                            <Text style={[s.historySub, { marginBottom: 2 }]} numberOfLines={2}>
                              {entry.items.join(", ")}
                            </Text>
                          )}
                          <Text style={s.historySub}>
                            {new Date(entry.createdAt).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </Text>
                        </View>
                        <StatusPill status={entry.status} small />
                      </View>
                    );
                  })
                ) : (
                  <View style={s.historyRow}>
                    <View style={[s.historyDot, { backgroundColor: C.subtle }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.historyMonth}>No payment records yet</Text>
                      <Text style={s.historySub}>Record a payment to see history</Text>
                    </View>
                  </View>
                )}
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Empty State ──────────────────────────────────────────────
function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <View style={s.emptyWrap}>
      <View style={s.emptyIcon}>
        <Ionicons name="people-outline" size={24} color={C.navy} />
      </View>
      <Text style={s.emptyTitle}>No tenants yet</Text>
      <Text style={s.emptyDesc}>
        Add your first tenant to start tracking rent, deposits, and move-in dates.
      </Text>
      <TouchableOpacity style={s.emptyBtn} onPress={onAdd} activeOpacity={0.8}>
        <Ionicons name="add" size={12} color={C.accent} />
        <Text style={s.emptyBtnText}>Add tenant</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────
export default function ManageScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const convex = useConvex();
  const [tenants, setTenants] = useState<Tenant[]>([]);

  useFocusEffect(
    useCallback(() => {
      (convex as any).query("tenants:getTenants", {}).then(setTenants).catch(() => {});
    }, [convex])
  );

  const [filter, setFilter] = useState("all");
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);

  const counts = useMemo(
    () => ({
      all: tenants.length,
      paid: tenants.filter((t) => t.paymentStatus === "paid").length,
      partial: tenants.filter((t) => t.paymentStatus === "partial").length,
      pending: tenants.filter((t) => t.paymentStatus === "pending").length,
    }),
    [tenants]
  );

  const filtered = useMemo(() => {
    let xs = tenants as Tenant[];
    if (filter !== "all") xs = xs.filter((t) => t.paymentStatus === filter);
    if (search) {
      const q = search.toLowerCase();
      xs = xs.filter(
        (t) =>
          t.studentName.toLowerCase().includes(q) ||
          (t.roomNumber ?? "").toLowerCase().includes(q) ||
          (t.course ?? "").toLowerCase().includes(q)
      );
    }
    return xs;
  }, [tenants, filter, search]);

  const propertyName = tenants[0]?.propertyName ?? "Your Property";

  const handleOpen = useCallback((t: Tenant) => setSelectedTenant(t), []);

  const renderItem = useCallback(
    ({ item }: { item: Tenant }) => (
      <TenantCard tenant={item} onOpen={handleOpen} />
    ),
    [handleOpen]
  );

  const keyExtractor = useCallback((item: Tenant) => item._id, []);

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Top Bar */}
      <View style={s.topBar}>
        <View>
          <Text style={s.propertyName}>{propertyName}</Text>
          <Text style={s.pageTitle}>Tenants</Text>
        </View>
        <View style={s.topActions}>
          <TouchableOpacity
            style={[s.iconBtn, searchOpen && s.iconBtnActive]}
            onPress={() => setSearchOpen((x) => !x)}
          >
            <Ionicons
              name="search"
              size={16}
              color={searchOpen ? C.accent : C.navy}
            />
          </TouchableOpacity>
          <TouchableOpacity style={s.iconBtn}>
            <Ionicons name="options-outline" size={16} color={C.navy} />
          </TouchableOpacity>
        </View>
      </View>

      {searchOpen && (
        <View style={s.searchBar}>
          <Ionicons name="search" size={15} color={C.muted} />
          <TextInput
            style={s.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search name, room, course"
            placeholderTextColor={C.muted}
            autoFocus
          />
        </View>
      )}

      {/* Stats */}
      <StatsStrip
        active={counts.all}
        paid={counts.paid}
        partial={counts.partial}
        pending={counts.pending}
      />

      {/* Filters */}
      {tenants.length > 0 && (
        <View style={{ marginBottom: 10 }}>
          <FilterChips value={filter} onChange={setFilter} counts={counts} />
        </View>
      )}

      {/* List */}
      {tenants.length === 0 ? (
        <EmptyState onAdd={() => router.push("/(app)/add-tenant")} />
      ) : (
        <>
          <View style={s.listMeta}>
            <Text style={s.listMetaLabel}>
              {filter === "all" ? "All tenants" : filter.toUpperCase()}
            </Text>
            <Text style={s.listMetaCount}>
              {filtered.length} of {tenants.length}
            </Text>
          </View>
          <FlatList
            data={filtered}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            contentContainerStyle={s.listContent}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews
            maxToRenderPerBatch={10}
            windowSize={5}
            ListEmptyComponent={
              <View style={s.noMatch}>
                <Text style={s.noMatchTitle}>No matching tenants</Text>
                <Text style={s.noMatchSub}>Try a different filter or clear search.</Text>
              </View>
            }
          />

          {/* FAB */}
          <TouchableOpacity
            style={s.fab}
            onPress={() => router.push("/(app)/add-tenant")}
            activeOpacity={0.85}
          >
            <View style={s.fabIcon}>
              <Ionicons name="add" size={12} color={C.accent} />
            </View>
            <Text style={s.fabText}>Add tenant</Text>
          </TouchableOpacity>
        </>
      )}

      {/* Detail Sheet */}
      {selectedTenant && (
        <DetailSheet
          tenant={selectedTenant}
          onClose={() => setSelectedTenant(null)}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.pageBg },

  // Top bar
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  propertyName: {
    fontSize: 10.5,
    color: C.muted,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: C.navy,
    letterSpacing: -0.6,
    marginTop: 2,
  },
  topActions: { flexDirection: "row", gap: 8 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnActive: { backgroundColor: C.navy, borderColor: C.navy },

  // Search
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: "500",
    color: C.navy,
    height: "100%",
  },

  // Stats
  statsRow: {
    flexDirection: "row",
    gap: 6,
    marginHorizontal: 20,
    marginBottom: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: C.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 10,
    paddingBottom: 12,
    overflow: "hidden",
  },
  statBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  statLabel: {
    fontSize: 9.5,
    color: C.muted,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginTop: 4,
  },
  statVal: {
    fontSize: 20,
    fontWeight: "800",
    color: C.navy,
    letterSpacing: -0.5,
    lineHeight: 24,
  },
  statSub: { fontSize: 10, color: C.subtle, fontWeight: "600" },

  // Filters
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 0,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    height: 36,
    borderRadius: 999,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
  },
  filterChipActive: { backgroundColor: C.navy, borderColor: C.navy },
  filterChipText: { fontSize: 12.5, fontWeight: "700", color: C.navy, letterSpacing: -0.1 },
  filterChipTextActive: { color: C.white },
  filterBadge: {
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 999,
    backgroundColor: C.surfaceGray,
  },
  filterBadgeActive: { backgroundColor: "rgba(212,245,66,0.2)" },
  filterBadgeText: { fontSize: 10.5, fontWeight: "800", color: C.muted },
  filterBadgeTextActive: { color: C.accent },

  // List
  listMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 20,
    marginBottom: 4,
  },
  listMetaLabel: {
    fontSize: 11,
    color: C.muted,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  listMetaCount: {
    fontSize: 11,
    color: C.subtle,
    fontWeight: "700",
  },
  listContent: { paddingHorizontal: 20, paddingBottom: 120 },

  // Tenant card
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    backgroundColor: C.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  cardAlert: { borderColor: "#FECACA" },
  cardNameRow: { flexDirection: "row", alignItems: "baseline", gap: 8, marginBottom: 2 },
  cardName: {
    fontSize: 14.5,
    fontWeight: "800",
    color: C.navy,
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  roomBadge: {
    backgroundColor: C.surfaceGray,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    flexShrink: 0,
  },
  roomBadgeText: { fontSize: 10.5, color: C.muted, fontWeight: "700" },
  cardCourse: {
    fontSize: 11.5,
    color: C.muted,
    fontWeight: "500",
    marginBottom: 6,
  },
  cardFooter: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardBalance: { fontSize: 11, color: C.muted, fontWeight: "700" },

  // FAB
  fab: {
    position: "absolute",
    right: 18,
    bottom: 88,
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: C.accent,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    shadowColor: "#D4F542",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  fabIcon: {
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: C.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  fabText: { fontSize: 13.5, fontWeight: "800", color: C.accentText, letterSpacing: -0.1 },

  // Empty
  emptyWrap: {
    margin: 20,
    padding: 40,
    backgroundColor: C.white,
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: C.border,
    alignItems: "center",
    gap: 10,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: C.surfaceGray,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontSize: 15.5, fontWeight: "800", color: C.navy, letterSpacing: -0.3 },
  emptyDesc: {
    fontSize: 12.5,
    color: C.muted,
    lineHeight: 18,
    textAlign: "center",
    maxWidth: 240,
  },
  emptyBtn: {
    marginTop: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: C.navy,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  emptyBtnText: { fontSize: 13, fontWeight: "800", color: C.white },

  // No match
  noMatch: {
    padding: 28,
    alignItems: "center",
    backgroundColor: C.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  noMatchTitle: { fontSize: 13, fontWeight: "700", color: C.navy },
  noMatchSub: { fontSize: 11.5, color: C.muted, marginTop: 4 },

  // Sheet
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.5)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "88%",
    backgroundColor: C.pageBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
  },
  sheetHandle: { alignItems: "center", paddingTop: 8 },
  dragBar: { alignItems: "center", paddingTop: 8, paddingBottom: 0 },
  dragPill: { width: 40, height: 4, borderRadius: 999, backgroundColor: C.border },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  sheetNameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
  sheetName: {
    fontSize: 17,
    fontWeight: "800",
    color: C.navy,
    letterSpacing: -0.4,
    flexShrink: 1,
  },
  sheetSub: { fontSize: 11.5, color: C.muted, fontWeight: "600" },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: C.surfaceGray,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  // Quick actions
  quickActionsRow: {
    flexDirection: "row",
    gap: 6,
    padding: 12,
    paddingHorizontal: 18,
  },
  quickAction: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 14,
    backgroundColor: C.surfaceGray,
    alignItems: "center",
    gap: 4,
  },
  quickActionAccent: { backgroundColor: C.accent },
  quickActionLabel: {
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 0.1,
    color: C.navy,
  },

  // Tabs
  tabBar: {
    flexDirection: "row",
    gap: 2,
    marginHorizontal: 18,
    marginTop: 4,
    padding: 3,
    backgroundColor: C.inputBg,
    borderRadius: 11,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 9,
    alignItems: "center",
  },
  tabBtnActive: {
    backgroundColor: C.white,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  tabBtnText: { fontSize: 12.5, fontWeight: "800", letterSpacing: -0.1, color: C.muted },
  tabBtnTextActive: { color: C.navy },

  // Sheet body
  sheetBody: { padding: 14, paddingHorizontal: 18, paddingBottom: 24, gap: 12 },

  // Balance card
  balanceCard: {
    backgroundColor: C.navy,
    borderRadius: 16,
    padding: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  balanceCardLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.6)",
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  balanceCardVal: {
    fontSize: 22,
    fontWeight: "800",
    marginTop: 4,
    letterSpacing: -0.5,
    color: C.accent,
  },

  // Section
  section: {
    backgroundColor: C.white,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: C.border,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  sectionIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: C.surfaceGray,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 12.5,
    fontWeight: "800",
    color: C.navy,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 10,
  },
  infoLabel: { fontSize: 11.5, color: C.muted, fontWeight: "600", letterSpacing: 0.2 },
  infoValue: {
    fontSize: 13,
    fontWeight: "700",
    color: C.navy,
    letterSpacing: -0.1,
    maxWidth: 200,
    textAlign: "right",
  },

  // Payment tab
  payRow: { flexDirection: "row", gap: 8 },
  payCard: {
    backgroundColor: C.white,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  payCardLabel: {
    fontSize: 10,
    color: C.muted,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  payCardVal: {
    fontSize: 18,
    fontWeight: "800",
    color: C.navy,
    letterSpacing: -0.3,
    marginTop: 4,
  },
  recordBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: C.accent,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  recordBtnText: { fontSize: 13.5, fontWeight: "800", color: C.accentText, letterSpacing: -0.1 },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  historyDot: { width: 10, height: 10, borderRadius: 999 },
  historyMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 },
  historyMonth: { fontSize: 13.5, fontWeight: "800", color: C.navy, letterSpacing: -0.2 },
  historyAmt: { fontSize: 14, fontWeight: "800", letterSpacing: -0.2 },
  historySub: { fontSize: 10.5, color: C.muted, fontWeight: "600" },
});
