import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useConvex } from "convex/react";
import {
  colors,
  radii,
  cardShadow,
  container as containerStyle,
  primaryButton,
  primaryButtonText,
  secondaryButton,
  secondaryButtonText,
  footerRow,
} from "@/constants/theme";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */
type RoomOption = {
  _id: string;
  category: string;
  typeName?: string;
  rentAmount?: number;
  numberOfRooms?: number;
  attachedWashroom?: boolean;
  attachedBalcony?: boolean;
  airConditioner?: boolean;
  geyser?: boolean;
  customFeatures?: string[];
};

type RoomDraft = {
  typeName: string;
  rentAmount: string;
  attachedWashroom: boolean;
  attachedBalcony: boolean;
  airConditioner: boolean;
  geyser: boolean;
  customFeatures: string;
};

/* ------------------------------------------------------------------ */
/* Constants                                                            */
/* ------------------------------------------------------------------ */
const CATEGORY_META: Record<
  string,
  { label: string; icon: keyof typeof Ionicons.glyphMap; accent: string; bg: string }
> = {
  single: { label: "Single Room", icon: "person-outline", accent: "#6366F1", bg: "#EEF2FF" },
  double: { label: "Double Room", icon: "people-outline", accent: "#0EA5E9", bg: "#E0F2FE" },
  triple: { label: "Triple Room", icon: "people-circle-outline", accent: "#10B981", bg: "#D1FAE5" },
  "3plus": { label: "Shared Room", icon: "home-outline", accent: "#F59E0B", bg: "#FEF3C7" },
};

const AMENITIES: {
  key: keyof Omit<RoomDraft, "typeName" | "rentAmount" | "customFeatures">;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: "attachedWashroom", label: "Attached washroom", icon: "water-outline" },
  { key: "attachedBalcony", label: "Attached balcony", icon: "sunny-outline" },
  { key: "airConditioner", label: "Air conditioner", icon: "snow-outline" },
  { key: "geyser", label: "Geyser", icon: "flame-outline" },
];

function initDraft(opt: RoomOption): RoomDraft {
  const fallback = CATEGORY_META[opt.category]?.label ?? opt.category;
  return {
    typeName: opt.typeName ?? fallback,
    rentAmount: opt.rentAmount != null ? String(opt.rentAmount) : "",
    attachedWashroom: opt.attachedWashroom ?? false,
    attachedBalcony: opt.attachedBalcony ?? false,
    airConditioner: opt.airConditioner ?? false,
    geyser: opt.geyser ?? false,
    customFeatures: (opt.customFeatures ?? []).join(", "),
  };
}

