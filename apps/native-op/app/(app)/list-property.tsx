import React, { useState, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useConvex } from "convex/react";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radii } from "../../constants/theme";

// ─── Constants ────────────────────────────────────────────────
const PROPERTY_TYPES = [
  { id: "pg", label: "PG / Hostel", emoji: "🏠" },
  { id: "apartment", label: "Apartment", emoji: "🏢" },
  { id: "villa", label: "Villa / House", emoji: "🏡" },
  { id: "commercial", label: "Commercial", emoji: "🏬" },
];

const OCCUPANCY_TYPES = [
  { id: "single", label: "Single", emoji: "🛏️" },
  { id: "double", label: "Double sharing", emoji: "🛏️🛏️" },
  { id: "triple", label: "Triple sharing", emoji: "3×" },
  { id: "dormitory", label: "Dormitory", emoji: "🏨" },
  { id: "studio", label: "Studio / 1BHK", emoji: "🏠" },
  { id: "2bhk", label: "2BHK+", emoji: "🏡" },
];

const GENDER_OPTIONS = [
  { id: "any", label: "Co-living", emoji: "👥" },
  { id: "male", label: "Male only", emoji: "👨" },
  { id: "female", label: "Female only", emoji: "👩" },
];

const FOOD_OPTIONS = [
  { id: "any", label: "Any", emoji: "🍽️" },
  { id: "veg", label: "Veg only", emoji: "🥗" },
  { id: "nonveg", label: "Non-veg", emoji: "🍗" },
];

const OCCUPATION_OPTIONS = [
  { id: "any", label: "Any", emoji: "🌐" },
  { id: "working", label: "Working", emoji: "💼" },
  { id: "student", label: "Students", emoji: "🎓" },
  { id: "family", label: "Families", emoji: "👨‍👩‍👧" },
];

const ROOM_TYPE_OPTIONS = [
  { id: "single", label: "Single" },
  { id: "double", label: "Double sharing" },
  { id: "triple", label: "Triple sharing" },
  { id: "dormitory", label: "Dormitory" },
  { id: "studio", label: "Studio / 1BHK" },
  { id: "2bhk", label: "2BHK" },
];

const CHARGES = [
  { id: "electricity", label: "Electricity", emoji: "⚡" },
  { id: "water", label: "Water", emoji: "💧" },
  { id: "maintenance", label: "Maintenance", emoji: "🔧" },
  { id: "food", label: "Food charges", emoji: "🍽️" },
  { id: "cleaning", label: "Cleaning", emoji: "🧹" },
];

type RoomPricing = { id: string; roomType: string; rent: string; deposit: string; bookingAmount: string };

// ─── Section header ────────────────────────────────────────────
function SectionTitle({ children }: { children: string }) {
  return <Text style={s.sectionTitle}>{children}</Text>;
}

