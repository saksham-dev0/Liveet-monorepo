import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  TouchableOpacity,
  FlatList,
  Alert,
} from "react-native";
import { BottomSheet } from "../../components/BottomSheet";
import { Image } from "expo-image";
import { ScrollView as NativeScrollView } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { useSafeAreaInsets, EdgeInsets } from "react-native-safe-area-context";
import { useConvex } from "convex/react";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  withSpring,
  withTiming,
  withRepeat,
  runOnJS,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, radii, cardShadow } from "../../constants/theme";
import LiveetTenantHero from "../../assets/images/Liveet-tenant.png";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;
const CARD_WIDTH = SCREEN_WIDTH - 40;
const TAB_BAR_CLEARANCE = 80;
const CARD_SIDE_INSET = (SCREEN_WIDTH - CARD_WIDTH) / 2;

const CATEGORY_LABELS: Record<string, string> = {
  single: "Single",
  double: "Double",
  triple: "Triple",
  "3plus": "3+ Bed",
};

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

type RoomOption = {
  _id: string;
  category: string;
  numberOfRooms?: number;
  typeName?: string;
  rentAmount?: number;
  attachedWashroom?: boolean;
  attachedBalcony?: boolean;
  airConditioner?: boolean;
  geyser?: boolean;
  customFeatures?: string[];
};

type Property = {
  _id: string;
  name?: string;
  coverImageUrl?: string | null;
  pincode?: string;
  city?: string;
  state?: string;
  line1?: string;
  roomOptions: RoomOption[];
  tenantDetails: {
    canStayMale?: boolean;
    canStayFemale?: boolean;
    canStayOthers?: boolean;
    bestForStudent?: boolean;
    bestForWorkingProfessional?: boolean;
  } | null;
  agreement: {
    securityDepositDuration?: string;
    agreementDuration?: string;
    lockInPeriod?: string;
    noticePeriod?: string;
  } | null;
  rent: {
    monthlyRentalCycle?: string;
    gracePeriodDays?: number;
    hasLateFee?: boolean;
    lateFeeAmount?: number;
  } | null;
};

function formatAmount(n: number): string {
  // Display thousands in a compact way (e.g. 35000 -> "35K").
  if (n >= 1000) {
    const k = n / 1000;
    const wholeK = Math.round(k);
    if (Math.abs(k - wholeK) < 1e-9) return `${wholeK}K`;

    const oneDecimalK = Math.round(k * 10) / 10;
    const formatted = oneDecimalK.toFixed(1).replace(/\.0$/, "");
    return `${formatted}K`;
  }
  return n.toLocaleString("en-IN");
}

function getRentRange(opts: RoomOption[]) {
  const amounts = opts
    .map((r) => r.rentAmount)
    .filter((a): a is number => a != null && a > 0);
  if (!amounts.length) return null;
  return { min: Math.min(...amounts), max: Math.max(...amounts) };
}

function getAmenities(opts: RoomOption[]): string[] {
  const set = new Set<string>();
  for (const r of opts) {
    if (r.airConditioner) set.add("AC");
    if (r.geyser) set.add("Geyser");
    if (r.attachedWashroom) set.add("Washroom");
    if (r.attachedBalcony) set.add("Balcony");
    r.customFeatures?.forEach((f) => set.add(f));
  }
  return [...set].slice(0, 6);
}

/** Gender mix shown as top hero badge (not repeated in chips). */
function getOccupancyBadge(d: Property["tenantDetails"]): {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
} | null {
  if (!d) return null;
  const m = !!d.canStayMale;
  const f = !!d.canStayFemale;
  const o = !!d.canStayOthers;
  const n = [m, f, o].filter(Boolean).length;
  if (n === 0) return null;
  if (f && !m && !o) return { label: "Females only", icon: "woman-outline" };
  if (m && !f && !o) return { label: "Males only", icon: "man-outline" };
  return { label: "Coliving", icon: "people-outline" };
}

function getBestSuited(d: Property["tenantDetails"]): string[] {
  if (!d) return [];
  const t: string[] = [];
  if (d.bestForStudent) t.push("Students");
  if (d.bestForWorkingProfessional) t.push("Professionals");
  return t;
}

