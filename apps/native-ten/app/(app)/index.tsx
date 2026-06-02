import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  ScrollView,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useConvex } from "convex/react";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
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
import { useAuth } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { colors, radii, cardShadow } from "../../constants/theme";
import LiveetTenantHero from "../../assets/images/Liveet-tenant.png";
import { ScrollView as GHScrollView } from "react-native-gesture-handler";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;
const CARD_WIDTH = SCREEN_WIDTH - 40;
const TAB_BAR_CLEARANCE = 90;
const CARD_SIDE_INSET = (SCREEN_WIDTH - CARD_WIDTH) / 2;

const CATEGORY_LABELS: Record<string, string> = {
  single: "Single",
  double: "Double",
  triple: "Triple",
  "3plus": "3+ Bed",
};

const AnimatedScrollView = Animated.createAnimatedComponent(GHScrollView);

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

type BookingRequest = {
  _id: string;
  propertyId: string;
  studentName: string;
  moveInDate: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: number;
  propertyName: string | null;
  propertyCity: string | null;
  propertyState: string | null;
  coverImageUrl: string | null;
};

function formatAmount(n: number): string {
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

function PropertyCard({ property }: { property: Property }) {
  const rentRange = getRentRange(property.roomOptions);
  const amenities = getAmenities(property.roomOptions);
  const occupancyBadge = getOccupancyBadge(property.tenantDetails);
  const bestSuited = getBestSuited(property.tenantDetails);
  const rooms = property.roomOptions.slice(0, 4);
  const agreement = property.agreement;

  const [cardHeight, setCardHeight] = useState(0);
  const heroHeight = cardHeight > 0 ? cardHeight * 0.34 : 220;

  const scrollY = useSharedValue(0);
  const heroHeightSv = useSharedValue(heroHeight);

  useEffect(() => {
    heroHeightSv.value = heroHeight;
  }, [heroHeight, heroHeightSv]);

  useEffect(() => {
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

// ─── Status pill colours ─────────────────────────────────────────────────────
const STATUS_PILL: Record<string, { label: string; fg: string; bg: string; dot: string }> = {
  pending:  { label: "Pending",     fg: "#92400E", bg: "#FEF3C7", dot: "#D97706" },
  accepted: { label: "Confirmed",   fg: "#15803D", bg: "#DCFCE7", dot: "#16A34A" },
  rejected: { label: "Declined",    fg: "#B91C1C", bg: "#FEE2E2", dot: "#DC2626" },
};

function StatusPillRN({ status }: { status: string }) {
  const s = STATUS_PILL[status] ?? STATUS_PILL.pending;
  return (
    <View style={[d.pill, { backgroundColor: s.bg }]}>
      <View style={[d.pillDot, { backgroundColor: s.dot }]} />
      <Text style={[d.pillText, { color: s.fg }]}>{s.label}</Text>
    </View>
  );
}

function StudentDashboard({
  booking,
  onLogout,
}: {
  booking: BookingRequest;
  onLogout: () => void;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  const firstName = booking.studentName.split(" ")[0];
  const initials = booking.studentName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const locationLine = [booking.propertyCity, booking.propertyState]
    .filter(Boolean)
    .join(", ");

  // Booking status chip text for the rent hero
  const bookingChip =
    booking.status === "accepted"
      ? { text: "Booking Confirmed", bg: "rgba(212,245,66,0.18)", fg: "#D4F542" }
      : booking.status === "rejected"
      ? { text: "Application Declined", bg: "rgba(248,113,113,0.18)", fg: "#FCA5A5" }
      : { text: "Under review", bg: "rgba(255,255,255,0.12)", fg: "rgba(255,255,255,0.85)" };

  // Quick requests grid — monochrome icons on surfaceGray
  const quickActions = [
    { icon: "time-outline" as const,             label: "Late entry",   sub: "Notify the gate",       route: "/personal" },
    { icon: "calendar-outline" as const,          label: "Extend stay",  sub: "Push your move-out",    route: "/personal" },
    { icon: "swap-horizontal-outline" as const,   label: "Room change",  sub: "Request a new room",    route: "/personal" },
    { icon: "log-out-outline" as const,           label: "Move out",     sub: "Start the process",     route: "/personal" },
  ];

  return (
    <View style={[d.root, { paddingTop: insets.top }]}>
      {/* ── Top bar ── */}
      <View style={d.topBar}>
        <View style={{ gap: 1 }}>
          <Text style={d.greetText}>{greeting}</Text>
          <Text style={d.nameText}>{firstName}</Text>
        </View>
        <View style={d.topBarRight}>
          {/* Bell */}
          <View style={d.bellWrap}>
            <Ionicons name="notifications-outline" size={16} color={colors.navy} />
            <View style={d.bellDot} />
          </View>
          {/* Avatar */}
          <View style={d.avatar}>
            <Text style={d.avatarTxt}>{initials}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={d.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + TAB_BAR_CLEARANCE }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Stay pill ── */}
        <View style={d.stayPill}>
          <View style={d.stayIcon}>
            <Ionicons name="bed-outline" size={18} color={colors.navy} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={d.stayName} numberOfLines={1}>
              {booking.propertyName ?? "Your Property"}
              {locationLine ? ` · ${locationLine}` : ""}
            </Text>
            <Text style={d.staySub}>Booking · Move-in {booking.moveInDate}</Text>
          </View>
          <View style={d.activeChip}>
            <Text style={d.activeChipTxt}>
              {booking.status === "accepted" ? "Confirmed" : booking.status === "rejected" ? "Declined" : "Pending"}
            </Text>
            <View
              style={[
                d.activeDot,
                {
                  backgroundColor:
                    booking.status === "accepted"
                      ? "#16A34A"
                      : booking.status === "rejected"
                      ? "#DC2626"
                      : "#D97706",
                },
              ]}
            />
          </View>
        </View>

        {/* ── Booking hero (navy card) ── */}
        <View style={d.heroCard}>
          {/* decorative circle */}
          <View style={d.heroCircle} />
          <View style={d.heroRow1}>
            <Text style={d.heroDueLabel}>Booking request</Text>
            <View style={[d.heroChip, { backgroundColor: bookingChip.bg }]}>
              <Text style={[d.heroChipTxt, { color: bookingChip.fg }]}>{bookingChip.text}</Text>
            </View>
          </View>
          <View style={d.heroRow2}>
            <View>
              <Text style={d.heroAmount}>{booking.propertyName ?? "Your property"}</Text>
              <View style={d.heroSubRow}>
                <Ionicons name="time-outline" size={13} color="rgba(255,255,255,0.7)" />
                <Text style={d.heroSubTxt}>
                  Move-in: {booking.moveInDate}
                </Text>
              </View>
            </View>
          </View>
          {/* divider + breakdown */}
          <View style={d.heroBreakDiv} />
          <View style={d.heroBreakRow}>
            <View style={d.heroBreakItem}>
              <Text style={d.heroBreakLabel}>Property</Text>
              <Text style={d.heroBreakVal} numberOfLines={1}>{booking.propertyName ?? "—"}</Text>
            </View>
            <View style={[d.heroBreakItem, d.heroBreakBorder]}>
              <Text style={d.heroBreakLabel}>Move-in</Text>
              <Text style={d.heroBreakVal}>{booking.moveInDate}</Text>
            </View>
            <View style={[d.heroBreakItem, d.heroBreakBorder]}>
              <Text style={d.heroBreakLabel}>Status</Text>
              <Text style={d.heroBreakVal}>
                {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
              </Text>
            </View>
          </View>
          {/* CTA */}
          <View style={d.heroCta}>
            <TouchableOpacity
              style={d.heroCtaBtn}
              activeOpacity={0.85}
              onPress={() => router.push("/chats" as any)}
            >
              <Text style={d.heroCtaBtnTxt}>Chat with operator</Text>
              <Ionicons name="arrow-forward" size={16} color="#1A1A1A" />
            </TouchableOpacity>
            <TouchableOpacity
              style={d.heroCtaGhost}
              activeOpacity={0.7}
              onPress={() => router.push("/complaint" as any)}
            >
              <Ionicons name="document-text-outline" size={17} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── E-KYC card ── */}
        <View style={d.card}>
          <View style={d.kycHead}>
            <View style={d.kycIconWrap}>
              <Ionicons name="shield-outline" size={20} color={colors.navy} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={d.cardTitle}>E-KYC verification</Text>
              <Text style={d.cardSub}>Finish to unlock all features</Text>
            </View>
            <View style={[d.kycChip, { backgroundColor: "#FEF3C7" }]}>
              <Text style={[d.kycChipTxt, { color: "#92400E" }]}>0/4 done</Text>
            </View>
          </View>
          {/* progress bar */}
          <View style={d.progressTrack}>
            <View style={[d.progressFill, { width: "0%" }]} />
          </View>
          {/* steps */}
          {[
            { label: "Aadhaar / ID proof", done: false },
            { label: "Profile photo", done: false },
            { label: "Rental agreement e-sign", done: false },
            { label: "Police verification", done: false },
          ].map((step, i) => (
            <View key={step.label} style={[d.kycStep, i === 0 && { borderTopWidth: 0 }]}>
              <View style={[d.kycStepDot, step.done && d.kycStepDotDone]}>
                {step.done && <Ionicons name="checkmark" size={12} color="#D4F542" />}
              </View>
              <Text style={[d.kycStepTxt, !step.done && { color: colors.muted }]}>{step.label}</Text>
              {!step.done && <Text style={d.kycAddTxt}>Add</Text>}
            </View>
          ))}
          <TouchableOpacity style={d.kycBtn} activeOpacity={0.85}>
            <Text style={d.kycBtnTxt}>Complete verification</Text>
            <Ionicons name="arrow-forward" size={16} color="#D4F542" />
          </TouchableOpacity>
        </View>

        {/* ── Quick requests ── */}
        <View style={d.sectionHeader}>
          <Text style={d.sectionTitle}>Quick requests</Text>
        </View>
        <View style={d.reqGrid}>
          {quickActions.map((a) => (
            <TouchableOpacity
              key={a.label}
              style={d.reqCard}
              activeOpacity={0.7}
              onPress={() => router.push(a.route as any)}
            >
              <View style={d.reqIconWrap}>
                <Ionicons name={a.icon} size={19} color={colors.navy} />
              </View>
              <View>
                <Text style={d.reqLabel}>{a.label}</Text>
                <Text style={d.reqSub}>{a.sub}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Complaints ── */}
        <View style={d.card}>
          <View style={d.cardTitleRow}>
            <Text style={d.cardTitle}>Complaints &amp; issues</Text>
            <TouchableOpacity
              style={d.seeAllBtn}
              onPress={() => router.push("/complaint" as any)}
            >
              <Text style={d.seeAllTxt}>See all</Text>
              <Ionicons name="arrow-forward" size={12} color={colors.navy} />
            </TouchableOpacity>
          </View>
          <View style={d.emptyComplaints}>
            <Text style={d.emptyTxt}>No complaints raised yet</Text>
          </View>
          <TouchableOpacity
            style={d.raiseBtn}
            activeOpacity={0.7}
            onPress={() => router.push("/complaint" as any)}
          >
            <Ionicons name="add" size={15} color={colors.navy} />
            <Text style={d.raiseBtnTxt}>Raise a complaint</Text>
          </TouchableOpacity>
        </View>

        {/* ── Edit details row ── */}
        <TouchableOpacity
          style={d.editRow}
          activeOpacity={0.7}
          onPress={() => router.push("/personal" as any)}
        >
          <View style={d.editIconWrap}>
            <Ionicons name="create-outline" size={17} color={colors.navy} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={d.editLabel}>Edit basic details</Text>
            <Text style={d.editSub}>Contact, course, guardian &amp; emergency info</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.muted} />
        </TouchableOpacity>

        {/* ── Watermark ── */}
        <View style={d.watermark}>
          <View style={d.watermarkLine} />
          <Text style={d.watermarkTxt}>LIVEET</Text>
          <View style={d.watermarkLine} />
        </View>
        <Text style={d.watermarkTag}>your stay, sorted</Text>
      </ScrollView>
    </View>
  );
}

export default function AppHome() {
  const convex = useConvex();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();

  const handleLogout = useCallback(() => {
    Alert.alert("Log out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: () => void signOut(),
      },
    ]);
  }, [signOut]);

  const [properties, setProperties] = useState<Property[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [bookingRequest, setBookingRequest] = useState<BookingRequest | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 5000);

    (async () => {
      try {
        const [result, booking] = await Promise.all([
          (convex as any).query("properties:listForTenants", {}),
          (convex as any).query("properties:getMyBookingRequest", {}),
        ]);
        if (!cancelled) {
          if (result) setProperties(result);
          if (booking) setBookingRequest(booking);
        }
      } catch (err) {
        console.warn("Failed to fetch data:", err);
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

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const recordSwipe = useCallback(
    async (propertyId: string, liked: boolean) => {
      try {
        await (convex as any).mutation("properties:recordSwipe", { propertyId, liked });
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
    const scale = interpolate(absX, [0, SWIPE_THRESHOLD], [0.92, 1], Extrapolation.CLAMP);
    const opacity = interpolate(absX, [0, SWIPE_THRESHOLD], [0.5, 1], Extrapolation.CLAMP);
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
          <Text style={s.loadText}>Loading...</Text>
        </View>
      </View>
    );
  }

  // Show student dashboard if tenant has submitted a booking request
  if (bookingRequest) {
    return <StudentDashboard booking={bookingRequest} onLogout={handleLogout} />;
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity style={s.hSide} onPress={handleLogout} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={22} color={colors.navy} />
        </TouchableOpacity>
        <View style={s.hCenter}>
          <Text style={s.hTitle}>Discover</Text>
          <Text style={s.hSub}>Properties near you</Text>
        </View>
        <TouchableOpacity style={[s.filterBtn, s.hSide]} activeOpacity={0.7}>
          <Ionicons name="options-outline" size={20} color={colors.navy} />
        </TouchableOpacity>
      </View>

      <View style={s.cardArea}>
        {noMore ? (
          <View style={s.empty}>
            <View style={s.emptyCircle}>
              <Ionicons name="home-outline" size={48} color={colors.muted} />
            </View>
            <Text style={s.emptyTitle}>No more properties</Text>
            <Text style={s.emptySub}>Check back later for new listings</Text>
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
                <Animated.View style={[s.stamp, s.likeStamp, likeOpacity]}>
                  <Text style={s.likeStampTxt}>LIKE</Text>
                </Animated.View>
                <Animated.View style={[s.stamp, s.nopeStamp, nopeOpacity]}>
                  <Text style={s.nopeStampTxt}>NOPE</Text>
                </Animated.View>
                <PropertyCard property={currentProperty} />
              </Animated.View>
            </GestureDetector>
          </>
        )}
      </View>

      {!noMore && (
        <View style={[s.actions, { paddingBottom: insets.bottom + TAB_BAR_CLEARANCE }]}>
          <TouchableOpacity
            style={[s.actionBtn, s.unlikeBtn]}
            onPress={handleUnlikePress}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={30} color={colors.navy} />
          </TouchableOpacity>

          <TouchableOpacity style={[s.actionBtn, s.starBtn]} activeOpacity={0.7}>
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

// ─── PropertyCard styles ────────────────────────────────────────────────────
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
    alignItems: "flex-end",
    zIndex: 2,
  },
  scrollHint: {
    alignItems: "center",
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

// ─── Discovery screen styles ─────────────────────────────────────────────────
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
});

// ─── Student Dashboard styles (exact Claude Design) ──────────────────────────
const d = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#EEF2F6" },
  scroll: { flex: 1 },

  // ── Top bar
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
  },
  greetText: { fontSize: 12.5, color: "#6B7280", fontWeight: "500" },
  nameText: { fontSize: 22, fontWeight: "700", color: "#1E293B", letterSpacing: -0.6 },
  topBarRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  bellWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0",
    alignItems: "center", justifyContent: "center",
  },
  bellDot: {
    position: "absolute", top: 7, right: 8,
    width: 7, height: 7, borderRadius: 999,
    backgroundColor: "#D4F542",
    borderWidth: 1.5, borderColor: "#fff",
  },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#1E293B",
    alignItems: "center", justifyContent: "center",
  },
  avatarTxt: { fontSize: 13, fontWeight: "700", color: "#fff", letterSpacing: -0.2 },

  // ── Stay pill
  stayPill: {
    marginHorizontal: 20, marginBottom: 14,
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 10, paddingRight: 12,
    backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "#E2E8F0",
  },
  stayIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "#F1F5F9",
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  stayName: { fontSize: 13.5, fontWeight: "700", color: "#1E293B", letterSpacing: -0.2 },
  staySub: { fontSize: 11.5, color: "#6B7280", marginTop: 1 },
  activeChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
  },
  activeChipTxt: { fontSize: 11, fontWeight: "700", color: "#1E293B" },
  activeDot: { width: 6, height: 6, borderRadius: 999 },

  // ── Rent / booking hero card (navy)
  heroCard: {
    marginHorizontal: 20, marginBottom: 14,
    backgroundColor: "#1E293B", borderRadius: 22,
    padding: 16, paddingBottom: 18,
    overflow: "hidden",
    ...cardShadow,
  },
  heroCircle: {
    position: "absolute", top: -40, right: -40,
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: "rgba(212,245,66,0.06)",
  },
  heroRow1: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  heroDueLabel: { fontSize: 13, color: "rgba(255,255,255,0.65)", fontWeight: "500" },
  heroChip: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
  },
  heroChipTxt: { fontSize: 11, fontWeight: "700", letterSpacing: 0.1 },
  heroRow2: { marginTop: 6 },
  heroAmount: {
    fontSize: 26, fontWeight: "700", color: "#fff",
    letterSpacing: -0.6, lineHeight: 32,
  },
  heroSubRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 7 },
  heroSubTxt: { fontSize: 12, color: "rgba(255,255,255,0.7)", fontWeight: "500" },
  heroBreakDiv: {
    height: 1, backgroundColor: "rgba(255,255,255,0.08)",
    marginTop: 16, marginBottom: 14,
  },
  heroBreakRow: { flexDirection: "row" },
  heroBreakItem: { flex: 1, paddingLeft: 0 },
  heroBreakBorder: { borderLeftWidth: 1, borderLeftColor: "rgba(255,255,255,0.08)", paddingLeft: 10 },
  heroBreakLabel: {
    fontSize: 10, color: "rgba(255,255,255,0.5)",
    fontWeight: "600", letterSpacing: 0.3,
  },
  heroBreakVal: {
    fontSize: 14, fontWeight: "700", color: "#fff",
    marginTop: 3, letterSpacing: -0.2,
  },
  heroCta: { flexDirection: "row", gap: 8, marginTop: 16 },
  heroCtaBtn: {
    flex: 1, height: 46, borderRadius: 14,
    backgroundColor: "#D4F542",
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  heroCtaBtnTxt: { fontSize: 14.5, fontWeight: "800", color: "#1A1A1A", letterSpacing: 0.1 },
  heroCtaGhost: {
    width: 46, height: 46, borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center", justifyContent: "center",
  },

  // ── White card (KYC, complaints)
  card: {
    marginHorizontal: 20, marginBottom: 14,
    backgroundColor: "#fff", borderRadius: 18,
    padding: 16, borderWidth: 1, borderColor: "#E2E8F0",
  },
  cardTitle: { fontSize: 16.5, fontWeight: "700", color: "#1E293B", letterSpacing: -0.4 },
  cardSub: { fontSize: 11.5, color: "#6B7280", marginTop: 1 },
  cardTitleRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginBottom: 10,
  },
  seeAllBtn: { flexDirection: "row", alignItems: "center", gap: 2 },
  seeAllTxt: { fontSize: 12, fontWeight: "700", color: "#1E293B" },

  // ── KYC card
  kycHead: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  kycIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: "#F1F5F9",
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  kycChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  kycChipTxt: { fontSize: 11, fontWeight: "700" },
  progressTrack: {
    height: 7, borderRadius: 999, backgroundColor: "#F3F4F6",
    overflow: "hidden", marginBottom: 14,
  },
  progressFill: { height: "100%", backgroundColor: "#1E293B", borderRadius: 999 },
  kycStep: {
    flexDirection: "row", alignItems: "center", gap: 11,
    paddingVertical: 7, borderTopWidth: 1, borderTopColor: "#E2E8F0",
  },
  kycStepDot: {
    width: 22, height: 22, borderRadius: 999, flexShrink: 0,
    backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#E2E8F0",
    alignItems: "center", justifyContent: "center",
  },
  kycStepDotDone: { backgroundColor: "#1E293B", borderColor: "#1E293B" },
  kycStepTxt: { flex: 1, fontSize: 13.5, fontWeight: "600", color: "#1E293B" },
  kycAddTxt: { fontSize: 11, fontWeight: "700", color: "#1E293B" },
  kycBtn: {
    height: 46, borderRadius: 14, backgroundColor: "#1E293B",
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, marginTop: 14,
    shadowColor: "#1E293B", shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 20, elevation: 8,
  },
  kycBtnTxt: { fontSize: 14, fontWeight: "700", color: "#fff" },

  // ── Quick requests grid
  sectionHeader: { marginHorizontal: 20, marginBottom: 10 },
  sectionTitle: { fontSize: 16.5, fontWeight: "700", color: "#1E293B", letterSpacing: -0.4 },
  reqGrid: {
    marginHorizontal: 20, marginBottom: 14,
    flexDirection: "row", flexWrap: "wrap", gap: 10,
  },
  reqCard: {
    width: (SCREEN_WIDTH - 50) / 2,
    backgroundColor: "#fff", borderRadius: 16,
    borderWidth: 1, borderColor: "#E2E8F0",
    padding: 14, gap: 10,
  },
  reqIconWrap: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: "#F1F5F9",
    alignItems: "center", justifyContent: "center",
  },
  reqLabel: { fontSize: 14, fontWeight: "700", color: "#1E293B", letterSpacing: -0.2 },
  reqSub: { fontSize: 11, color: "#6B7280", marginTop: 2 },

  // ── Complaints
  emptyComplaints: { paddingVertical: 16, alignItems: "center" },
  emptyTxt: { fontSize: 13, color: "#6B7280" },
  raiseBtn: {
    height: 44, borderRadius: 14,
    backgroundColor: "#F1F5F9",
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  raiseBtnTxt: { fontSize: 13.5, fontWeight: "700", color: "#1E293B" },

  // ── Edit details row
  editRow: {
    marginHorizontal: 20, marginBottom: 14,
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 12, paddingHorizontal: 14,
    backgroundColor: "#fff", borderRadius: 16,
    borderWidth: 1, borderColor: "#E2E8F0",
  },
  editIconWrap: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: "#F1F5F9",
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  editLabel: { fontSize: 14, fontWeight: "700", color: "#1E293B", letterSpacing: -0.2 },
  editSub: { fontSize: 11.5, color: "#6B7280", marginTop: 1 },

  // ── Watermark
  watermark: {
    flexDirection: "row", alignItems: "center", gap: 12,
    marginHorizontal: 20, marginTop: 10, opacity: 0.55,
  },
  watermarkLine: { flex: 1, height: 1, backgroundColor: "#94A3B8" },
  watermarkTxt: { fontSize: 15, fontWeight: "700", color: "#94A3B8", letterSpacing: 6 },
  watermarkTag: {
    fontSize: 11, color: "#94A3B8", fontStyle: "italic",
    letterSpacing: 0.5, textAlign: "center",
    marginTop: 6, marginBottom: 18, opacity: 0.55,
  },

  // ── Status pill
  pill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
  },
  pillDot: { width: 6, height: 6, borderRadius: 999 },
  pillText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.1 },
});