// ─── Chip grid ────────────────────────────────────────────────
function ChipRow({
  options,
  selected,
  onToggle,
  single,
}: {
  options: { id: string; label: string; emoji?: string }[];
  selected: string | string[] | null;
  onToggle: (id: string) => void;
  single?: boolean;
}) {
  const isSelected = (id: string) =>
    single ? selected === id : Array.isArray(selected) && selected.includes(id);

  return (
    <View style={s.chipRow}>
      {options.map((opt) => {
        const active = isSelected(opt.id);
        return (
          <TouchableOpacity
            key={opt.id}
            style={[s.chip, active && s.chipActive]}
            onPress={() => onToggle(opt.id)}
            activeOpacity={0.7}
          >
            {opt.emoji ? <Text style={s.chipEmoji}>{opt.emoji}</Text> : null}
            <Text style={[s.chipLabel, active && s.chipLabelActive]}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────
export default function ListPropertyScreen() {
  const router = useRouter();
  const convex = useConvex();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Basic
  const [name, setName] = useState("");
  const [propertyType, setPropertyType] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [occupancyType, setOccupancyType] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>([]);

  // Tenant
  const [tenantGender, setTenantGender] = useState<string | null>(null);
  const [tenantFood, setTenantFood] = useState<string | null>(null);
  const [tenantOccupation, setTenantOccupation] = useState<string | null>(null);

  // Rent
  const [agreementDuration, setAgreementDuration] = useState("");
  const [roomPricings, setRoomPricings] = useState<RoomPricing[]>([
    { id: "1", roomType: "", rent: "", deposit: "", bookingAmount: "" },
  ]);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [chargeAmounts, setChargeAmounts] = useState<Record<string, string>>({});

  // Load existing property data
  useEffect(() => {
    (convex as any)
      .query("users:getMyProperty", {})
      .then((prop: any) => {
        if (!prop) return;
        setName(prop.name ?? "");
        setPropertyType(prop.propertyType ?? null);
        setDescription(prop.description ?? "");
        setOccupancyType(prop.occupancyType ?? null);
        setImages(prop.images ?? []);
        setTenantGender(prop.tenantGender ?? null);
        setTenantFood(prop.tenantFood ?? null);
        setTenantOccupation(prop.tenantOccupation ?? null);
        setAgreementDuration(prop.agreementDuration ?? "");
        if (prop.roomPricings?.length) {
          setRoomPricings(
            prop.roomPricings.map((r: any, i: number) => ({ ...r, id: String(i + 1) }))
          );
        }
        if (prop.additionalCharges?.length) {
          const m: Record<string, string> = {};
          for (const c of prop.additionalCharges) m[c.id] = c.amount;
          setChargeAmounts(m);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [convex]);

  // Image picker
  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      const uris = result.assets.map((a) => a.uri);
      setImages((prev) => [...prev, ...uris].slice(0, 10));
    }
  };

  // Room pricings helpers
  const addRoomPricing = () =>
    setRoomPricings((prev) => [
      ...prev,
      { id: Date.now().toString(), roomType: "", rent: "", deposit: "", bookingAmount: "" },
    ]);

  const removeRoomPricing = (id: string) =>
    setRoomPricings((prev) => prev.filter((r) => r.id !== id));

  const updateRoomPricing = (id: string, field: keyof RoomPricing, value: string) =>
    setRoomPricings((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );

  const toggleCharge = (id: string) => {
    setChargeAmounts((prev) => {
      if (id in prev) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return { ...prev, [id]: "" };
    });
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Required", "Property name is required.");
      return;
    }
    setSaving(true);
    try {
      const charges = Object.entries(chargeAmounts).map(([id, amount]) => ({ id, amount }));
      const pricings = roomPricings
        .filter((r) => r.roomType && r.rent)
        .map(({ roomType, rent, deposit, bookingAmount }) => ({ roomType, rent, deposit, bookingAmount: bookingAmount || undefined }));

      await (convex as any).mutation("users:updateMyProperty", {
        name: name.trim(),
        description: description.trim() || undefined,
        occupancyType: occupancyType ?? undefined,
        images: images.length ? images : undefined,
        propertyType: propertyType ?? undefined,
        tenantGender: tenantGender ?? undefined,
        tenantFood: tenantFood ?? undefined,
        tenantOccupation: tenantOccupation ?? undefined,
        agreementDuration: agreementDuration.trim() || undefined,
        roomPricings: pricings.length ? pricings : undefined,
        additionalCharges: charges.length ? charges : undefined,
      });
      Alert.alert("Saved", "Your listing has been updated.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert("Error", "Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[s.root, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={colors.navy} />
      </View>
    );
  }

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={colors.navy} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>List Property</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 120 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Section: Basic ── */}
          <SectionTitle>Basic info</SectionTitle>

          <Text style={s.label}>Property type</Text>
          <View style={s.typeGrid}>
            {PROPERTY_TYPES.map((t) => {
              const active = propertyType === t.id;
              return (
                <TouchableOpacity
                  key={t.id}
                  style={[s.typeCard, active && s.typeCardActive]}
                  onPress={() => setPropertyType(t.id)}
                  activeOpacity={0.7}
                >
                  <Text style={s.typeEmoji}>{t.emoji}</Text>
                  <Text style={[s.typeLabel, active && s.typeLabelActive]}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={s.label}>Property name *</Text>
          <TextInput
            style={s.input}
            placeholder="e.g. Sharma PG Koramangala"
            placeholderTextColor={colors.muted}
            value={name}
            onChangeText={setName}
          />

          <Text style={s.label}>Description</Text>
          <TextInput
            style={[s.input, s.multiline]}
            placeholder="Describe your property — location highlights, rules, vibe..."
            placeholderTextColor={colors.muted}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          <Text style={s.label}>Occupancy type</Text>
          <ChipRow
            options={OCCUPANCY_TYPES}
            selected={occupancyType}
            onToggle={(id) => setOccupancyType(occupancyType === id ? null : id)}
            single
          />

          {/* ── Section: Photos ── */}
          <SectionTitle>Photos</SectionTitle>

          <View style={s.imageGrid}>
            {images.map((uri, i) => (
              <View key={uri + i} style={s.imageTile}>
                <Image source={{ uri }} style={s.imageThumb} resizeMode="cover" />
                <Pressable
                  style={s.imageRemove}
                  onPress={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                >
                  <Ionicons name="close-circle" size={20} color={colors.error} />
                </Pressable>
              </View>
            ))}
            {images.length < 10 && (
              <TouchableOpacity style={s.addImageTile} onPress={pickImages} activeOpacity={0.7}>
                <Ionicons name="camera-outline" size={24} color={colors.muted} />
                <Text style={s.addImageLabel}>Add photos</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={s.hint}>Up to 10 photos. First photo is the cover.</Text>

          {/* ── Section: Tenant preferences ── */}
          <SectionTitle>Tenant preferences</SectionTitle>

          <Text style={s.label}>Gender</Text>
          <ChipRow
            options={GENDER_OPTIONS}
            selected={tenantGender}
            onToggle={(id) => setTenantGender(tenantGender === id ? null : id)}
            single
          />

          <Text style={s.label}>Food</Text>
          <ChipRow
            options={FOOD_OPTIONS}
            selected={tenantFood}
            onToggle={(id) => setTenantFood(tenantFood === id ? null : id)}
            single
          />

          <Text style={s.label}>Preferred tenants</Text>
          <ChipRow
            options={OCCUPATION_OPTIONS}
            selected={tenantOccupation}
            onToggle={(id) => setTenantOccupation(tenantOccupation === id ? null : id)}
            single
          />

          {/* ── Section: Rent & agreement ── */}
          <SectionTitle>Rent & agreement</SectionTitle>

          <Text style={s.label}>Agreement duration</Text>
          <TextInput
            style={s.input}
            placeholder="e.g. 11 months, 1 year"
            placeholderTextColor={colors.muted}
            value={agreementDuration}
            onChangeText={setAgreementDuration}
          />

          <Text style={[s.label, { marginTop: 20 }]}>Rent by room type</Text>
          <Text style={s.hint}>Add pricing for each room type you offer</Text>

          {roomPricings.map((item, index) => (
            <View key={item.id} style={s.roomCard}>
              <View style={s.roomCardHeader}>
                <Text style={s.roomCardTitle}>Room type {index + 1}</Text>
                {roomPricings.length > 1 && (
                  <TouchableOpacity onPress={() => removeRoomPricing(item.id)} activeOpacity={0.7}>
                    <Text style={s.removeBtn}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity
                style={[s.input, s.dropdownTrigger, { marginBottom: openDropdownId === item.id ? 0 : 10 }]}
                onPress={() => setOpenDropdownId(openDropdownId === item.id ? null : item.id)}
                activeOpacity={0.7}
              >
                <Text style={item.roomType ? s.dropdownValue : s.dropdownPlaceholder}>
                  {item.roomType || "Select room type"}
                </Text>
                <Text style={s.dropdownArrow}>{openDropdownId === item.id ? "▲" : "▼"}</Text>
              </TouchableOpacity>
              {openDropdownId === item.id && (
                <View style={s.dropdownList}>
                  {ROOM_TYPE_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.id}
                      style={[s.dropdownOption, item.roomType === opt.label && s.dropdownOptionActive]}
                      onPress={() => {
                        updateRoomPricing(item.id, "roomType", opt.label);
                        setOpenDropdownId(null);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.dropdownOptionText, item.roomType === opt.label && { fontWeight: "700" }]}>
                        {opt.label}
                      </Text>
                      {item.roomType === opt.label && (
                        <Text style={{ color: colors.navy, fontWeight: "700" }}>✓</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <View style={s.rowInputs}>
                <TextInput
                  style={[s.input, s.halfInput]}
                  placeholder="Monthly rent (₹)"
                  placeholderTextColor={colors.muted}
                  keyboardType="number-pad"
                  value={item.rent}
                  onChangeText={(v) => updateRoomPricing(item.id, "rent", v)}
                />
                <TextInput
                  style={[s.input, s.halfInput]}
                  placeholder="Deposit (₹)"
                  placeholderTextColor={colors.muted}
                  keyboardType="number-pad"
                  value={item.deposit}
                  onChangeText={(v) => updateRoomPricing(item.id, "deposit", v)}
                />
              </View>
              <TextInput
                style={s.input}
                placeholder="Booking amount (₹)"
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
                value={item.bookingAmount}
                onChangeText={(v) => updateRoomPricing(item.id, "bookingAmount", v)}
              />
            </View>
          ))}

          <TouchableOpacity style={s.addBtn} onPress={addRoomPricing} activeOpacity={0.7}>
            <Text style={s.addBtnText}>+ Add room type</Text>
          </TouchableOpacity>

          <Text style={[s.label, { marginTop: 24 }]}>Additional charges</Text>
          <Text style={s.hint}>Select charges added on top of rent</Text>
          <View style={s.chipRow}>
            {CHARGES.map((c) => {
              const active = c.id in chargeAmounts;
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[s.chip, active && s.chipActive]}
                  onPress={() => toggleCharge(c.id)}
                  activeOpacity={0.7}
                >
                  <Text style={s.chipEmoji}>{c.emoji}</Text>
                  <Text style={[s.chipLabel, active && s.chipLabelActive]}>{c.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {CHARGES.filter((c) => c.id in chargeAmounts).map((c) => (
            <View key={c.id} style={s.chargeRow}>
              <Text style={s.chargeLabel}>
                {c.emoji} {c.label}
              </Text>
              <TextInput
                style={[s.input, s.chargeInput]}
                placeholder="Amount (₹)"
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
                value={chargeAmounts[c.id]}
                onChangeText={(v) => setChargeAmounts((prev) => ({ ...prev, [c.id]: v }))}
              />
            </View>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Save button pinned at bottom */}
      <View style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[s.saveBtn, saving && s.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={s.saveBtnText}>Save listing</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: colors.inputBg,
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: colors.navy, letterSpacing: -0.3 },

  scroll: { paddingHorizontal: 20, paddingTop: 20 },

  sectionTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: colors.navy,
    letterSpacing: -0.4,
    marginTop: 28,
    marginBottom: 4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 24,
  },

  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.navy,
    marginBottom: 8,
    marginTop: 16,
  },
  hint: { fontSize: 12, color: colors.muted, marginTop: -4, marginBottom: 10 },

  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.input,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 16,
    backgroundColor: colors.inputBg,
    color: colors.navy,
  },
  multiline: {
    minHeight: 100,
    paddingTop: 14,
  },

  // Property type grid
  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  typeCard: {
    minWidth: "44%",
    flex: 1,
    alignItems: "center",
    gap: 6,
    padding: 14,
    borderRadius: radii.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
  },
  typeCardActive: { borderColor: colors.navy, backgroundColor: colors.navy },
  typeEmoji: { fontSize: 24 },
  typeLabel: { fontSize: 13, fontWeight: "600", color: colors.navy, textAlign: "center" },
  typeLabelActive: { color: colors.white },

  // Chips
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
  },
  chipActive: { borderColor: colors.navy, backgroundColor: colors.navy },
  chipEmoji: { fontSize: 14 },
  chipLabel: { fontSize: 13, fontWeight: "500", color: colors.navy },
  chipLabelActive: { color: colors.white },

  // Images
  imageGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  imageTile: { width: 90, height: 90, borderRadius: 12, overflow: "visible" },
  imageThumb: { width: 90, height: 90, borderRadius: 12, backgroundColor: colors.inputBg },
  imageRemove: { position: "absolute", top: -6, right: -6 },
  addImageTile: {
    width: 90,
    height: 90,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: "dashed",
    backgroundColor: colors.inputBg,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  addImageLabel: { fontSize: 11, fontWeight: "600", color: colors.muted },

  // Room pricings
  roomCard: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.card,
    padding: 14,
    backgroundColor: colors.inputBg,
    marginBottom: 12,
  },
  roomCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  roomCardTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  removeBtn: { fontSize: 14, color: colors.muted, fontWeight: "600", paddingHorizontal: 4 },
  dropdownTrigger: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dropdownPlaceholder: { fontSize: 16, color: colors.muted },
  dropdownValue: { fontSize: 16, color: colors.navy, fontWeight: "500" },
  dropdownArrow: { fontSize: 11, color: colors.muted },
  dropdownList: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.input,
    backgroundColor: colors.white,
    marginBottom: 10,
    overflow: "hidden",
  },
  dropdownOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dropdownOptionActive: { backgroundColor: colors.inputBg },
  dropdownOptionText: { fontSize: 15, color: colors.navy },
  rowInputs: { flexDirection: "row", gap: 10 },
  halfInput: { flex: 1, fontSize: 14, paddingVertical: 13 },
  addBtn: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: "dashed",
    borderRadius: radii.card,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 4,
  },
  addBtnText: { fontSize: 14, fontWeight: "600", color: colors.navy },

  // Additional charges
  chargeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 10,
  },
  chargeLabel: { fontSize: 14, fontWeight: "500", color: colors.navy, width: 130 },
  chargeInput: { flex: 1, paddingVertical: 12, fontSize: 15 },

  // Footer save
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.white,
  },
  saveBtn: {
    borderRadius: radii.pill,
    paddingVertical: 17,
    alignItems: "center",
    backgroundColor: colors.navy,
  },
  saveBtnDisabled: { backgroundColor: colors.primaryLight },
  saveBtnText: { fontSize: 16, fontWeight: "700", color: colors.white },
});