// --------------- Tenant Dashboard ---------------

const QUICK_ACTIONS = [
  {
    key: "complaint",
    icon: "alert-circle-outline" as const,
    title: "Add Complaint",
    sub: "Report an issue",
    accent: "#EF4444",
  },
  {
    key: "shift",
    icon: "swap-horizontal-outline" as const,
    title: "Shift Request",
    sub: "Change your room",
    accent: "#3B82F6",
  },
  {
    key: "moveout",
    icon: "exit-outline" as const,
    title: "Move Out",
    sub: "End your stay",
    accent: "#F59E0B",
  },
  {
    key: "extend",
    icon: "document-text-outline" as const,
    title: "Extend Stay",
    sub: "Renew agreement",
    accent: "#10B981",
  },
];

const OVERVIEW_ROWS = [
  { icon: "home-outline" as const, label: "Room", value: "Room 203" },
  {
    icon: "calendar-outline" as const,
    label: "Agreement",
    value: "12 months · Ends Dec 2026",
  },
  { icon: "lock-closed-outline" as const, label: "Lock-in", value: "6 months" },
  {
    icon: "time-outline" as const,
    label: "Notice",
    value: "30 days notice required",
  },
];

const NOTICES = [
  {
    icon: "megaphone-outline" as const,
    title: "Maintenance scheduled",
    sub: "Water supply off on Apr 3, 10am–1pm",
  },
  {
    icon: "information-circle-outline" as const,
    title: "Society meeting",
    sub: "April 5 at 7pm in the common hall",
  },
];

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  refId: string | null;
  createdAt: number;
};

