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
          const bedsInCategory = items.reduce(
            (sum, opt) =>
              sum + (opt.numberOfRooms ?? 1) * (BEDS_PER_CATEGORY[opt.category] ?? 1),
            0,
          );
          const summary =
            items.length === 0
              ? "No options added yet"
              : `${items.length} option${items.length > 1 ? "s" : ""}${bedsInCategory > 0 ? ` · ${bedsInCategory} beds` : ""}`;
          return (
            <TouchableOpacity
              key={category.key}
              style={styles.row}
              onPress={() => handleOpenCategory(category.key)}
            >
              <View>
                <Text style={styles.rowTitle}>{category.label}</Text>
                <Text style={styles.rowSubtitle}>{summary}</Text>
              </View>
              <Text style={styles.rowAction}>+ Add room</Text>
            </TouchableOpacity>
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
    fontWeight: "500",
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
});
