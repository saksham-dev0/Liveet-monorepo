import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useConvex } from "convex/react";
import { useRouter } from "expo-router";
import { colors, radii, cardShadow } from "../../constants/theme";

type LikedProperty = {
  _id: string;
  name?: string;
  city?: string;
  state?: string;
  coverImageUrl?: string | null;
  roomOptions?: { rentAmount?: number | null }[];
  tenantDetails?: {
    canStayMale?: boolean | null;
    canStayFemale?: boolean | null;
    canStayOthers?: boolean | null;
  } | null;
};

type CardModel = {
  id: string;
  name: string;
  role: string;
  rentText: string;
  occupancyText: string;
  location: string;
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

function getOccupancyLabel(d: LikedProperty["tenantDetails"]): string {
  if (!d) return "-";
  const m = !!d.canStayMale;
  const f = !!d.canStayFemale;
  const o = !!d.canStayOthers;

  // Design request: show "female only" when applicable.
  if (f && !m && !o) return "Female only";
  if (m && !f && !o) return "Male only";
  if (o && !m && !f) return "Others only";
  return "Co-living";
}

function toCardModel(p: LikedProperty): CardModel {
  const loc = [p.city, p.state].filter(Boolean).join(", ") || "San Francisco";
  const rentRange = getRentRange(p.roomOptions);
  const rentText =
    rentRange == null
      ? "\u20B9-"
      : `\u20B9${formatAmount(rentRange.min)}${
          rentRange.max !== rentRange.min
            ? ` - \u20B9${formatAmount(rentRange.max)}`
            : ""
        }`;

  return {
    id: p._id,
    name: p.name || "Unnamed Property",
    role: "Liked property",
    rentText,
    occupancyText: getOccupancyLabel(p.tenantDetails),
    location: loc,
  };
}

export default function FavoritesScreen() {
  const convex = useConvex();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [liked, setLiked] = useState<LikedProperty[]>([]);
  const [moveInPropertyIds, setMoveInPropertyIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"All" | "Shortlisted" | "Interview" | "Offer">(
    "All",
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const [result, moveInMap] = await Promise.all([
          (convex as any).query("properties:listLikedForTenants", {}),
          (convex as any).query("moveIn:listTenantMoveInApplicationPropertyIds", {}),
        ]);
        if (!cancelled) {
          setLiked((result ?? []) as LikedProperty[]);
          setMoveInPropertyIds((moveInMap?.propertyIds ?? []) as string[]);
        }
      } catch (e) {
        // UI-only: keep the screen usable even if the query fails.
        console.warn("Failed to load favorites:", e);
        if (!cancelled) {
          setLiked([]);
          setMoveInPropertyIds([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [convex]);

  const cards = useMemo(() => liked.map(toCardModel), [liked]);
  const showEmpty = !loading && liked.length === 0;

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          style={s.headerBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={18} color={colors.navy} />
        </TouchableOpacity>

        <View style={s.hCenter}>
          <Text style={s.hTitle}>Liked Properties</Text>
        </View>

        <TouchableOpacity
          style={s.headerBtn}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Calendar"
        >
          {/* TODO: Add pending request section */}
          <Ionicons name="calendar-outline" size={18} color={colors.navy} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={s.searchWrap}>
        <Ionicons name="search" size={16} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search candidate or roles"
          placeholderTextColor="rgba(107,114,128,0.9)"
          style={s.searchInput}
          // UI-only: no search behavior yet.
          editable={!loading}
        />
        <View style={s.filterIconWrap}>
          <Ionicons name="options-outline" size={16} color={colors.muted} />
        </View>
      </View>

      {/* Section */}
      {!loading && liked.length > 0 && (
        <View style={s.sectionHeaderRow}>
          <Text style={s.sectionTitle}>Recent activity</Text>
        </View>
      )}

      {/* List */}
      {loading && !liked.length ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : showEmpty ? (
        <View style={s.emptyWrap}>
          <View style={s.emptyIconCircle}>
            <Ionicons name="heart-outline" size={40} color={colors.muted} />
          </View>
          <Text style={s.emptyTitle}>Nothing liked yet</Text>
          <Text style={s.emptySubtitle}>
            When you save properties, they will show up here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={cards}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.listContent}
          renderItem={({ item }) => {
            const hasMoveInRequest = moveInPropertyIds.includes(item.id);
            return (
              <TouchableOpacity
                style={s.card}
                activeOpacity={0.85}
                onPress={() => router.push(`/(app)/favorites/${item.id}`)}
                accessibilityRole="button"
                accessibilityLabel={`Open details for ${item.name}`}
              >
                <View style={s.cardTopRow}>
                  <View style={s.avatar}>
                    <Ionicons name="business-outline" size={18} color={colors.white} />
                  </View>

                  <View style={s.cardTopText}>
                    <Text style={s.cardName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={s.cardRole} numberOfLines={1}>
                      {item.role}
                    </Text>
                  </View>

                  <View style={s.percentBadge}>
                    <Text style={s.percentText}>{item.rentText}</Text>
                  </View>
                </View>

                <View style={s.metaRow}>
                  <View style={s.metaLeft}>
                    <Ionicons name="woman-outline" size={14} color={colors.muted} />
                    <Text style={s.metaText}>{item.occupancyText}</Text>
                  </View>
                  <View style={s.metaLeft}>
                    <Ionicons name="location-outline" size={14} color={colors.muted} />
                    <Text style={s.metaText}>{item.location}</Text>
                  </View>
                </View>

                <View style={s.cardActionsRow}>
                  <TouchableOpacity
                    style={[s.actionBtn, s.actionBtnOutline]}
                    activeOpacity={0.7}
                    onPress={() => router.push(`/(app)/favorites/move-in/${item.id}`)}
                  >
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={16}
                      color={colors.navy}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={[s.actionBtnText, s.actionBtnOutlineText]}>
                      {hasMoveInRequest ? "Edit request" : "Ready to move-in"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[s.actionBtn, s.actionBtnFilled]}
                    activeOpacity={0.7}
                    onPress={() => {}}
                  >
                    <Ionicons
                      name="chatbubble-ellipses-outline"
                      size={16}
                      color={colors.white}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={s.actionBtnFilledText}>Contact owner</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Keep unused state referenced to avoid lint noise; functionality will be added later. */}
      <View style={s.hiddenFooter} pointerEvents="none">
        <Text>{activeTab}</Text>
        <Text>{query}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg, paddingHorizontal: 16 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    paddingTop: 4,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: colors.white,
    borderWidth: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  hCenter: { flex: 1, alignItems: "center" },
  hTitle: { fontSize: 22, fontWeight: "800", color: colors.navy, lineHeight: 24 },

  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.inputBg,
    borderRadius: radii.input,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 0,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    fontWeight: "600",
    color: colors.navy,
    paddingVertical: 0,
  },
  filterIconWrap: {
    width: 22,
    alignItems: "center",
  },

  tabsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 18,
    paddingHorizontal: 4,
  },
  tabPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 0,
    backgroundColor: colors.inputBg,
  },
  tabPillActive: {
    backgroundColor: colors.primary,
    borderWidth: 0,
  },
  tabText: { fontSize: 13, fontWeight: "700", color: colors.navy },
  tabTextActive: { color: colors.white },

  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.muted },

  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },

  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingBottom: 40,
  },
  emptyIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.inputBg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.navy,
    textAlign: "center",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.muted,
    textAlign: "center",
    lineHeight: 20,
  },

  listContent: {
    paddingBottom: 22,
  },

  card: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 16,
    borderWidth: 0,
    ...cardShadow,
    marginBottom: 14,
  },

  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTopText: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: "800", color: colors.navy },
  cardRole: { fontSize: 12, fontWeight: "600", color: colors.muted, marginTop: 2 },

  percentBadge: {
    backgroundColor: colors.white,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  percentText: { fontSize: 12, fontWeight: "900", color: colors.navy },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  metaLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaText: { fontSize: 12, fontWeight: "600", color: colors.muted },

  cardActionsRow: { flexDirection: "row", gap: 12 },
  actionBtn: {
    flex: 1,
    borderRadius: radii.input,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  actionBtnText: { fontSize: 13, fontWeight: "800" },
  actionBtnOutline: {
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  actionBtnOutlineText: { color: colors.navy, fontSize: 13, fontWeight: "800" },
  actionBtnFilled: {
    backgroundColor: colors.primary,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  actionBtnFilledText: { color: colors.white, fontSize: 13, fontWeight: "800" },

  hiddenFooter: {
    height: 0,
    width: 0,
    overflow: "hidden",
  },
});