function TenantDashboard({ insets }: { insets: EdgeInsets }) {
  const router = useRouter();
  const convex = useConvex();
  const MOCK_RENT = { amount: 8500, dueDate: "April 1, 2026", daysLeft: 3 };
  const MOCK_PROPERTY = { name: "Sunrise Apartments", city: "Bengaluru" };

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [confirmedComplaintIds, setConfirmedComplaintIds] = useState<Set<string>>(new Set());

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await (convex as any).query("complaints:getTenantNotifications", {});
      if (res) {
        setNotifications(res.items ?? []);
        setUnreadCount(res.unreadCount ?? 0);
      }
    } catch {}
  }, [convex]);

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  async function handleOpenNotifications() {
    setShowNotifications(true);
    try {
      await (convex as any).mutation("complaints:markAllNotificationsRead", {});
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {}
  }

  async function handleConfirmResolved(complaintId: string) {
    try {
      await (convex as any).mutation("complaints:confirmComplaintResolved", {
        complaintId,
      });
      setConfirmedComplaintIds((prev) => new Set([...prev, complaintId]));
      await fetchNotifications();
    } catch (e) {
      Alert.alert("Error", "Could not confirm resolution. Please try again.");
    }
  }

  function handleQuickAction(key: string) {
    if (key === "complaint") {
      router.push("/(app)/complaint" as any);
    }
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Notifications panel */}
      <BottomSheet
        visible={showNotifications}
        onClose={() => setShowNotifications(false)}
        title="Notifications"
        showCloseButton
        maxHeight="75%"
      >
        {notifications.length === 0 ? (
          <View style={s.notifEmpty}>
            <Ionicons name="notifications-off-outline" size={36} color={colors.muted} />
            <Text style={s.notifEmptyText}>No notifications yet</Text>
          </View>
        ) : (
          <FlatList
            data={notifications}
            keyExtractor={(item) => item.id}
            ItemSeparatorComponent={() => <View style={s.notifDivider} />}
            renderItem={({ item }) => (
              <View style={[s.notifItem, !item.read && s.notifItemUnread]}>
                <View style={s.notifIconWrap}>
                  <Ionicons
                    name={item.type === "complaint_resolved" ? "checkmark-circle" : "notifications"}
                    size={20}
                    color={item.type === "complaint_resolved" ? "#16A34A" : colors.primary}
                  />
                </View>
                <View style={s.notifTextWrap}>
                  <Text style={s.notifItemTitle}>{item.title}</Text>
                  <Text style={s.notifItemBody}>{item.body}</Text>
                  <Text style={s.notifItemTime}>
                    {new Date(item.createdAt).toLocaleDateString("en-IN", {
                      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                    })}
                  </Text>
                  {item.type === "complaint_resolved" && item.refId && !confirmedComplaintIds.has(item.refId) ? (
                    <TouchableOpacity
                      style={s.confirmBtn}
                      activeOpacity={0.7}
                      onPress={() => void handleConfirmResolved(item.refId!)}
                    >
                      <Text style={s.confirmBtnText}>Yes, issue is fixed</Text>
                    </TouchableOpacity>
                  ) : item.type === "complaint_resolved" && item.refId ? (
                    <View style={[s.confirmBtn, { backgroundColor: "#6B7280" }]}>
                      <Text style={s.confirmBtnText}>Confirmed ✓</Text>
                    </View>
                  ) : null}
                </View>
                {!item.read && <View style={s.notifDot} />}
              </View>
            )}
          />
        )}
      </BottomSheet>

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.filterBtn} activeOpacity={0.7}>
          <Ionicons name="home-outline" size={20} color={colors.navy} />
        </TouchableOpacity>
        <View style={s.hCenter}>
          <Text style={s.hTitle}>My Home</Text>
          <Text style={s.hSub}>
            {MOCK_PROPERTY.name} · {MOCK_PROPERTY.city}
          </Text>
        </View>
        <TouchableOpacity
          style={s.filterBtn}
          activeOpacity={0.7}
          onPress={() => void handleOpenNotifications()}
        >
          <Ionicons name="notifications-outline" size={20} color={colors.navy} />
          {unreadCount > 0 && (
            <View style={s.notifBadge}>
              <Text style={s.notifBadgeText}>
                {unreadCount > 9 ? "9+" : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <NativeScrollView
        contentContainerStyle={[
          s.dbScrollContent,
          { paddingBottom: insets.bottom + 90 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Rent Card */}
        <View style={s.dbHeroCard}>
          <Text style={s.dbHeroLabel}>NEXT RENT DUE</Text>
          <Text style={s.dbHeroDate}>{MOCK_RENT.dueDate}</Text>
          <Text style={s.dbHeroAmount}>
            ₹{MOCK_RENT.amount.toLocaleString("en-IN")} / month
          </Text>
          <View style={s.dbHeroFooter}>
            <View style={s.dbDueChip}>
              <Ionicons name="time-outline" size={13} color={colors.white} />
              <Text style={s.dbDueChipText}>
                Due in {MOCK_RENT.daysLeft} days
              </Text>
            </View>
            <TouchableOpacity style={s.dbPayBtn} activeOpacity={0.8}>
              <Text style={s.dbPayBtnText}>Pay Now</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Actions */}
        <Text style={s.dbSectionTitle}>Quick Actions</Text>
        <View style={s.dbActionsCard}>
          {QUICK_ACTIONS.map((action, idx) => (
            <React.Fragment key={action.key}>
              <TouchableOpacity
                style={s.dbActionRow}
                activeOpacity={0.6}
                onPress={() => handleQuickAction(action.key)}
              >
                <View
                  style={[
                    s.dbActionIconCircle,
                    { backgroundColor: action.accent + "18" },
                  ]}
                >
                  <Ionicons name={action.icon} size={20} color={action.accent} />
                </View>
                <View style={s.dbActionTextWrap}>
                  <Text style={s.dbActionTitle}>{action.title}</Text>
                  <Text style={s.dbActionSub}>{action.sub}</Text>
                </View>
                <View style={[s.dbActionChevronWrap, { backgroundColor: action.accent + "12" }]}>
                  <Ionicons name="chevron-forward" size={14} color={action.accent} />
                </View>
              </TouchableOpacity>
              {idx < QUICK_ACTIONS.length - 1 && (
                <View style={s.dbDivider} />
              )}
            </React.Fragment>
          ))}
        </View>

        {/* Property Overview */}
        <Text style={s.dbSectionTitle}>Property Overview</Text>
        <View style={s.dbOverviewCard}>
          {OVERVIEW_ROWS.map((row, idx) => (
            <React.Fragment key={row.label}>
              <View style={s.dbOverviewRow}>
                <View style={s.dbOverviewIconWrap}>
                  <Ionicons name={row.icon} size={18} color={colors.muted} />
                </View>
                <View style={s.dbOverviewText}>
                  <Text style={s.dbOverviewLabel}>{row.label}</Text>
                  <Text style={s.dbOverviewValue}>{row.value}</Text>
                </View>
              </View>
              {idx < OVERVIEW_ROWS.length - 1 && (
                <View style={s.dbDivider} />
              )}
            </React.Fragment>
          ))}
        </View>

        {/* Notices */}
        <Text style={s.dbSectionTitle}>Notices</Text>
        <View style={s.dbNoticeCard}>
          {NOTICES.map((notice, idx) => (
            <React.Fragment key={notice.title}>
              <View style={s.dbNoticeRow}>
                <Ionicons
                  name={notice.icon}
                  size={18}
                  color={colors.muted}
                  style={{ marginTop: 2 }}
                />
                <View style={s.dbNoticeTextWrap}>
                  <Text style={s.dbNoticeTitle}>{notice.title}</Text>
                  <Text style={s.dbNoticeSub}>{notice.sub}</Text>
                </View>
              </View>
              {idx < NOTICES.length - 1 && <View style={s.dbDivider} />}
            </React.Fragment>
          ))}
        </View>
      </NativeScrollView>
    </View>
  );
}

// --------------- Property Card ---------------

function PropertyCard({ property }: { property: Property }) {
  const rentRange = getRentRange(property.roomOptions);
  const amenities = getAmenities(property.roomOptions);
  const occupancyBadge = getOccupancyBadge(property.tenantDetails);
  const bestSuited = getBestSuited(property.tenantDetails);
  const rooms = property.roomOptions.slice(0, 4);
  const agreement = property.agreement;

  const [cardHeight, setCardHeight] = useState(0);
  // Match the original layout where the hero area used ~34% of the card height.
  const heroHeight = cardHeight > 0 ? cardHeight * 0.34 : 220;

  const scrollY = useSharedValue(0);
  const heroHeightSv = useSharedValue(heroHeight);

  useEffect(() => {
    heroHeightSv.value = heroHeight;
  }, [heroHeight, heroHeightSv]);

  useEffect(() => {
    // Reset when the displayed property changes.
    scrollY.value = 0;
  }, [property._id, scrollY]);

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const heroAnimStyle = useAnimatedStyle(() => {
    const clamped = Math.max(0, Math.min(scrollY.value, heroHeightSv.value));
    return { transform: [{ translateY: -clamped }] };
  });

  const priceLine =
    rentRange != null
      ? `\u20B9${formatAmount(rentRange.min)}${
          rentRange.max !== rentRange.min
            ? ` \u2013 \u20B9${formatAmount(rentRange.max)}`
            : ""
        }/mo`
      : null;

  const locationLine =
    [property.city, property.state].filter(Boolean).join(", ") ||
    "Location not set";

  return (
    <View
      style={c.wrapper}
      onLayout={(e) => {
        const h = e.nativeEvent.layout.height;
        if (h > 0 && (cardHeight === 0 || Math.abs(h - cardHeight) > 1)) {
          setCardHeight(h);
        }
      }}
    >
      <Animated.View
        style={[c.hero, { height: heroHeight }, heroAnimStyle]}
        pointerEvents="none"
      >
        <Image
          source={
            property.coverImageUrl
              ? { uri: property.coverImageUrl }
              : LiveetTenantHero
          }
          style={c.heroBackground}
          contentFit="contain"
          transition={200}
        />
      </Animated.View>

      <Animated.View
        style={c.scrollHintAbs}
        pointerEvents="none"
        accessibilityElementsHidden
      >
        <ScrollHint />
      </Animated.View>

      <AnimatedScrollView
        style={c.bodyScroll}
        contentContainerStyle={{
          ...c.bodyScrollContent,
          // Push content below the hero; hero itself scrolls away via translation.
          paddingTop: heroHeight + 18,
        }}
        showsVerticalScrollIndicator={true}
        bounces
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        <View style={c.summary}>
          <View style={c.summaryHeaderRow}>
            <Text style={c.summaryName} numberOfLines={1}>
              {property.name || "Unnamed Property"}
            </Text>
            {priceLine ? (
              <Text style={c.summaryPrice} numberOfLines={1}>
                {priceLine}
              </Text>
            ) : null}
          </View>
          <View style={c.summaryLocRow}>
            <Ionicons name="location-sharp" size={16} color={colors.muted} />
            <Text style={c.summaryLocText} numberOfLines={2}>
              {locationLine}
            </Text>
          </View>
          {occupancyBadge ? (
            <View style={c.summaryBadge}>
              <Ionicons
                name={occupancyBadge.icon}
                size={14}
                color={colors.primary}
              />
              <Text style={c.summaryBadgeText}>{occupancyBadge.label}</Text>
            </View>
          ) : null}
        </View>

        {rooms.length > 0 && (
          <View style={c.section}>
            <Text style={c.secTitle}>Room Types</Text>
            <View style={c.roomRow}>
              {rooms.map((r) => (
                <View key={r._id} style={c.roomChip}>
                  <Text style={c.roomCat}>
                    {(r.typeName && r.typeName.trim()) ||
                      CATEGORY_LABELS[r.category] ||
                      r.category}
                  </Text>
                  {r.rentAmount != null && (
                    <Text style={c.roomRent}>
                      {"\u20B9"}
                      {formatAmount(r.rentAmount)}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {bestSuited.length > 0 && (
          <View style={c.section}>
            <Text style={c.secTitle}>Best suited for</Text>
            <View style={c.chipRow}>
              {bestSuited.map((t) => (
                <View key={t} style={c.tagChip}>
                  <Text style={c.tagText}>{t}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {amenities.length > 0 && (
          <View style={c.section}>
            <Text style={c.secTitle}>Amenities</Text>
            <View style={c.chipRow}>
              {amenities.map((a) => (
                <View key={a} style={c.amenChip}>
                  <Text style={c.amenText}>{a}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {agreement && (
          <View style={c.section}>
            <Text style={c.secTitle}>Agreement</Text>
            <Text style={c.agreeText}>
              {[
                agreement.agreementDuration &&
                  `${agreement.agreementDuration} agreement`,
                agreement.lockInPeriod &&
                  `${agreement.lockInPeriod} lock-in`,
                agreement.securityDepositDuration &&
                  `${agreement.securityDepositDuration} deposit`,
              ]
                .filter(Boolean)
                .join("  \u00B7  ")}
            </Text>
          </View>
        )}
      </AnimatedScrollView>
    </View>
  );
}

function ScrollHint() {
  const opacity = useSharedValue(0.9);
  const translateY = useSharedValue(0);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.35, { duration: 900 }), -1, true);
    translateY.value = withRepeat(withTiming(6, { duration: 900 }), -1, true);
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[c.scrollHint, animStyle]}>
      <Ionicons name="chevron-down" size={18} color={colors.muted} />
    </Animated.View>
  );
}

const c = StyleSheet.create({
  wrapper: { flex: 1, position: "relative" },
  hero: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    overflow: "hidden",
    backgroundColor: colors.surfaceGray,
    zIndex: 0,
  },
  heroBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  body: {
    flex: 66,
    minHeight: 0,
    position: "relative",
  },
  bodyScroll: {
    flex: 1,
    position: "relative",
    zIndex: 1,
  },
  bodyScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 48,
  },
  summary: {
    marginBottom: 20,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  summaryHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
  },
  summaryName: {
    flex: 1,
    fontSize: 19,
    fontWeight: "800",
    color: colors.navy,
    letterSpacing: -0.2,
  },
  summaryPrice: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.positiveAmount,
    marginTop: 4,
  },
  summaryLocRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginBottom: 12,
  },
  summaryLocText: {
    flex: 1,
    fontSize: 14,
    color: colors.muted,
    lineHeight: 20,
  },
  summaryBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceGray,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.navy,
    letterSpacing: 0.15,
  },
  scrollHintAbs: {
    position: "absolute",
    bottom: 22,
    right: 16,
    left: undefined,
    alignItems: "flex-end",
    zIndex: 2,
  },
  scrollHint: {
    alignItems: "center",
  },
  scrollHintHandle: {
    width: 44,
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.surfaceGray,
    borderWidth: 1,
    borderColor: colors.border,
  },
  section: { marginBottom: 16 },
  secTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  roomRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  roomChip: {
    backgroundColor: colors.surfaceGray,
    borderRadius: radii.input,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: "center",
  },
  roomCat: { fontSize: 13, fontWeight: "600", color: colors.navy },
  roomRent: {
    fontSize: 11,
    fontWeight: "500",
    color: colors.positiveAmount,
    marginTop: 2,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tagChip: {
    backgroundColor: colors.primary,
    borderRadius: radii.chip,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  tagText: { fontSize: 12, fontWeight: "600", color: colors.white },
  amenChip: {
    backgroundColor: colors.surfaceGray,
    borderRadius: radii.chip,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.border,
  },
  amenText: { fontSize: 12, fontWeight: "500", color: colors.navy },
  agreeText: {
    fontSize: 13,
    color: colors.muted,
    lineHeight: 20,
  },
});

// --------------- Main Screen ---------------

export default function AppHome() {
  const convex = useConvex();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [properties, setProperties] = useState<Property[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showDashboard, setShowDashboard] = useState(false);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 5000);

    (async () => {
      try {
        const gate = await (convex as any).query("moveIn:hasPaidMoveInForTenant", {});
        if (!cancelled && gate?.shouldShowDashboard) {
          setShowDashboard(true);
          setLoading(false);
          clearTimeout(timeout);
          return;
        }
        const result = await (convex as any).query(
          "properties:listForTenants",
          {},
        );
        if (!cancelled && result) setProperties(result);
      } catch (err) {
        console.warn("Failed to fetch properties:", err);
      } finally {
        clearTimeout(timeout);
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [convex]);

  const currentProperty = properties[currentIndex] ?? null;
  const nextProperty = properties[currentIndex + 1] ?? null;

  const recordSwipe = useCallback(
    async (propertyId: string, liked: boolean) => {
      try {
        await (convex as any).mutation("properties:recordSwipe", {
          propertyId,
          liked,
        });
      } catch (err) {
        console.warn("Failed to record swipe:", err);
      }
    },
    [convex],
  );

  const advanceCard = useCallback(
    (liked: boolean) => {
      const prop = properties[currentIndex];
      if (prop) void recordSwipe(prop._id, liked);
      translateX.value = 0;
      translateY.value = 0;
      setCurrentIndex((i) => i + 1);
    },
    [currentIndex, properties, recordSwipe, translateX, translateY],
  );

  const onSwipeRight = useCallback(() => advanceCard(true), [advanceCard]);
  const onSwipeLeft = useCallback(() => advanceCard(false), [advanceCard]);

  const gesture = Gesture.Pan()
    .activeOffsetX([-18, 18])
    .failOffsetY([-12, 12])
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY * 0.35;
    })
    .onEnd(() => {
      if (translateX.value > SWIPE_THRESHOLD) {
        translateX.value = withTiming(
          SCREEN_WIDTH * 1.5,
          { duration: 350 },
          () => runOnJS(onSwipeRight)(),
        );
      } else if (translateX.value < -SWIPE_THRESHOLD) {
        translateX.value = withTiming(
          -SCREEN_WIDTH * 1.5,
          { duration: 350 },
          () => runOnJS(onSwipeLeft)(),
        );
      } else {
        translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
        translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
      }
    });

  const topCardStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateX.value,
      [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
      [-12, 0, 12],
      Extrapolation.CLAMP,
    );
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotate}deg` },
      ],
    };
  });

  const likeOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, SWIPE_THRESHOLD],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  const nopeOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [-SWIPE_THRESHOLD, 0],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  const bgCardStyle = useAnimatedStyle(() => {
    const absX = Math.abs(translateX.value);
    const scale = interpolate(
      absX,
      [0, SWIPE_THRESHOLD],
      [0.92, 1],
      Extrapolation.CLAMP,
    );
    const opacity = interpolate(
      absX,
      [0, SWIPE_THRESHOLD],
      [0.5, 1],
      Extrapolation.CLAMP,
    );
    return { transform: [{ scale }], opacity };
  });

  const handleLikePress = () => {
    if (!currentProperty) return;
    translateX.value = withTiming(
      SCREEN_WIDTH * 1.5,
      { duration: 400 },
      () => runOnJS(onSwipeRight)(),
    );
  };

  const handleUnlikePress = () => {
    if (!currentProperty) return;
    translateX.value = withTiming(
      -SCREEN_WIDTH * 1.5,
      { duration: 400 },
      () => runOnJS(onSwipeLeft)(),
    );
  };

  const noMore = !currentProperty;

  if (loading) {
    return (
      <View style={[s.root, { paddingTop: insets.top }]}>
        <View style={s.loadWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={s.loadText}>Finding properties...</Text>
        </View>
      </View>
    );
  }

  if (showDashboard) {
    return <TenantDashboard insets={insets} />;
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          style={s.filterBtn}
          onPress={() => router.push("/(app)/favorites")}
          activeOpacity={0.7}
        >
          <Ionicons name="heart-outline" size={20} color={colors.navy} />
        </TouchableOpacity>
        <View style={s.hCenter}>
          <Text style={s.hTitle}>Discover</Text>
          <Text style={s.hSub}>Properties near you</Text>
        </View>
        <TouchableOpacity style={s.filterBtn}>
          <Ionicons name="options-outline" size={20} color={colors.navy} />
        </TouchableOpacity>
      </View>

      {/* Card stack */}
      <View style={s.cardArea}>
        {noMore ? (
          <View style={s.empty}>
            <View style={s.emptyCircle}>
              <Ionicons name="home-outline" size={48} color={colors.muted} />
            </View>
            <Text style={s.emptyTitle}>No more properties</Text>
            <Text style={s.emptySub}>
              Check back later for new listings
            </Text>
          </View>
        ) : (
          <>
            {nextProperty && (
              <Animated.View style={[s.card, bgCardStyle]}>
                <PropertyCard property={nextProperty} />
              </Animated.View>
            )}

            <GestureDetector gesture={gesture}>
              <Animated.View style={[s.card, topCardStyle]}>
                <Animated.View
                  style={[s.stamp, s.likeStamp, likeOpacity]}
                >
                  <Text style={s.likeStampTxt}>LIKE</Text>
                </Animated.View>
                <Animated.View
                  style={[s.stamp, s.nopeStamp, nopeOpacity]}
                >
                  <Text style={s.nopeStampTxt}>NOPE</Text>
                </Animated.View>
                <PropertyCard property={currentProperty} />
              </Animated.View>
            </GestureDetector>
          </>
        )}
      </View>

      {/* Action buttons */}
      {!noMore && (
        <View
          style={[s.actions, { paddingBottom: insets.bottom + TAB_BAR_CLEARANCE }]}
        >
          <TouchableOpacity
            style={[s.actionBtn, s.unlikeBtn]}
            onPress={handleUnlikePress}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={30} color={colors.navy} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.actionBtn, s.starBtn]}
            activeOpacity={0.7}
          >
            <Ionicons name="star" size={20} color={colors.trendBadgeText} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.actionBtn, s.likeBtn]}
            onPress={handleLikePress}
            activeOpacity={0.7}
          >
            <Ionicons name="heart" size={30} color={colors.white} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg },
  loadWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadText: { fontSize: 14, color: colors.muted },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  hSide: { width: 40 },
  hCenter: { flex: 1, alignItems: "center" },
  hTitle: { fontSize: 22, fontWeight: "800", color: colors.navy },
  hSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  filterBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.cardBg,
    alignItems: "center",
    justifyContent: "center",
    ...cardShadow,
  },

  cardArea: {
    flex: 1,
    marginHorizontal: CARD_SIDE_INSET,
    minHeight: 300,
  },
  card: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radii.card,
    backgroundColor: colors.cardBg,
    overflow: "hidden",
    ...cardShadow,
  },

  stamp: {
    position: "absolute",
    top: 24,
    zIndex: 10,
    borderWidth: 3,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  likeStamp: {
    left: 20,
    borderColor: colors.positiveAmount,
    transform: [{ rotate: "-15deg" }],
  },
  likeStampTxt: {
    fontSize: 32,
    fontWeight: "900",
    color: colors.positiveAmount,
    letterSpacing: 3,
  },
  nopeStamp: {
    right: 20,
    borderColor: colors.error,
    transform: [{ rotate: "15deg" }],
  },
  nopeStampTxt: {
    fontSize: 32,
    fontWeight: "900",
    color: colors.error,
    letterSpacing: 3,
  },

  actions: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 24,
    paddingTop: 16,
  },
  actionBtn: {
    alignItems: "center",
    justifyContent: "center",
    ...cardShadow,
  },
  unlikeBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.cardBg,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  starBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.trendBadge,
  },
  likeBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.error,
  },

  empty: { alignItems: "center", padding: 40 },
  emptyCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.surfaceGray,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: { fontSize: 22, fontWeight: "700", color: colors.navy },
  emptySub: {
    fontSize: 14,
    color: colors.muted,
    marginTop: 8,
    textAlign: "center",
  },
  // --- Dashboard styles ---
  dbScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  dbHeroCard: {
    backgroundColor: colors.primary,
    borderRadius: radii.card,
    paddingVertical: 24,
    paddingHorizontal: 20,
    marginBottom: 24,
    ...cardShadow,
  },
  dbHeroLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.55)",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  dbHeroDate: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.white,
    marginBottom: 4,
  },
  dbHeroAmount: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.trendBadge,
    marginBottom: 18,
  },
  dbHeroFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dbDueChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  dbDueChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.white,
  },
  dbPayBtn: {
    backgroundColor: colors.trendBadge,
    borderRadius: radii.pill,
    paddingHorizontal: 22,
    paddingVertical: 10,
  },
  dbPayBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.navy,
  },
  dbSectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 12,
  },
  dbActionsCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.card,
    paddingHorizontal: 18,
    paddingVertical: 4,
    marginBottom: 24,
    ...cardShadow,
  },
  dbActionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
  },
  dbActionIconCircle: {
    width: 42,
    height: 42,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  dbActionTextWrap: {
    flex: 1,
  },
  dbActionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.navy,
    marginBottom: 2,
  },
  dbActionSub: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: "500",
  },
  dbActionChevronWrap: {
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  dbOverviewCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.card,
    paddingHorizontal: 18,
    paddingVertical: 8,
    marginBottom: 24,
    ...cardShadow,
  },
  dbOverviewRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
  },
  dbOverviewIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surfaceGray,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  dbOverviewText: {
    flex: 1,
  },
  dbOverviewLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.muted,
    marginBottom: 2,
  },
  dbOverviewValue: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.navy,
  },
  dbDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
  dbNoticeCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.card,
    paddingHorizontal: 18,
    paddingVertical: 8,
    marginBottom: 16,
    ...cardShadow,
  },
  dbNoticeRow: {
    flexDirection: "row",
    paddingVertical: 14,
  },
  dbNoticeTextWrap: {
    flex: 1,
    marginLeft: 12,
  },
  dbNoticeTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.navy,
    marginBottom: 2,
  },
  dbNoticeSub: {
    fontSize: 12,
    color: colors.muted,
    lineHeight: 17,
  },

  // --- Notification styles ---
  notifEmpty: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 12,
  },
  notifEmptyText: {
    fontSize: 14,
    color: colors.muted,
  },
  notifDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
  notifItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 14,
    gap: 12,
  },
  notifItemUnread: {
    backgroundColor: "#F0FDF4",
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  notifIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceGray,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  notifTextWrap: {
    flex: 1,
  },
  notifItemTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.navy,
    marginBottom: 2,
  },
  notifItemBody: {
    fontSize: 13,
    color: colors.muted,
    lineHeight: 18,
    marginBottom: 4,
  },
  notifItemTime: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: "500",
  },
  notifDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#16A34A",
    marginTop: 6,
    flexShrink: 0,
  },
  notifBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.error,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  notifBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: colors.white,
  },
  confirmBtn: {
    marginTop: 8,
    alignSelf: "flex-start",
    backgroundColor: "#16A34A",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  confirmBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.white,
  },
});