/* ------------------------------------------------------------------ */
/* Screen                                                               */
/* ------------------------------------------------------------------ */
export default function EditRoomConfigScreen() {
  const router = useRouter();
  const convex = useConvex();
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();

  const [loading, setLoading] = useState(true);
  const [roomOptions, setRoomOptions] = useState<RoomOption[]>([]);
  const [drafts, setDrafts] = useState<Record<string, RoomDraft>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!propertyId) return;
    (async () => {
      try {
        const data = await (convex as any).query(
          "onboarding:getPropertyFlowData",
          { propertyId },
        );
        const opts: RoomOption[] = data?.roomOptions ?? [];
        setRoomOptions(opts);
        const initial: Record<string, RoomDraft> = {};
        const exp: Record<string, boolean> = {};
        for (const opt of opts) {
          initial[opt._id] = initDraft(opt);
          exp[opt._id] = true; // all expanded by default
        }
        setDrafts(initial);
        setExpanded(exp);
      } finally {
        setLoading(false);
      }
    })();
  }, [convex, propertyId]);

  const updateDraft = useCallback(
    (id: string, patch: Partial<RoomDraft>) => {
      setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
    },
    [],
  );

  const toggleExpanded = useCallback((id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const updates = roomOptions
        .map((opt) => {
          const draft = drafts[opt._id];
          if (!draft) return null;
          const rent = parseFloat(draft.rentAmount);
          const features = draft.customFeatures
            .split(",")
            .map((f) => f.trim())
            .filter(Boolean);
          return {
            roomOptionId: opt._id,
            typeName: draft.typeName === "" ? null : draft.typeName,
            rentAmount: isNaN(rent) ? null : rent,
            attachedWashroom: draft.attachedWashroom,
            attachedBalcony: draft.attachedBalcony,
            airConditioner: draft.airConditioner,
            geyser: draft.geyser,
            customFeatures: features.length === 0 ? [] : features,
          };
        })
        .filter(Boolean);

      await (convex as any).mutation("onboarding:updateRoomOptions", { updates });
      Alert.alert("Saved", "Room configurations updated.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  }, [convex, roomOptions, drafts, router]);

  /* ---------- loading ---------- */
  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={s.loadingText}>Loading room types…</Text>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header bar ── */}
        <View style={s.headerBar}>
          <TouchableOpacity
            style={s.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color={colors.navy} />
          </TouchableOpacity>
          <View style={s.headerCenter}>
            <Text style={s.headerTitle}>Room amenities</Text>
            <Text style={s.headerSub}>{roomOptions.length} room type{roomOptions.length !== 1 ? "s" : ""} imported</Text>
          </View>
          <TouchableOpacity
            style={s.skipBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Text style={s.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>

        {/* ── Info banner ── */}
        <View style={s.banner}>
          <Ionicons name="sparkles-outline" size={16} color="#6366F1" />
          <Text style={s.bannerText}>
            AI extracted room types from your file. Add amenities so tenants
            know exactly what they're getting.
          </Text>
        </View>

        {/* ── Empty state ── */}
        {roomOptions.length === 0 && (
          <View style={s.emptyCard}>
            <Ionicons name="bed-outline" size={40} color={colors.border} />
            <Text style={s.emptyTitle}>No room types found</Text>
            <Text style={s.emptyHint}>
              Go back and re-import your file, or add rooms manually later.
            </Text>
          </View>
        )}

        {/* ── Room cards ── */}
        {roomOptions.map((opt, idx) => {
          const meta = CATEGORY_META[opt.category] ?? {
            label: opt.category,
            icon: "bed-outline" as keyof typeof Ionicons.glyphMap,
            accent: colors.primary,
            bg: colors.surfaceGray,
          };
          const draft = drafts[opt._id];
          if (!draft) return null;
          const isOpen = expanded[opt._id];
          const count = opt.numberOfRooms ?? 1;
          const amenityCount = AMENITIES.filter((a) => draft[a.key]).length;

          return (
            <View key={opt._id} style={s.card}>
              {/* Accent stripe */}
              <View style={[s.accentStripe, { backgroundColor: meta.accent }]} />

              {/* Card content */}
              <View style={s.cardInner}>
                {/* ── Card header (tap to expand) ── */}
                <TouchableOpacity
                  style={s.cardHeader}
                  onPress={() => toggleExpanded(opt._id)}
                  activeOpacity={0.7}
                >
                  <View style={[s.iconBadge, { backgroundColor: meta.bg }]}>
                    <Ionicons name={meta.icon} size={20} color={meta.accent} />
                  </View>
                  <View style={s.cardHeaderText}>
                    <Text style={s.cardTitle}>{draft.typeName || meta.label}</Text>
                    <Text style={s.cardMeta}>
                      {count} room{count !== 1 ? "s" : ""}
                      {amenityCount > 0 ? ` · ${amenityCount} amenit${amenityCount !== 1 ? "ies" : "y"}` : ""}
                      {draft.rentAmount ? ` · ₹${draft.rentAmount}/mo` : ""}
                    </Text>
                  </View>
                  <Ionicons
                    name={isOpen ? "chevron-up" : "chevron-down"}
                    size={18}
                    color={colors.muted}
                  />
                </TouchableOpacity>

                {/* ── Expanded content ── */}
                {isOpen && (
                  <View style={s.cardBody}>
                    <View style={s.divider} />

                    {/* Type name + rent in row */}
                    <View style={s.row2}>
                      <View style={s.flex1}>
                        <Text style={s.fieldLabel}>Type name</Text>
                        <TextInput
                          style={s.input}
                          value={draft.typeName}
                          onChangeText={(v) => updateDraft(opt._id, { typeName: v })}
                          placeholder="e.g. Premium Single"
                          placeholderTextColor={colors.muted}
                        />
                      </View>
                      <View style={s.gap12} />
                      <View style={s.rentField}>
                        <Text style={s.fieldLabel}>Rent (₹/mo)</Text>
                        <TextInput
                          style={s.input}
                          value={draft.rentAmount}
                          onChangeText={(v) => updateDraft(opt._id, { rentAmount: v })}
                          keyboardType="numeric"
                          placeholder="8000"
                          placeholderTextColor={colors.muted}
                        />
                      </View>
                    </View>

                    {/* Amenities section */}
                    <Text style={s.sectionLabel}>Amenities</Text>
                    <View style={s.amenityGrid}>
                      {AMENITIES.map((am) => {
                        const on = draft[am.key] as boolean;
                        return (
                          <TouchableOpacity
                            key={am.key}
                            style={[
                              s.amenityChip,
                              on && { backgroundColor: meta.bg, borderColor: meta.accent },
                            ]}
                            onPress={() =>
                              updateDraft(opt._id, { [am.key]: !on })
                            }
                            activeOpacity={0.75}
                          >
                            <Ionicons
                              name={am.icon}
                              size={16}
                              color={on ? meta.accent : colors.muted}
                            />
                            <Text
                              style={[
                                s.amenityChipText,
                                on && { color: meta.accent, fontWeight: "600" },
                              ]}
                            >
                              {am.label}
                            </Text>
                            {on && (
                              <Ionicons
                                name="checkmark-circle"
                                size={14}
                                color={meta.accent}
                              />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {/* Custom features */}
                    <Text style={s.fieldLabel}>Other features</Text>
                    <TextInput
                      style={[s.input, s.inputMulti]}
                      value={draft.customFeatures}
                      onChangeText={(v) => updateDraft(opt._id, { customFeatures: v })}
                      placeholder="Study table, Wardrobe, TV… (comma-separated)"
                      placeholderTextColor={colors.muted}
                      multiline
                    />
                  </View>
                )}
              </View>
            </View>
          );
        })}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ── Sticky footer ── */}
      <View style={s.stickyFooter}>
        <TouchableOpacity
          style={[primaryButton, s.saveBtn, saving && s.btnDisabled]}
          onPress={handleSave}
          activeOpacity={0.8}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
              <Text style={[primaryButtonText, { marginLeft: 8 }]}>Save & continue</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Styles                                                               */
/* ------------------------------------------------------------------ */
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 60 : 24,
    paddingBottom: 16,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: { fontSize: 14, color: colors.muted },

  /* Header */
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    ...cardShadow,
    shadowOpacity: 0.05,
    elevation: 2,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.navy,
  },
  headerSub: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 1,
  },
  skipBtn: {
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  skipText: {
    fontSize: 14,
    color: colors.muted,
    fontWeight: "500",
  },

  /* Banner */
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#EEF2FF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
  },
  bannerText: {
    flex: 1,
    fontSize: 13,
    color: "#4338CA",
    lineHeight: 19,
  },

  /* Empty */
  emptyCard: {
    alignItems: "center",
    paddingVertical: 48,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.navy,
  },
  emptyHint: {
    fontSize: 13,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 19,
    paddingHorizontal: 20,
  },

  /* Card */
  card: {
    flexDirection: "row",
    backgroundColor: colors.white,
    borderRadius: radii.card,
    marginBottom: 14,
    overflow: "hidden",
    ...cardShadow,
    shadowOpacity: 0.07,
    elevation: 3,
  },
  accentStripe: {
    width: 4,
    borderRadius: 4,
  },
  cardInner: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cardHeaderText: { flex: 1 },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.navy,
  },
  cardMeta: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },

  /* Card body */
  cardBody: { marginTop: 4 },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 16,
    marginTop: 12,
  },

  /* Row layout */
  row2: { flexDirection: "row", alignItems: "flex-start" },
  flex1: { flex: 1 },
  rentField: { width: 110 },
  gap12: { width: 12 },

  /* Fields */
  fieldLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.muted,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.navy,
    marginTop: 16,
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: colors.inputBg,
    borderRadius: radii.input,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.navy,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputMulti: {
    minHeight: 56,
    textAlignVertical: "top",
    marginBottom: 4,
  },

  /* Amenity chips */
  amenityGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  amenityChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.inputBg,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  amenityChipText: {
    fontSize: 13,
    color: colors.muted,
    fontWeight: "500",
  },

  /* Footer */
  stickyFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    ...cardShadow,
    shadowOpacity: 0.12,
    elevation: 10,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  btnDisabled: { opacity: 0.6 },
});
