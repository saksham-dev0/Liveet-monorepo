import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useConvex } from "convex/react";
import { colors, radii } from "../../constants/theme";

type City = { _id: string; name: string };

export default function CitiesModal() {
  const router = useRouter();
  const convex = useConvex();
  const { selectedIds: selectedIdsParam } =
    useLocalSearchParams<{ selectedIds?: string }>();

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [cities, setCities] = useState<City[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedCities, setSelectedCities] = useState<City[]>([]);

  useEffect(() => {
    if (selectedIdsParam) {
      const ids = String(selectedIdsParam)
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
      setSelectedIds(new Set(ids));
    }
  }, [selectedIdsParam]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        await (convex as any).mutation("cities:ensureSeeded", {});
        const result: City[] =
          (await (convex as any).query("cities:searchCities", {
            searchTerm: search,
          })) ?? [];
        if (!cancelled) {
          setCities(result);
        }
      } catch {
        if (!cancelled) setCities([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [convex, search]);

  useEffect(() => {
    // Keep full City objects for all selected ids, even across searches
    setSelectedCities((prev) => {
      const map = new Map<string, City>();
      // preserve previously known cities that are still selected
      for (const c of prev) {
        if (selectedIds.has(c._id)) {
          map.set(c._id, c);
        }
      }
      // add any cities from current search results that are selected
      for (const c of cities) {
        if (selectedIds.has(c._id)) {
          map.set(c._id, c);
        }
      }
      return Array.from(map.values());
    });
  }, [cities, selectedIds]);

  const toggleCity = (city: City) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(city._id)) {
        next.delete(city._id);
      } else {
        next.add(city._id);
      }
      return next;
    });
    setSelectedCities((prev) => {
      const map = new Map<string, City>();
      for (const c of prev) {
        map.set(c._id, c);
      }
      if (map.has(city._id)) {
        map.delete(city._id);
      } else {
        map.set(city._id, city);
      }
      return Array.from(map.values());
    });
  };

  const handleApply = () => {
    const citiesJson = JSON.stringify(selectedCities);
    router.replace({
      pathname: "/(onboarding)/personal-details",
      params: { citiesJson },
    } as any);
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.backText}>{"\u2190"} Close</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Add cities</Text>
        <View style={{ width: 60 }} />
      </View>

      <TextInput
        style={s.searchInput}
        placeholder="Search cities..."
        placeholderTextColor={colors.muted}
        value={search}
        onChangeText={setSearch}
      />

      <Text style={s.helper}>Select cities where you operate</Text>

      {loading ? (
        <View style={s.loadingCenter}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={cities}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => {
            const checked = selectedIds.has(item._id);
            return (
              <TouchableOpacity
                style={s.cityRow}
                onPress={() => toggleCity(item)}
              >
                <Text style={s.cityName}>{item.name}</Text>
                <View style={[s.checkbox, checked && s.checkboxChecked]}>
                  {checked && <Text style={s.checkboxTick}>✓</Text>}
                </View>
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={s.listContent}
        />
      )}

      <TouchableOpacity
        style={[
          s.applyBtn,
          selectedCities.length === 0 && s.applyBtnDisabled,
        ]}
        disabled={selectedCities.length === 0}
        onPress={handleApply}
      >
        <Text style={s.applyBtnText}>Add</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    paddingTop: 4,
  },
  backText: { fontSize: 15, color: colors.primary, fontWeight: "700" },
  headerTitle: { fontSize: 18, fontWeight: "800", color: colors.navy },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.inputBg,
    color: colors.navy,
    fontSize: 15,
    marginBottom: 12,
  },
  helper: { fontSize: 12, fontWeight: "500", color: colors.muted, marginBottom: 8 },
  loadingCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
  listContent: { paddingVertical: 4 },
  cityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  cityName: { fontSize: 15, fontWeight: "500", color: colors.navy },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radii.checkbox,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxTick: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.white,
    lineHeight: 18,
  },
  applyBtn: {
    marginTop: 8,
    marginBottom: 28,
    borderRadius: radii.pill,
    paddingVertical: 15,
    alignItems: "center",
    backgroundColor: colors.primary,
  },
  applyBtnDisabled: { backgroundColor: colors.primaryLight },
  applyBtnText: { fontSize: 16, fontWeight: "700", color: colors.white },
});
