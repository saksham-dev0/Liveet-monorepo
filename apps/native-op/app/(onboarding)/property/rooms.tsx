import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useConvex } from "convex/react";
import { Ionicons } from "@expo/vector-icons";
import {
  colors,
  card,
  container,
  loadingRow,
  loadingText,
  primaryButton,
  primaryButtonDisabled,
  primaryButtonText,
  stepLabel,
  title,
  radii,
} from "../../../constants/theme";

const fullWidthPrimaryBtn = {
  ...primaryButton,
  flex: undefined,
  alignSelf: "stretch" as const,
};

const ROOM_CATEGORIES = [
  { key: "single", label: "Single sharing" },
  { key: "double", label: "Double sharing" },
  { key: "triple", label: "Triple sharing" },
  { key: "3plus", label: "3+ sharing" },
] as const;

const BEDS_PER_CATEGORY: Record<string, number> = {
  single: 1,
  double: 2,
  triple: 3,
  "3plus": 4,
};

type RoomOption = {
  _id: string;
  propertyId: string;
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

export default function RoomOptionsScreen() {
  const router = useRouter();
  const convex = useConvex();
  const { propertyId: propertyIdParam } = useLocalSearchParams<{
    propertyId?: string;
  }>();

  const [loading, setLoading] = useState(true);
  const [propertyId, setPropertyId] = useState<string | null>(
    propertyIdParam ? String(propertyIdParam) : null,
  );
  const [roomOptions, setRoomOptions] = useState<RoomOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await (convex as any).query(
          "onboarding:getOnboardingStatus",
          {},
        );
        if (cancelled || !status) return;
        if (status.property && !propertyId) {
          setPropertyId(status.property._id);
        }
        if (status.roomOptions) {
          setRoomOptions(status.roomOptions);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [convex, propertyId]);

  const optionsByCategory = useMemo(() => {
    const map: Record<string, RoomOption[]> = {};
    for (const opt of roomOptions) {
      const list = map[opt.category] ?? [];
      list.push(opt);
      map[opt.category] = list;
    }
    return map;
  }, [roomOptions]);

  const totalBedsFromOptions = useMemo(
    () =>
      roomOptions.reduce(
        (sum, opt) =>
          sum + (opt.numberOfRooms ?? 1) * (BEDS_PER_CATEGORY[opt.category] ?? 1),
        0,
      ),
    [roomOptions],
  );

  const anyOptionExists = roomOptions.length > 0;

  const handleOpenCategory = (category: string) => {
    if (!propertyId) return;
    router.push({
      pathname: "/(onboarding)/property/room-category",
      params: { propertyId, category },
    } as any);
  };

  const handleEditOption = (opt: RoomOption) => {
    if (!propertyId) return;
    router.push({
      pathname: "/(onboarding)/property/room-category",
      params: { propertyId, category: opt.category, editOptionId: opt._id },
    } as any);
  };

  const handleProceed = () => {
    if (!propertyId) return;
    router.push({
      pathname: "/(onboarding)/property/room-config",
      params: { propertyId },
    } as any);
  };

  return (
    <ScrollView contentContainerStyle={container}>
      <View style={card}>
        <Text style={stepLabel}>Step 3 of 7 · Room options</Text>
        <Text style={title}>Room options</Text>

        {loading && (
          <View style={loadingRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={loadingText}>Loading room options...</Text>
          </View>
        )}

        {ROOM_CATEGORIES.map((category) => {
          const items = optionsByCategory[category.key] ?? [];
          return (
            <View key={category.key} style={styles.categoryBlock}>
              {/* Category header row */}
              <View style={styles.categoryHeader}>
                <Text style={styles.rowTitle}>{category.label}</Text>
                <TouchableOpacity
                  style={styles.addChip}
                  onPress={() => handleOpenCategory(category.key)}
                >
                  <Ionicons name="add" size={14} color={colors.primary} />
                  <Text style={styles.addChipText}>Add room</Text>
                </TouchableOpacity>
              </View>

              {/* Existing options */}
              {items.length === 0 ? (
                <Text style={styles.emptyHint}>No options added yet</Text>
              ) : (
                items.map((opt) => {
                  const amenityCount = [
                    opt.attachedWashroom,
                    opt.attachedBalcony,
                    opt.airConditioner,
                    opt.geyser,
                  ].filter(Boolean).length;
                  const customCount = opt.customFeatures?.length ?? 0;
                  const totalAmenities = amenityCount + customCount;
                  return (
                    <View key={opt._id} style={styles.optionCard}>
                      <View style={styles.optionLeft}>
                        <Text style={styles.optionName}>
                          {opt.typeName || category.label}
                        </Text>
                        <Text style={styles.optionMeta}>
                          {opt.numberOfRooms ?? 1} room{(opt.numberOfRooms ?? 1) !== 1 ? "s" : ""}
                          {opt.rentAmount ? ` · ₹${opt.rentAmount}/mo` : ""}
                          {totalAmenities > 0 ? ` · ${totalAmenities} amenit${totalAmenities !== 1 ? "ies" : "y"}` : " · No amenities"}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.editBtn}
                        onPress={() => handleEditOption(opt)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="pencil-outline" size={15} color={colors.primary} />
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
            </View>
          );
        })}

        {anyOptionExists && (
          <Text style={styles.totalBeds}>
            Total beds from room options: {totalBedsFromOptions}
          </Text>
        )}

        <View style={styles.footerRow}>
          <TouchableOpacity
            style={[
              fullWidthPrimaryBtn,
              (!anyOptionExists || !propertyId) && primaryButtonDisabled,
            ]}
            disabled={!anyOptionExists || !propertyId}
            onPress={handleProceed}
          >
            <Text style={primaryButtonText}>Next</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.navy,
  },
  rowSubtitle: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  rowAction: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primary,
  },
  totalBeds: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 12,
    fontWeight: "500",
  },
  footerRow: {
    marginTop: 28,
  },
  /* new */
  categoryBlock: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 8,
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  addChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  addChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary,
  },
  emptyHint: {
    fontSize: 12,
    color: colors.muted,
    fontStyle: "italic",
    paddingLeft: 2,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.inputBg,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionLeft: { flex: 1 },
  optionName: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.navy,
  },
  optionMeta: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  editBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
});
