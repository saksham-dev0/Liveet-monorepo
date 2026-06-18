import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
  ScrollView,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "convex/react";
import { api } from "../../../../../packages/backend/convex/_generated/api";
import { Ionicons } from "@expo/vector-icons";

const getLikedPropertiesRef = api.properties.getLikedProperties;
import { useRouter } from "expo-router";
import { colors, radii } from "../../../constants/theme";
import LiveetTenantHero from "../../../assets/images/Liveet-tenant.png";

const ACCENT = "#D4F542";
const ACCENT_TEXT = "#1A1A1A";
const NAVY = colors.navy;
const MUTED = colors.muted;
const SUBTLE = "#94A3B8";
const BORDER = colors.border;
const SURFACE = colors.surfaceGray;
const PAGE_BG = colors.pageBg;
const WHITE = colors.white;
const CARD_W = Dimensions.get("window").width - 40;

type LikedProperty = {
  _id: string;
  name?: string;
  coverImageUrl?: string | null;
  city?: string;
  state?: string;
  minRent?: number | null;
  maxRent?: number | null;
  propertyType?: string;
};

function formatRent(n: number): string {
  if (n >= 1000) {
    const k = n / 1000;
    const r = Math.round(k * 10) / 10;
    return `${r.toFixed(1).replace(/\.0$/, "")}K`;
  }
  return n.toLocaleString("en-IN");
}

