import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useConvex } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { colors, radii } from "../../../constants/theme";

import LiveetTenantHero from "../../../assets/images/Liveet-tenant.png";

type RoomOptionRow = {
  rentAmount?: number | null;
  category?: string;
  numberOfRooms?: number | null;
  typeName?: string | null;
  attachedWashroom?: boolean | null;
  attachedBalcony?: boolean | null;
  airConditioner?: boolean | null;
  geyser?: boolean | null;
  customFeatures?: string[] | null;
};

type PropertyAgreement = {
  securityDepositDuration?: string | null;
  agreementDuration?: string | null;
  lockInPeriod?: string | null;
  noticePeriod?: string | null;
};

type HeroSlide = { uri: string } | number;

type LikedProperty = {
  _id: string;
  name?: string;
  city?: string;
  state?: string;
  vacantUnits?: number | null;
  ownerName?: string | null;
  description?: string | null;
  coverImageUrl?: string | null;
  galleryImageUrls?: (string | null)[] | null;
  utilities?: string[] | null;
  amenities?: string[] | null;
  roomOptions?: RoomOptionRow[];
  tenantDetails?: {
    canStayMale?: boolean | null;
    canStayFemale?: boolean | null;
    canStayOthers?: boolean | null;
  } | null;
  agreement?: PropertyAgreement | null;
};

const AGREEMENT_FIELDS: { key: keyof PropertyAgreement; label: string }[] = [
  { key: "agreementDuration", label: "Agreement duration" },
  { key: "securityDepositDuration", label: "Security deposit" },
  { key: "lockInPeriod", label: "Lock-in period" },
  { key: "noticePeriod", label: "Notice period" },
];

function getAgreementRows(agreement: PropertyAgreement | null | undefined) {
  if (!agreement) return [];
  const rows: { key: string; label: string; value: string }[] = [];
  for (const { key, label } of AGREEMENT_FIELDS) {
    const v = agreement[key];
    if (typeof v === "string" && v.trim()) {
      rows.push({ key, label, value: v.trim() });
    }
  }
  return rows;
}

const AGREEMENT_ROW_ICONS: Partial<
  Record<keyof PropertyAgreement, keyof typeof Ionicons.glyphMap>
> = {
  agreementDuration: "calendar-outline",
  securityDepositDuration: "wallet-outline",
  lockInPeriod: "lock-closed-outline",
  noticePeriod: "notifications-outline",
};

function agreementRowIcon(key: string): keyof typeof Ionicons.glyphMap {
  return AGREEMENT_ROW_ICONS[key as keyof PropertyAgreement] ?? "document-text-outline";
}

const CATEGORY_LABELS: Record<string, string> = {
  single: "Single",
  double: "Double",
  triple: "Triple",
  "3plus": "3+ Bed",
};

function getPlacementPill(
  d: LikedProperty["tenantDetails"],
): { label: string; icon: keyof typeof Ionicons.glyphMap } | null {
  if (!d) return null;
  const m = !!d.canStayMale;
  const f = !!d.canStayFemale;
  const o = !!d.canStayOthers;
  if (!m && !f && !o) return null;
  if (f && !m && !o) return { label: "Female only", icon: "woman-outline" };
  if (m && !f && !o) return { label: "Male only", icon: "man-outline" };
  return { label: "Coliving", icon: "people-outline" };
}

function collectFacilityLabels(roomOptions: RoomOptionRow[] | undefined): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  const push = (raw: string) => {
    const t = raw.trim();
    if (!t || seen.has(t)) return;
    seen.add(t);
    labels.push(t);
  };

  for (const r of roomOptions ?? []) {
    if (r.airConditioner) push("Air conditioning");
    if (r.geyser) push("Geyser");
    if (r.attachedWashroom) push("Attached washroom");
    if (r.attachedBalcony) push("Balcony");
    const tn = r.typeName?.trim();
    if (tn) push(tn);
    else if (r.category) {
      const cat = CATEGORY_LABELS[r.category] ?? r.category;
      push(`${cat} room`);
    }
    if (typeof r.numberOfRooms === "number" && r.numberOfRooms > 0) {
      push(
        `${r.numberOfRooms} bedroom${r.numberOfRooms === 1 ? "" : "s"}`,
      );
    }
    for (const f of r.customFeatures ?? []) {
      if (typeof f === "string" && f.trim()) push(f.trim());
    }
  }
  return labels;
}

