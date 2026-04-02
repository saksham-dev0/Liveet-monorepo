import { useCallback, useEffect, useMemo, useState } from "react";
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
  title,
} from "../../../constants/theme";
import { Ionicons } from "@expo/vector-icons";

const ROOM_CATEGORIES = [
  { key: "single", label: "Single sharing" },
  { key: "double", label: "Double sharing" },
  { key: "triple", label: "Triple sharing" },
  { key: "3plus", label: "3+ sharing" },
] as const;

const BEDS_PER_CATEGORY: Record<string, number> = {
  single: 1, double: 2, triple: 3, "3plus": 4,
};

type RoomOption = {
  _id: string;
  propertyId: string;
  category: string;
  numberOfRooms?: number;
  typeName?: string;
  rentAmount?: number;
};

export default function AddPropertyRoomsScreen() {
  const router = useRouter();
  const convex = useConvex();
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();

  const [loading, setLoading] = useState(true);
  const [roomOptions, setRoomOptions] = useState<RoomOption[]>([]);

  const load = useCallback(async () => {
    if (!propertyId) return;
    try {
      const data = await (convex as any).query("onboarding:getPropertyFlowData", {
        propertyId,
      });
      setRoomOptions(data?.roomOptions ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [convex, propertyId]);

  useEffect(() => { load(); }, [load]);

  const optionsByCategory = useMemo(() => {
    const map: Record<string, RoomOption[]> = {};
    for (const opt of roomOptions) {
      const list = map[opt.category] ?? [];
      list.push(opt);
      map[opt.category] = list;
    }
    return map;
  }, [roomOptions]);

  const totalBeds = useMemo(
    () => roomOptions.reduce((sum, opt) =>
      sum + (opt.numberOfRooms ?? 1) * (BEDS_PER_CATEGORY[opt.category] ?? 1), 0),
    [roomOptions],
  );

  const anyOptionExists = roomOptions.length > 0;

  return (
    <ScrollView contentContainerStyle={container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.navy} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>New Property</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={card}>
        <Text style={styles.stepLabel}>Step 3 of 7 · Room options</Text>
        <Text style={title}>Room options</Text>

        {loading && (
          <View style={loadingRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={loadingText}>Loading…</Text>
          </View>
        )}

        {ROOM_CATEGORIES.map((cat) => {
          const items = optionsByCategory[cat.key] ?? [];
          const beds = items.reduce((sum, opt) =>
            sum + (opt.numberOfRooms ?? 1) * (BEDS_PER_CATEGORY[opt.category] ?? 1), 0);
          const summary = items.length === 0
            ? "No options added yet"
            : `${items.length} option${items.length > 1 ? "s" : ""}${beds > 0 ? ` · ${beds} beds` : ""}`;
          return (
            <TouchableOpacity
              key={cat.key}
              style={styles.row}
              onPress={() => router.push({
                pathname: "/(app)/add-property/room-category",
                params: { propertyId, category: cat.key },
              } as any)}
            >
              <View>
                <Text style={styles.rowTitle}>{cat.label}</Text>
                <Text style={styles.rowSubtitle}>{summary}</Text>
              </View>
              <Text style={styles.rowAction}>+ Add room</Text>
            </TouchableOpacity>
          );
        })}

        {anyOptionExists && (
          <Text style={styles.totalBeds}>Total beds from options: {totalBeds}</Text>
        )}

        <View style={styles.footerRow}>
          <TouchableOpacity
            style={[primaryButton, { alignSelf: "stretch" as const, flex: undefined }, (!anyOptionExists || !propertyId) && primaryButtonDisabled]}
            disabled={!anyOptionExists || !propertyId}
            onPress={() => router.push({
              pathname: "/(app)/add-property/room-config",
              params: { propertyId },
            } as any)}
          >
            <Text style={primaryButtonText}>Next</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 8,
  },
  topBarTitle: { fontSize: 17, fontWeight: "700", color: colors.navy },
  stepLabel: { fontSize: 12, color: colors.muted, marginBottom: 4 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowTitle: { fontSize: 15, fontWeight: "500", color: colors.navy },
  rowSubtitle: { fontSize: 12, color: colors.muted, marginTop: 2 },
  rowAction: { fontSize: 13, fontWeight: "600", color: colors.primary },
  totalBeds: { fontSize: 13, color: colors.muted, marginTop: 12, fontWeight: "500" },
  footerRow: { marginTop: 28 },
});
