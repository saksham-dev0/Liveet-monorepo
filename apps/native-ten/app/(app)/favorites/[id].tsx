import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import { colors } from "../../../constants/theme";

import LiveetTenantHero from "../../../assets/images/Liveet-tenant.png";

type LikedProperty = {
  _id: string;
  name?: string;
  city?: string;
  state?: string;
  coverImageUrl?: string | null;
  roomOptions?: { rentAmount?: number | null }[];
};

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

function formatMoneyUSD(n: number): string {
  // Matches the screenshot separator style: 35.640.00
  const fixed = n.toFixed(2); // "35640.00"
  const [intPart, decPart] = fixed.split(".");
  const withDots = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `$${withDots}.${decPart}`;
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

  const heroSource = useMemo(() => {
    const uri = property?.coverImageUrl ?? null;
    if (uri) return { uri };
    return LiveetTenantHero;
  }, [property?.coverImageUrl]);

  const title = property?.name ?? "Premium House A24";
  const location =
    [property?.city, property?.state].filter(Boolean).join(", ") ||
    "Maplewood, New Jersey";

  const rentRange = getRentRange(property?.roomOptions ?? []);
  const priceText = rentRange ? formatMoneyUSD(rentRange.min) : "$35.640.00";

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
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        <View style={s.card}>
          {/* Hero */}
          <View style={s.hero}>
            <Image source={heroSource as any} style={s.heroImage} contentFit="cover" />

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

            {/* Stats pill */}
            <View style={s.statsPill} accessibilityElementsHidden={false}>
              <View style={s.statCol}>
                <Ionicons name="heart" size={16} color={colors.navy} />
                <Text style={s.statsText}>2.5k</Text>
              </View>
              <View style={s.statCol}>
                <Ionicons name="eye" size={16} color={colors.navy} />
                <Text style={s.statsText}>50k</Text>
              </View>
              <View style={s.statCol}>
                <Ionicons name="people" size={16} color={colors.navy} />
                <Text style={s.statsText}>750</Text>
              </View>
            </View>
          </View>

          {/* Body */}
          <View style={s.body}>
            <View style={s.pillsRow}>
              <View style={s.smallPill}>
                <Ionicons name="home-outline" size={16} color={colors.navy} />
                <Text style={s.smallPillText}>House</Text>
              </View>

              <View style={[s.smallPill, { width: 110, alignItems: "center" }]}>
                <Ionicons name="star" size={16} color={colors.navy} />
                <Text style={s.smallPillText}>4.5</Text>
              </View>
            </View>

            <Text style={s.title}>{title}</Text>

            <View style={s.locationRow}>
              <Ionicons name="location-sharp" size={16} color={colors.muted} />
              <Text style={s.locationText}>{location}</Text>
            </View>

            {/* Facilities header */}
            <View style={s.facilitiesHeaderRow}>
              <Text style={s.sectionHeader}>Facilities</Text>
              <Text style={s.seeAll}>See all</Text>
            </View>

            {/* Facilities chips */}
            <View style={s.facilitiesChipsRow}>
              <View style={s.facilityChip}>
                <Ionicons name="bed-outline" size={22} color={colors.navy} />
                <Text style={s.facilityChipText}>4 Bedroom</Text>
              </View>
              <View style={s.facilityChip}>
                <Ionicons name="water-outline" size={22} color={colors.navy} />
                <Text style={s.facilityChipText}>2 Bathroom</Text>
              </View>
              <View style={s.facilityChip}>
                <Ionicons name="car-sport-outline" size={22} color={colors.navy} />
                <Text style={s.facilityChipText}>Car Garage</Text>
              </View>
            </View>

            {/* Long facilities section */}
            <Text style={[s.sectionHeader, { marginTop: 18 }]}>Facilities</Text>
            <Text style={s.description}>
              This clean penthouse bedroom spans 26 sqm and includes Wi-Fi, Android TV with
              hundreds of channels, Netflix, hot water, and various ent....{" "}
              <Text style={s.readMore}>Read More</Text>
            </Text>

            {/* Agent */}
            <View style={s.agentRow}>
              <View style={s.agentLeft}>
                <View style={s.avatarCircle} accessibilityIgnoresInvertColors>
                  <Ionicons name="person" size={18} color={colors.muted} />
                </View>
                <View style={s.agentText}>
                  <View style={s.agentNameRow}>
                    <Text style={s.agentName}>Bayu Krian</Text>
                    <Ionicons
                      name="checkmark-circle"
                      size={14}
                      color={colors.primary}
                      style={{ marginLeft: 6, marginTop: 1 }}
                    />
                  </View>
                  <Text style={s.agentRole}>Property Agent</Text>
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

            {/* Bottom price + CTA */}
            <View style={s.bottomRow}>
              <Text style={s.priceText}>{priceText}</Text>
              <TouchableOpacity style={s.ctaBtn} activeOpacity={0.85}>
                <Text style={s.ctaText}>Schedule Tour</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.pageBg,
    paddingHorizontal: 16,
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
  heroHeaderRow: {
    position: "absolute",
    top: 16,
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
  statsPill: {
    position: "absolute",
    left: 22,
    right: 22,
    bottom: -18,
    backgroundColor: colors.white,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 8,
  },
  statCol: { flex: 1, alignItems: "center", gap: 2 },
  statsText: { marginTop: 2, fontSize: 13, fontWeight: "900", color: colors.navy },

  body: {
    paddingHorizontal: 20,
    paddingTop: 38, // room for the overlapping stats pill
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
  sectionHeader: { fontSize: 15, fontWeight: "900", color: colors.navy },
  seeAll: { fontSize: 13, fontWeight: "700", color: colors.muted },

  facilitiesChipsRow: { flexDirection: "row", gap: 12, marginBottom: 8 },
  facilityChip: {
    flex: 1,
    backgroundColor: colors.surfaceGray,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  facilityChipText: { marginTop: 6, fontSize: 13, fontWeight: "800", color: colors.navy },

  description: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "500",
    color: colors.muted,
  },
  readMore: { color: colors.navy, fontWeight: "800" },

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

  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 12,
  },
  priceText: { fontSize: 24, fontWeight: "900", color: colors.navy },
  ctaBtn: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    minWidth: 160,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: { fontSize: 14, fontWeight: "900", color: colors.white },
});