function FilterChips({
  value,
  onChange,
  counts,
}: {
  value: string;
  onChange: (v: string) => void;
  counts: Record<string, number>;
}) {
  const opts = [
    { key: "all", label: "All" },
    { key: "pg", label: "PG" },
    { key: "flat", label: "Flat" },
  ];
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={st.filterRow}
      style={st.filterScroll}
    >
      {opts.map((o) => {
        const active = value === o.key;
        return (
          <TouchableOpacity
            key={o.key}
            onPress={() => onChange(o.key)}
            activeOpacity={0.75}
            style={[st.filterChip, active && st.filterChipActive]}
          >
            <Text style={[st.filterChipLabel, active && st.filterChipLabelActive]}>
              {o.label}
            </Text>
            <View style={[st.filterCount, active && st.filterCountActive]}>
              <Text style={[st.filterCountText, active && st.filterCountTextActive]}>
                {counts[o.key] ?? 0}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const PropertyCard = React.memo(
  ({ item, onPress }: { item: LikedProperty; onPress: () => void }) => {
    const location = [item.city, item.state].filter(Boolean).join(", ") || "Location not set";
    const rentText =
      item.minRent != null
        ? `₹${formatRent(item.minRent)}${
            item.maxRent != null && item.maxRent !== item.minRent
              ? ` – ₹${formatRent(item.maxRent)}`
              : ""
          }/mo`
        : null;

    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.88} style={st.card}>
        {/* Photo */}
        <View style={st.photoWrap}>
          <Image
            source={item.coverImageUrl ? { uri: item.coverImageUrl } : LiveetTenantHero}
            style={st.photo}
            contentFit="cover"
            transition={200}
          />
          <View style={st.photoGradient} pointerEvents="none" />
          {/* Top row */}
          <View style={st.photoTop}>
            {item.propertyType ? (
              <View style={st.typeChip}>
                <Ionicons name="bed-outline" size={12} color={NAVY} />
                <Text style={st.typeChipText}>{item.propertyType}</Text>
              </View>
            ) : null}
            <View style={st.heartBtn}>
              <Ionicons name="heart" size={17} color="#E11D48" />
            </View>
          </View>
        </View>

        {/* Body */}
        <View style={st.body}>
          <Text style={st.propName} numberOfLines={1}>
            {item.name || "Unnamed Property"}
          </Text>
          <View style={st.locRow}>
            <Ionicons name="location-sharp" size={13} color={MUTED} />
            <Text style={st.locText} numberOfLines={1}>{location}</Text>
          </View>

          {/* Price + CTA */}
          <View style={st.priceRow}>
            {rentText ? (
              <View style={st.priceGroup}>
                <Text style={st.priceText}>{rentText.split("/mo")[0]}</Text>
                <Text style={st.priceUnit}>/mo</Text>
              </View>
            ) : (
              <Text style={st.priceNA}>Price on request</Text>
            )}
            <View style={st.viewDetails}>
              <Text style={st.viewDetailsText}>View details</Text>
              <Ionicons name="arrow-forward" size={14} color={NAVY} />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  }
);

function EmptyState({ onRefresh }: { onRefresh: () => void }) {
  return (
    <View style={st.emptyWrap}>
      <View style={st.emptyCircle}>
        <Ionicons name="heart-outline" size={36} color={SUBTLE} />
      </View>
      <Text style={st.emptyTitle}>No saved stays yet</Text>
      <Text style={st.emptySub}>
        Swipe right on properties you like and they'll show up here for easy comparison.
      </Text>
      <TouchableOpacity style={st.emptyBtn} onPress={onRefresh} activeOpacity={0.85}>
        <Ionicons name="refresh-outline" size={17} color={ACCENT} />
        <Text style={st.emptyBtnText}>Refresh</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function FavoritesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [filter, setFilter] = useState("all");

  const likedData = useQuery(getLikedPropertiesRef, {});

  // Keep the last non-empty result so the UI doesn't flash empty during
  // Clerk token refresh (when Convex briefly re-runs the query unauthenticated).
  const lastDataRef = useRef<LikedProperty[]>([]);
  useEffect(() => {
    if (likedData && likedData.length > 0) lastDataRef.current = likedData;
  }, [likedData]);

  const loading = likedData === undefined;
  const properties: LikedProperty[] = likedData ?? lastDataRef.current;

  const filtered = properties.filter((p) => {
    if (filter === "all") return true;
    const type = (p.propertyType || "").toLowerCase();
    if (filter === "pg") return type.includes("pg") || type.includes("hostel");
    if (filter === "flat") return type.includes("flat") || type.includes("apartment");
    return true;
  });

  const counts = {
    all: properties.length,
    pg: properties.filter((p) => {
      const t = (p.propertyType || "").toLowerCase();
      return t.includes("pg") || t.includes("hostel");
    }).length,
    flat: properties.filter((p) => {
      const t = (p.propertyType || "").toLowerCase();
      return t.includes("flat") || t.includes("apartment");
    }).length,
  };

  const keyExtractor = useCallback((item: LikedProperty) => item._id, []);
  const renderItem = useCallback(
    ({ item }: { item: LikedProperty }) => (
      <PropertyCard
        item={item}
        onPress={() => router.push(`/(app)/favorites/${item._id}` as any)}
      />
    ),
    [router]
  );

  return (
    <View style={[st.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={st.header}>
        <View>
          <Text style={st.headerSub}>Your shortlist</Text>
          <View style={st.headerRow}>
            <Text style={st.headerTitle}>Saved stays</Text>
            {properties.length > 0 && (
              <View style={st.countBadge}>
                <Text style={st.countBadgeText}>{properties.length}</Text>
              </View>
            )}
          </View>
        </View>
        <TouchableOpacity style={st.searchBtn} activeOpacity={0.75}>
          <Ionicons name="search-outline" size={18} color={NAVY} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={st.center}>
          <ActivityIndicator size="large" color={NAVY} />
        </View>
      ) : properties.length === 0 ? (
        <EmptyState onRefresh={() => {}} />
      ) : (
        <>
          <FilterChips value={filter} onChange={setFilter} counts={counts} />
          {filtered.length === 0 ? (
            <View style={st.center}>
              <Text style={st.noFilterText}>No {filter} properties saved.</Text>
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={keyExtractor}
              renderItem={renderItem}
              contentContainerStyle={[
                st.list,
                { paddingBottom: insets.bottom + 100 },
              ]}
              showsVerticalScrollIndicator={false}
              removeClippedSubviews
              maxToRenderPerBatch={8}
              windowSize={5}
            />
          )}
        </>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: PAGE_BG },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  headerSub: { fontSize: 12, fontWeight: "500", color: MUTED, marginBottom: 2 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle: { fontSize: 26, fontWeight: "800", color: NAVY, letterSpacing: -0.5 },
  countBadge: {
    backgroundColor: NAVY,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 2,
  },
  countBadgeText: { fontSize: 11, fontWeight: "700", color: WHITE },
  searchBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  filterScroll: { flexGrow: 0 },
  filterRow: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    gap: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  filterChip: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  filterChipActive: { backgroundColor: NAVY, borderColor: NAVY },
  filterChipLabel: { fontSize: 13, fontWeight: "700", color: NAVY },
  filterChipLabelActive: { color: WHITE },
  filterCount: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
    backgroundColor: SURFACE,
  },
  filterCountActive: { backgroundColor: "rgba(255,255,255,0.18)" },
  filterCountText: { fontSize: 11, fontWeight: "700", color: MUTED },
  filterCountTextActive: { color: WHITE },
  list: { paddingHorizontal: 20, paddingTop: 0, gap: 14 },
  card: {
    backgroundColor: WHITE,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  photoWrap: { height: 158, backgroundColor: SURFACE, position: "relative" },
  photo: { width: "100%", height: "100%" },
  photoGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "transparent",
    // simulated with opacity on overlays via photoTop/photoBottom
  },
  photoTop: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  typeChipText: { fontSize: 11, fontWeight: "700", color: NAVY },
  heartBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  body: { padding: 14, paddingTop: 13 },
  propName: { fontSize: 16.5, fontWeight: "700", color: NAVY, letterSpacing: -0.3, marginBottom: 4 },
  locRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 3 },
  locText: { fontSize: 12.5, fontWeight: "500", color: MUTED, flex: 1 },
  priceRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  priceGroup: { flexDirection: "row", alignItems: "baseline", gap: 2 },
  priceText: { fontSize: 20, fontWeight: "700", color: NAVY, letterSpacing: -0.5 },
  priceUnit: { fontSize: 12.5, fontWeight: "600", color: MUTED },
  priceNA: { fontSize: 13, color: MUTED, fontWeight: "500" },
  viewDetails: { flexDirection: "row", alignItems: "center", gap: 4 },
  viewDetailsText: { fontSize: 13, fontWeight: "700", color: NAVY },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 44,
    paddingBottom: 120,
    gap: 6,
  },
  emptyCircle: {
    width: 88,
    height: 88,
    borderRadius: 999,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 6,
  },
  emptyTitle: { fontSize: 19, fontWeight: "700", color: NAVY, letterSpacing: -0.3 },
  emptySub: {
    fontSize: 13.5,
    color: MUTED,
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 260,
    marginTop: 4,
  },
  emptyBtn: {
    marginTop: 18,
    height: 50,
    paddingHorizontal: 22,
    borderRadius: 15,
    backgroundColor: NAVY,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#1E293B",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
  emptyBtnText: { fontSize: 14.5, fontWeight: "700", color: WHITE },
  noFilterText: { fontSize: 14, color: MUTED, fontWeight: "500" },
});