function facilityIcon(label: string): keyof typeof Ionicons.glyphMap {
  const l = label.toLowerCase();
  if (l.includes("geyser") || l.includes("washroom") || l.includes("bath"))
    return "water-outline";
  if (l.includes("balcony")) return "sunny-outline";
  if (l.includes("air") || l.endsWith(" ac") || l === "ac")
    return "snow-outline";
  if (l.includes("bedroom") || l.includes("room")) return "bed-outline";
  return "checkmark-circle-outline";
}

function normalizeTagList(arr: string[] | null | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of arr ?? []) {
    if (typeof s !== "string") continue;
    const t = s.trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

function getRentRange(roomOptions: LikedProperty["roomOptions"]): {
  min: number;
  max: number;
} | null {
  const amounts = (roomOptions ?? [])
    .map((r) => r?.rentAmount)
    .filter((a): a is number => typeof a === "number" && a > 0);

  if (!amounts.length) return null;
  return { min: Math.min(...amounts), max: Math.max(...amounts) };
}

function formatRentRupees(n: number): string {
  return Math.round(n).toLocaleString("en-IN");
}

function buildHeroSlides(property: LikedProperty | null): HeroSlide[] {
  if (!property) return [LiveetTenantHero];
  const out: HeroSlide[] = [];
  const seen = new Set<string>();
  const addUri = (raw: string) => {
    const u = raw.trim();
    if (!u || seen.has(u)) return;
    seen.add(u);
    out.push({ uri: u });
  };
  if (property.coverImageUrl) addUri(property.coverImageUrl);
  for (const u of property.galleryImageUrls ?? []) {
    if (typeof u === "string" && u.trim()) addUri(u);
  }
  if (out.length === 0) return [LiveetTenantHero];
  return out;
}

export default function FavoritesDetailScreen() {
  const convex = useConvex();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();

  const propertyId = useMemo(() => {
    const raw = params.id;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [params.id]);

  const [loading, setLoading] = useState(true);
  const [property, setProperty] = useState<LikedProperty | null>(null);
  const [heroImageIndex, setHeroImageIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const result = await (convex as any).query("properties:listLikedForTenants", {});
        if (cancelled) return;

        const found =
          (result ?? []).find((p: LikedProperty) => p?._id === propertyId) ?? null;
        setProperty(found);
      } catch (e) {
        // UI-only: keep the screen usable even if the query fails.
        console.warn("Failed to load favorite details:", e);
        if (!cancelled) setProperty(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [convex, propertyId]);

  const heroSlides = useMemo(() => buildHeroSlides(property), [property]);

  useEffect(() => {
    setHeroImageIndex(0);
  }, [property?._id]);

  const heroSlideCount = heroSlides.length;
  const heroSlideIndex =
    heroSlideCount > 0 ? Math.min(heroImageIndex, heroSlideCount - 1) : 0;
  const currentHeroSlide = heroSlides[heroSlideIndex] ?? LiveetTenantHero;
  const canBrowseHero = heroSlideCount > 1;

  const goHeroPrev = () => {
    setHeroImageIndex((i) => {
      if (heroSlideCount <= 1) return 0;
      return i <= 0 ? heroSlideCount - 1 : i - 1;
    });
  };

  const goHeroNext = () => {
    setHeroImageIndex((i) => {
      if (heroSlideCount <= 1) return 0;
      return i >= heroSlideCount - 1 ? 0 : i + 1;
    });
  };

  const title = property?.name ?? "Premium House A24";
  const location =
    [property?.city, property?.state].filter(Boolean).join(", ") ||
    "Maplewood, New Jersey";

  const rentRangeForPrice = useMemo(
    () => getRentRange(property?.roomOptions),
    [property?.roomOptions],
  );

  const placementPill = useMemo(
    () => getPlacementPill(property?.tenantDetails ?? null),
    [property?.tenantDetails],
  );
  const facilityLabels = useMemo(
    () => collectFacilityLabels(property?.roomOptions),
    [property?.roomOptions],
  );
  const agreementRows = useMemo(
    () => getAgreementRows(property?.agreement ?? null),
    [property?.agreement],
  );
  const utilitiesList = useMemo(
    () => normalizeTagList(property?.utilities),
    [property?.utilities],
  );
  const amenitiesList = useMemo(
    () => normalizeTagList(property?.amenities),
    [property?.amenities],
  );
  const operatorDescription = (property?.description ?? "").trim();
  const ownerDisplayName = (property?.ownerName ?? "").trim();

  if (loading && !property) {
    return (
      <View style={[s.root, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 4 }}
      >
        <View style={s.card}>
          {/* Hero */}
          <View style={s.hero}>
            <Image
              key={
                typeof currentHeroSlide === "object" &&
                currentHeroSlide !== null &&
                "uri" in currentHeroSlide
                  ? currentHeroSlide.uri
                  : `asset-${heroSlideIndex}`
              }
              source={currentHeroSlide as any}
              style={s.heroImage}
              contentFit="cover"
            />

            {canBrowseHero ? (
              <View style={s.heroTapStrip} pointerEvents="box-none">
                <Pressable
                  style={s.heroTapHalf}
                  onPress={goHeroPrev}
                  accessibilityRole="button"
                  accessibilityLabel="Previous photo"
                >
                  <View style={s.heroTapHalfFill} collapsable={false} />
                </Pressable>
                <Pressable
                  style={s.heroTapHalf}
                  onPress={goHeroNext}
                  accessibilityRole="button"
                  accessibilityLabel="Next photo"
                >
                  <View style={s.heroTapHalfFill} collapsable={false} />
                </Pressable>
              </View>
            ) : null}

            {/* Header actions */}
            <View style={s.heroHeaderRow} pointerEvents="box-none">
              <TouchableOpacity
                style={s.roundBtn}
                onPress={() => router.back()}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Back"
              >
                <Ionicons name="chevron-back" size={18} color={colors.navy} />
              </TouchableOpacity>

              <TouchableOpacity
                style={s.roundBtn}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Liked"
              >
                <Ionicons name="heart" size={18} color={colors.navy} />
              </TouchableOpacity>
            </View>

            {canBrowseHero ? (
              <View style={s.heroDotsWrap} pointerEvents="none">
                {heroSlides.map((_, i) => (
                  <View
                    key={`hero-dot-${i}`}
                    style={[s.heroDot, i === heroSlideIndex && s.heroDotActive]}
                  />
                ))}
              </View>
            ) : null}
          </View>

          {/* Body */}
          <View style={s.body}>
            {placementPill ? (
              <View style={s.pillsRow}>
                <View style={s.smallPill}>
                  <Ionicons
                    name={placementPill.icon}
                    size={16}
                    color={colors.navy}
                  />
                  <Text style={s.smallPillText}>{placementPill.label}</Text>
                </View>
              </View>
            ) : null}

            <Text style={s.title}>{title}</Text>

            <View style={s.locationRow}>
              <Ionicons name="location-sharp" size={16} color={colors.muted} />
              <Text style={s.locationText}>{location}</Text>
            </View>

            {operatorDescription ? (
              <>
                <Text style={[s.sectionHeader, { marginTop: 18 }]}>Description</Text>
                <Text style={s.description}>{operatorDescription}</Text>
              </>
            ) : null}

            {facilityLabels.length > 0 ? (
              <>
                <View style={s.facilitiesHeaderRow}>
                  <Text style={s.sectionHeader}>Facilities</Text>
                </View>
                <View style={s.facilitiesWrap}>
                  {facilityLabels.map((label) => (
                    <View key={label} style={s.facilityChipWrap}>
                      <Ionicons
                        name={facilityIcon(label)}
                        size={22}
                        color={colors.navy}
                      />
                      <Text style={s.facilityChipText}>{label}</Text>
                    </View>
                  ))}
                </View>
              </>
            ) : null}

            {utilitiesList.length > 0 || amenitiesList.length > 0 ? (
              <View style={s.utilAmenCard}>
                <View style={s.utilAmenCardHeader}>
                  <View style={s.utilAmenLeadIcon}>
                    <Ionicons name="sparkles-outline" size={22} color={colors.navy} />
                  </View>
                  <View style={s.agreementHeaderCopy}>
                    <Text style={s.agreementCardTitle}>Utilities & amenities</Text>
                    <Text style={s.agreementCardSubtitle}>
                      {"What's included with this listing"}
                    </Text>
                  </View>
                </View>

                {utilitiesList.length > 0 ? (
                  <View style={s.utilAmenBlock}>
                    <View style={s.utilAmenBlockTitleRow}>
                      <Ionicons name="flash-outline" size={16} color={colors.primary} />
                      <Text style={s.utilAmenBlockTitle}>Utilities</Text>
                    </View>
                    <View style={s.utilAmenChipWrap}>
                      {utilitiesList.map((label) => (
                        <View key={`u:${label}`} style={s.utilAmenChip}>
                          <Text style={s.utilAmenChipText}>{label}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}

                {amenitiesList.length > 0 ? (
                  <View
                    style={[
                      s.utilAmenBlock,
                      utilitiesList.length > 0 && s.utilAmenBlockSpaced,
                    ]}
                  >
                    <View style={s.utilAmenBlockTitleRow}>
                      <Ionicons name="leaf-outline" size={16} color={colors.primary} />
                      <Text style={s.utilAmenBlockTitle}>Amenities</Text>
                    </View>
                    <View style={s.utilAmenChipWrap}>
                      {amenitiesList.map((label) => (
                        <View key={`a:${label}`} style={s.utilAmenChip}>
                          <Text style={s.utilAmenChipText}>{label}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}
              </View>
            ) : null}

            {agreementRows.length > 0 ? (
              <View style={s.agreementCard}>
                <View style={s.agreementCardHeader}>
                  <View style={s.agreementLeadIcon}>
                    <Ionicons
                      name="document-text-outline"
                      size={22}
                      color={colors.navy}
                    />
                  </View>
                  <View style={s.agreementHeaderCopy}>
                    <Text style={s.agreementCardTitle}>Agreement</Text>
                    <Text style={s.agreementCardSubtitle}>
                      Key terms for this listing
                    </Text>
                  </View>
                </View>
                <View style={s.agreementItems}>
                  {agreementRows.map((row, index) => (
                    <View
                      key={row.key}
                      style={[
                        s.agreementItem,
                        index < agreementRows.length - 1 && s.agreementItemWithRule,
                      ]}
                    >
                      <View style={s.agreementItemGlyph}>
                        <Ionicons
                          name={agreementRowIcon(row.key)}
                          size={17}
                          color={colors.primary}
                        />
                      </View>
                      <View style={s.agreementItemMain}>
                        <Text style={s.agreementItemLabel}>{row.label}</Text>
                        <Text style={s.agreementItemValue}>{row.value}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {/* Agent */}
            <View style={s.agentRow}>
              <View style={s.agentLeft}>
                <View style={s.avatarCircle} accessibilityIgnoresInvertColors>
                  <Ionicons name="person" size={18} color={colors.muted} />
                </View>
                <View style={s.agentText}>
                  <View style={s.agentNameRow}>
                    <Text style={s.agentName}>
                      {ownerDisplayName || "Property owner"}
                    </Text>
                    {ownerDisplayName ? (
                      <Ionicons
                        name="checkmark-circle"
                        size={14}
                        color={colors.primary}
                        style={{ marginLeft: 6, marginTop: 1 }}
                      />
                    ) : null}
                  </View>
                  {ownerDisplayName ? (
                    <Text style={s.agentRole}>Property owner</Text>
                  ) : null}
                </View>
              </View>

              <View style={s.agentActions}>
                <TouchableOpacity style={s.agentCircle} activeOpacity={0.85}>
                  <Ionicons name="chatbubble-ellipses" size={18} color={colors.white} />
                </TouchableOpacity>
                <TouchableOpacity style={s.agentCircle} activeOpacity={0.85}>
                  <Ionicons name="call" size={18} color={colors.white} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={[s.stickyCtaBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <View style={s.bottomFooter}>
          <View style={s.priceBlock}>
            <Text style={s.priceCaption}>Rent per month</Text>
            {!rentRangeForPrice ? (
              <Text style={s.priceAmount}>—</Text>
            ) : rentRangeForPrice.max === rentRangeForPrice.min ? (
              <Text style={s.priceAmount} selectable>
                {"\u20B9"}
                {formatRentRupees(rentRangeForPrice.min)}
              </Text>
            ) : (
              <Text style={s.priceAmount} selectable>
                {"\u20B9"}
                {formatRentRupees(rentRangeForPrice.min)}
                <Text style={s.priceRangeSep}>{" \u2013 "}</Text>
                {"\u20B9"}
                {formatRentRupees(rentRangeForPrice.max)}
              </Text>
            )}
          </View>
          <TouchableOpacity
            style={s.ctaBtn}
            activeOpacity={0.85}
            onPress={() =>
              propertyId
                ? router.push(`/(app)/favorites/move-in/${propertyId}`)
                : undefined
            }
          >
            <Text style={s.ctaText}>Ready to move-in</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.pageBg,
    paddingHorizontal: 16,
  },
  scroll: {
    flex: 1,
  },
  stickyCtaBar: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
    backgroundColor: colors.white,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 28,
    overflow: "hidden",
  },
  hero: {
    height: 315,
    backgroundColor: colors.surfaceGray,
    position: "relative",
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
  },
  heroTapStrip: {
    position: "absolute",
    top: 56,
    left: 0,
    right: 0,
    bottom: 36,
    flexDirection: "row",
    zIndex: 2,
  },
  heroTapHalf: {
    flex: 1,
  },
  heroTapHalfFill: {
    flex: 1,
    width: "100%",
    minHeight: 48,
  },
  heroHeaderRow: {
    position: "absolute",
    top: 16,
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 10,
  },
  heroDotsWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    zIndex: 8,
  },
  heroDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.45)",
  },
  heroDotActive: {
    width: 18,
    backgroundColor: colors.white,
  },
  roundBtn: {
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 22,
  },
  pillsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  smallPill: {
    height: 34,
    borderRadius: 14,
    backgroundColor: colors.surfaceGray,
    borderWidth: 0,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  smallPillText: { fontSize: 13, fontWeight: "800", color: colors.navy },

  title: { fontSize: 26, fontWeight: "900", color: colors.navy, marginBottom: 6 },

  locationRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  locationText: { fontSize: 14, fontWeight: "600", color: colors.muted },

  facilitiesHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 18,
    marginBottom: 10,
  },
  utilAmenCard: {
    marginTop: 20,
    backgroundColor: colors.surfaceGray,
    borderRadius: radii.card,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  utilAmenCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 14,
  },
  utilAmenLeadIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  utilAmenBlock: {},
  utilAmenBlockSpaced: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  utilAmenBlockTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  utilAmenBlockTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: colors.navy,
    letterSpacing: -0.2,
  },
  utilAmenChipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  utilAmenChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  utilAmenChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.navy,
  },
  agreementCard: {
    marginTop: 20,
    backgroundColor: colors.surfaceGray,
    borderRadius: radii.card,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  agreementCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 4,
  },
  agreementLeadIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  agreementHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  agreementCardTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: colors.navy,
    letterSpacing: -0.3,
  },
  agreementCardSubtitle: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: "600",
    color: colors.muted,
    lineHeight: 16,
  },
  agreementItems: {
    marginTop: 14,
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  agreementItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  agreementItemWithRule: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  agreementItemGlyph: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: colors.surfaceGray,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  agreementItemMain: {
    flex: 1,
    minWidth: 0,
  },
  agreementItemLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 5,
  },
  agreementItemValue: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.navy,
    lineHeight: 21,
  },
  sectionHeader: { fontSize: 15, fontWeight: "900", color: colors.navy },

  facilitiesWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  facilityChipWrap: {
    width: "31%",
    marginBottom: 12,
    backgroundColor: colors.surfaceGray,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 6,
    alignItems: "center",
  },
  facilityChipText: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "800",
    color: colors.navy,
    textAlign: "center",
  },

  description: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "500",
    color: colors.muted,
  },
  agentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 18,
  },
  agentLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatarCircle: {
    width: 46,
    height: 46,
    borderRadius: 999,
    backgroundColor: colors.surfaceGray,
    alignItems: "center",
    justifyContent: "center",
  },
  agentText: {},
  agentNameRow: { flexDirection: "row", alignItems: "center" },
  agentName: { fontSize: 14, fontWeight: "900", color: colors.navy },
  agentRole: { marginTop: 3, fontSize: 12, fontWeight: "700", color: colors.muted },

  agentActions: { flexDirection: "row", alignItems: "center", gap: 14 },
  agentCircle: {
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  bottomFooter: {
    gap: 12,
  },
  priceBlock: {
    width: "100%",
  },
  priceCaption: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.muted,
    marginBottom: 8,
  },
  priceAmount: {
    fontSize: 20,
    fontWeight: "900",
    color: colors.navy,
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  priceRangeSep: {
    fontWeight: "700",
    color: colors.muted,
  },
  ctaBtn: {
    alignSelf: "stretch",
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: { fontSize: 14, fontWeight: "900", color: colors.white },
});

