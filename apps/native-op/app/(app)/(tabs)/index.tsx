import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useConvex } from "convex/react";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePropertyRole } from "../../../context/PropertyRoleContext";

// ─── Design tokens ──────────────────────────────────────────
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
  slate: "#94A3B8",
};

// ─── Helpers ─────────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function getInitials(name?: string | null) {
  if (!name) return "OP";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ─── Avatar ───────────────────────────────────────────────────
function Avatar({ initials, size = 36 }: { initials: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: C.navy,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: C.white, fontSize: size * 0.36, fontWeight: "700" }}>
        {initials}
      </Text>
    </View>
  );
}

// ─── Bell icon ────────────────────────────────────────────────
function Bell({ hasBadge }: { hasBadge: boolean }) {
  return (
    <View style={styles.bellWrap}>
      <Ionicons name="notifications-outline" size={18} color={C.navy} />
      {hasBadge && <View style={styles.bellBadge} />}
    </View>
  );
}

// ─── Hero card ────────────────────────────────────────────────
type Scope = "today" | "thisMonth" | "thisYear";

const SCOPES: { key: Scope; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "thisMonth", label: "Month" },
  { key: "thisYear", label: "Year" },
];

function HeroCard() {
  const [scope, setScope] = React.useState<Scope>("thisMonth");
  return (
    <View style={styles.heroCard}>
      {/* Decor circle */}
      <View style={styles.heroDecor} />

      {/* Scope tabs */}
      <View style={styles.heroTopRow}>
        <Text style={styles.heroScopeLabel}>
          {scope === "today" ? "Today" : scope === "thisMonth" ? "This Month" : "This Year"}
        </Text>
        <View style={styles.scopeTabs}>
          {SCOPES.map((s) => (
            <TouchableOpacity
              key={s.key}
              onPress={() => setScope(s.key)}
              style={[styles.scopeTab, scope === s.key && styles.scopeTabActive]}
            >
              <Text
                style={[
                  styles.scopeTabText,
                  scope === s.key && styles.scopeTabTextActive,
                ]}
              >
                {s.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Amount */}
      <View style={styles.heroAmountRow}>
        <Text style={styles.heroAmount}>₹0.00</Text>
      </View>

      {/* Stats grid */}
      <View style={styles.heroStats}>
        {(
          [
            ["Occupants", "0", null],
            ["Vacant", "0", null],
            ["Pending", "₹0", null],
            ["Received", "₹0", null],
          ] as [string, string, string | null][]
        ).map(([label, val, sub], i) => (
          <View key={label} style={[styles.heroStat, i > 0 && styles.heroStatBorder]}>
            <Text style={styles.heroStatLabel}>{label}</Text>
            <Text style={styles.heroStatValue}>{val}</Text>
            {sub && <Text style={styles.heroStatSub}>{sub}</Text>}
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Quick actions ────────────────────────────────────────────
const QUICK_ACTIONS_PRIMARY = [
  { icon: "add-circle-outline" as const, label: "Add tenant" },
  { icon: "bed-outline" as const, label: "Rooms" },
  { icon: "cash-outline" as const, label: "Collect" },
  { icon: "list-outline" as const, label: "List property" },
];

const QUICK_ACTIONS_SECONDARY = [
  { icon: "document-text-outline" as const, label: "Agreement" },
  { icon: "call-outline" as const, label: "Team" },
  { icon: "call-outline" as const, label: "Remind" },
];

function QuickActions() {
  const [expanded, setExpanded] = React.useState(false);
  const router = useRouter();

  const ACTION_ROUTES: Record<string, string> = {
    "List property": "/(app)/list-property",
    "Rooms": "/(app)/rooms",
    "Team": "/(app)/team",
  };

  return (
    <View style={styles.card}>
      <View style={styles.quickActionsRow}>
        {QUICK_ACTIONS_PRIMARY.map((a) => (
          <TouchableOpacity
            key={a.label}
            style={styles.quickAction}
            onPress={() => {
              const route = ACTION_ROUTES[a.label];
              if (route) router.push(route as any);
            }}
            activeOpacity={0.7}
          >
            <View style={styles.quickActionIcon}>
              <Ionicons name={a.icon} size={20} color={C.navy} />
            </View>
            <Text style={styles.quickActionLabel}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {expanded && (
        <View style={[styles.quickActionsRow, styles.quickActionsSecondaryRow]}>
          {QUICK_ACTIONS_SECONDARY.map((a) => (
            <TouchableOpacity
              key={a.label}
              style={styles.quickAction}
              onPress={() => {
                const route = ACTION_ROUTES[a.label];
                if (route) router.push(route as any);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.quickActionIcon}>
                <Ionicons name={a.icon} size={20} color={C.navy} />
              </View>
              <Text style={styles.quickActionLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <TouchableOpacity style={styles.quickActionsToggle} onPress={() => setExpanded((v) => !v)}>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={14}
          color={C.muted}
        />
        <Text style={styles.quickActionsToggleText}>{expanded ? "Less" : "More"}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Collection card ──────────────────────────────────────────
function CollectionCard() {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Collection</Text>
      <Text style={styles.emptyText}>No data yet.</Text>
    </View>
  );
}

// ─── Transactions card ────────────────────────────────────────
function TransactionsCard() {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Recent Transactions</Text>
      <Text style={styles.emptyText}>No transactions yet.</Text>
    </View>
  );
}

// ─── Move-ins card ────────────────────────────────────────────
function MoveInsCard() {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Upcoming Move-Ins</Text>
      <Text style={styles.emptyText}>No upcoming move-ins yet.</Text>
    </View>
  );
}

// ─── Tasks / Overdue hidden until backend data wired ──────────

// ─── Property switcher ────────────────────────────────────────
function PropertySwitcher({
  property,
  populated,
}: {
  property: { name: string; address: string; units: number; occupied: number } | null;
  populated: boolean;
}) {
  return (
    <View style={styles.propertySwitcher}>
      <View style={styles.propertyIconWrap}>
        <Ionicons name="home-outline" size={18} color={C.navy} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.propertyName} numberOfLines={1}>
          {populated && property ? property.name : "Add your first property"}
        </Text>
        <Text style={styles.propertyMeta} numberOfLines={1}>
          {populated && property
            ? `${property.occupied}/${property.units} occupied · ${property.address}`
            : "Takes about 4 minutes"}
        </Text>
      </View>
      {populated ? (
        <Ionicons name="chevron-down" size={16} color={C.muted} />
      ) : (
        <View style={styles.setupChip}>
          <Text style={styles.setupChipText}>Set up</Text>
        </View>
      )}
    </View>
  );
}

// ─── Brand watermark ──────────────────────────────────────────
function BrandWatermark() {
  return (
    <View style={styles.watermark}>
      <View style={styles.watermarkRow}>
        <View style={styles.watermarkLine} />
        <Text style={styles.watermarkBrand}>LIVEET</Text>
        <View style={styles.watermarkLine} />
      </View>
      <Text style={styles.watermarkTagline}>manage your property operations with ease</Text>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────
export default function DashboardScreen() {
  const convex = useConvex();
  const { setActivePropertyId } = usePropertyRole();
  const [user, setUser] = React.useState<{ name?: string | null } | null>(null);
  const [property, setProperty] = React.useState<{
    _id: string;
    name: string;
    city?: string | null;
    state?: string | null;
    addressLine1?: string | null;
    totalUnits?: string | null;
  } | null | undefined>(undefined);

  const fetchData = React.useCallback(() => {
    (convex as any).query("users:getCurrentUser", {}).then(setUser).catch(() => {});
    (convex as any)
      .query("users:getMyProperty", {})
      .then((p: any) => {
        setProperty(p);
        if (p?._id) setActivePropertyId(p._id);
      })
      .catch(() => setProperty(null));
  }, [convex, setActivePropertyId]);

  // Re-fetch every time screen comes into focus (handles post-onboarding nav)
  useFocusEffect(fetchData);

  const insets = useSafeAreaInsets();
  const populated = !!property;
  const displayName = user?.name?.split(" ")[0] ?? "Operator";
  const initials = getInitials(user?.name);

  const propertyDisplay = property
    ? {
        name: property.name,
        address: [property.city, property.state].filter(Boolean).join(", ") || property.addressLine1 || "",
        units: parseInt(property.totalUnits ?? "0", 10) || 0,
        occupied: parseInt(property.totalUnits ?? "0", 10) || 0, // no tenant data yet
      }
    : null;

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar */}
        <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
          <View>
            <Text style={styles.greetingLabel}>{getGreeting()}</Text>
            <Text style={styles.greetingName}>{displayName}</Text>
          </View>
          <View style={styles.topBarRight}>
            <Bell hasBadge={populated} />
            <Avatar initials={initials} size={36} />
          </View>
        </View>

        {/* Property switcher */}
        <PropertySwitcher property={propertyDisplay} populated={populated} />

        {/* Hero */}
        <HeroCard />

        {/* Quick actions — only when populated */}
        {populated && <QuickActions />}

        {/* Collection */}
        <CollectionCard />

        {/* Transactions */}
        <TransactionsCard />

        {/* Move-ins */}
        <MoveInsCard />

        {/* Watermark */}
        <BrandWatermark />
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.pageBg },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 24 },

  // Top bar
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  greetingLabel: { fontSize: 12.5, color: C.muted, fontWeight: "500" },
  greetingName: { fontSize: 22, fontWeight: "700", color: C.navy, letterSpacing: -0.6 },
  topBarRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  bellWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.white, borderWidth: 1, borderColor: C.border,
    alignItems: "center", justifyContent: "center",
  },
  bellBadge: {
    position: "absolute", top: 7, right: 8,
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: C.accent, borderWidth: 1.5, borderColor: C.white,
  },

  // Property switcher
  propertySwitcher: {
    marginHorizontal: 20, marginBottom: 14,
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.border,
    padding: 10,
  },
  propertyIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: C.surfaceGray, alignItems: "center", justifyContent: "center",
  },
  propertyName: { fontSize: 13.5, fontWeight: "700", color: C.navy, letterSpacing: -0.2 },
  propertyMeta: { fontSize: 11.5, color: C.muted, marginTop: 1 },
  setupChip: {
    backgroundColor: C.accent, paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 999,
  },
  setupChipText: { fontSize: 11, fontWeight: "700", color: C.accentText, letterSpacing: 0.3 },

  // Hero card
  heroCard: {
    marginHorizontal: 20, marginBottom: 14,
    backgroundColor: C.navy, borderRadius: 22, padding: 18,
    overflow: "hidden",
  },
  heroDecor: {
    position: "absolute", top: -40, right: -40,
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: "rgba(212,245,66,0.06)",
  },
  heroTopRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: 8,
  },
  heroScopeLabel: { fontSize: 13, color: "rgba(255,255,255,0.65)", fontWeight: "500" },
  scopeTabs: {
    flexDirection: "row", backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 9, padding: 3, gap: 2,
  },
  scopeTab: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 6 },
  scopeTabActive: { backgroundColor: C.white },
  scopeTabText: { fontSize: 11, fontWeight: "700", color: "rgba(255,255,255,0.65)" },
  scopeTabTextActive: { color: C.navy },
  heroAmountRow: {
    flexDirection: "row", alignItems: "flex-end",
    justifyContent: "space-between", gap: 12, marginBottom: 16,
  },
  heroAmount: { fontSize: 32, fontWeight: "700", color: C.white, letterSpacing: -1, lineHeight: 36 },
  trendChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    marginTop: 6, alignSelf: "flex-start",
    backgroundColor: "rgba(212,245,66,0.18)",
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
  },
  trendText: { fontSize: 11.5, fontWeight: "700", color: C.accent },
  heroStats: {
    flexDirection: "row", borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)", paddingTop: 14,
  },
  heroStat: { flex: 1 },
  heroStatBorder: { borderLeftWidth: 1, borderLeftColor: "rgba(255,255,255,0.08)", paddingLeft: 10 },
  heroStatLabel: { fontSize: 10.5, color: "rgba(255,255,255,0.55)", fontWeight: "600", letterSpacing: 0.4, textTransform: "uppercase" },
  heroStatValue: { fontSize: 16, fontWeight: "700", color: C.white, marginTop: 4, letterSpacing: -0.3 },
  heroStatSub: { fontSize: 10, color: "rgba(255,255,255,0.45)", marginTop: 1 },

  // Cards
  card: {
    marginHorizontal: 20, marginBottom: 14,
    backgroundColor: C.white, borderRadius: 18,
    padding: 16, gap: 12,
  },
  cardSubtitle: { fontSize: 12, color: C.muted, marginTop: 2 },
  emptyText: { fontSize: 13, color: C.muted, marginTop: -4 },
  sectionHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: C.navy, letterSpacing: -0.4 },
  badge: {
    backgroundColor: C.navy, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999,
  },
  badgeText: { fontSize: 11, fontWeight: "700", color: C.white },
  pctBadge: {
    backgroundColor: C.surfaceGray, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
  },
  pctBadgeText: { fontSize: 11, fontWeight: "700", color: C.navy, letterSpacing: 0.3 },

  // Quick actions
  quickActionsRow: { flexDirection: "row", gap: 2 },
  quickActionsSecondaryRow: { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10, marginTop: -2 },
  quickAction: { flex: 1, alignItems: "center", gap: 6, paddingVertical: 4 },
  quickActionIcon: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: C.surfaceGray, alignItems: "center", justifyContent: "center",
  },
  quickActionLabel: { fontSize: 11.5, fontWeight: "600", color: C.navy },
  quickActionsToggle: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 4, paddingTop: 6, borderTopWidth: 1, borderTopColor: C.border, marginTop: 4,
  },
  quickActionsToggleText: { fontSize: 11.5, fontWeight: "600", color: C.muted },

  // Collection
  collectionAmtRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 10 },
  collectionAmt: { fontSize: 22, fontWeight: "700", color: C.navy, letterSpacing: -0.6 },
  collectionSub: { fontSize: 11.5, color: C.muted, marginTop: 2 },
  progressBar: { flexDirection: "row", gap: 3, height: 8, borderRadius: 999, overflow: "hidden", backgroundColor: C.inputBg },
  progressSegment: { borderRadius: 999 },
  legendRow: { flexDirection: "row", justifyContent: "space-between" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendLabel: { fontSize: 11.5, color: C.muted, fontWeight: "500" },
  legendValue: { fontSize: 11.5, fontWeight: "700" },

  // Transactions
  txRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  txRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  txIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  txTopRow: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  txBotRow: { flexDirection: "row", justifyContent: "space-between", gap: 10, marginTop: 2 },
  txName: { fontSize: 14, fontWeight: "700", color: C.navy, letterSpacing: -0.2, flex: 1 },
  txAmt: { fontSize: 14, fontWeight: "700", color: C.positive, letterSpacing: -0.2 },
  txSub: { fontSize: 11.5, color: C.muted, flex: 1 },
  txWhen: { fontSize: 11, color: C.muted, fontWeight: "500" },

  // Move-ins
  moveInRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: C.surfaceGray, borderRadius: 14, padding: 10,
  },
  calTile: {
    width: 44, backgroundColor: C.white, borderRadius: 10,
    paddingVertical: 6, alignItems: "center",
    borderWidth: 1, borderColor: C.border,
  },
  calMon: { fontSize: 9.5, color: C.muted, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },
  calDay: { fontSize: 15, fontWeight: "800", color: C.navy, letterSpacing: -0.4 },
  moveInName: { fontSize: 13.5, fontWeight: "700", color: C.navy, letterSpacing: -0.2 },
  moveInSub: { fontSize: 11.5, color: C.muted, marginTop: 1 },
  daysChip: { backgroundColor: C.navy, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999 },
  daysChipText: { fontSize: 10.5, fontWeight: "700", color: C.white },

  // Tasks
  taskRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  taskIcon: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: C.surfaceGray, alignItems: "center", justifyContent: "center",
  },
  taskTitle: { fontSize: 13.5, fontWeight: "700", color: C.navy, letterSpacing: -0.2 },
  taskSub: { fontSize: 11.5, color: C.muted, marginTop: 1 },
  priChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  priChipText: { fontSize: 10.5, fontWeight: "700", letterSpacing: 0.3 },

  // Overdue
  overdueCard: {
    marginHorizontal: 20, marginBottom: 14,
    backgroundColor: "#FFF7F5", borderWidth: 1, borderColor: "#FECACA",
    borderRadius: 18, padding: 14, gap: 10,
  },
  overdueHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  overdueIconWrap: {
    width: 26, height: 26, borderRadius: 8,
    backgroundColor: C.error, alignItems: "center", justifyContent: "center",
  },
  overdueTitle: { fontSize: 14, fontWeight: "700", color: C.navy, letterSpacing: -0.2 },
  reminderBtn: {
    backgroundColor: C.navy, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999,
  },
  reminderBtnText: { fontSize: 11.5, fontWeight: "700", color: C.white },
  overdueRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: C.white, borderRadius: 10, padding: 10,
  },
  overdueAvatar: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: C.surfaceGray, alignItems: "center", justifyContent: "center",
  },
  overdueAvatarText: { fontSize: 9, fontWeight: "700", color: C.navy },
  overdueRowName: { fontSize: 12.5, fontWeight: "700", color: C.navy },
  overdueRowSub: { fontSize: 11, color: C.muted },
  overdueAmt: { fontSize: 13, fontWeight: "700", color: C.error },

  // Watermark
  watermark: { alignItems: "center", gap: 6, paddingVertical: 18, opacity: 0.55 },
  watermarkRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  watermarkLine: { width: 30, height: 1, backgroundColor: C.subtle },
  watermarkBrand: { fontSize: 15, fontWeight: "700", color: C.subtle, letterSpacing: 6 },
  watermarkTagline: { fontSize: 11, color: C.subtle, fontStyle: "italic", letterSpacing: 0.5 },
});
