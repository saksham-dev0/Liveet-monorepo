import { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useConvex } from "convex/react";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheet } from "../../../components/BottomSheet";
import {
  colors,
  card,
  container,
  errorText,
  footerRow,
  input,
  label,
  primaryButton,
  primaryButtonDisabled,
  primaryButtonText,
  secondaryButton,
  secondaryButtonText,
  sectionHeader,
  title,
} from "../../../constants/theme";

const INDIAN_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh",
  "Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka",
  "Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram",
  "Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana",
  "Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Delhi",
  "Jammu and Kashmir","Ladakh","Puducherry","Chandigarh",
];

export default function AddPropertyBasicScreen() {
  const router = useRouter();
  const convex = useConvex();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [totalUnits, setTotalUnits] = useState("");
  const [vacantUnits, setVacantUnits] = useState("");
  const [pincode, setPincode] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [line1, setLine1] = useState("");
  const [description, setDescription] = useState("");
  const [citySheetOpen, setCitySheetOpen] = useState(false);
  const [stateSheetOpen, setStateSheetOpen] = useState(false);
  const [cities, setCities] = useState<{ _id: string; name: string }[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);

  const openCitySheet = async () => {
    setCitySheetOpen(true);
    setCitiesLoading(true);
    try {
      await (convex as any).mutation("cities:ensureSeeded", {});
      const list = (await (convex as any).query("cities:searchCities", {})) ?? [];
      setCities(list);
    } catch {
      setCities([]);
    } finally {
      setCitiesLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await (convex as any).mutation(
        "onboarding:createOrUpdatePropertyBasics",
        {
          name: name.trim() || undefined,
          totalUnits: totalUnits ? Number(totalUnits) : undefined,
          vacantUnits: vacantUnits ? Number(vacantUnits) : undefined,
          pincode: pincode.trim() || undefined,
          city: city.trim() || undefined,
          state: state.trim() || undefined,
          line1: line1.trim() || undefined,
          description: description.trim() || undefined,
        },
      );
      const newPropertyId = result?.propertyId;
      router.push({
        pathname: "/(app)/add-property/tenant",
        params: { propertyId: newPropertyId },
      } as any);
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const isNextDisabled = saving || !name.trim();

  return (
    <ScrollView
      contentContainerStyle={container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.navy} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>New Property</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={card}>
        <Text style={styles.stepLabel}>Step 1 of 7 · Basic details</Text>
        <Text style={title}>Basic details</Text>

        {error ? <Text style={errorText}>{error}</Text> : null}

        <Text style={label}>Property name</Text>
        <TextInput
          style={input}
          placeholder="e.g. Sunrise Residency"
          placeholderTextColor={colors.muted}
          value={name}
          onChangeText={setName}
        />

        <Text style={label}>Total units</Text>
        <TextInput
          style={input}
          placeholder="Total units"
          placeholderTextColor={colors.muted}
          keyboardType="number-pad"
          value={totalUnits}
          onChangeText={setTotalUnits}
        />

        <Text style={label}>Vacant units</Text>
        <TextInput
          style={input}
          placeholder="Vacant units"
          placeholderTextColor={colors.muted}
          keyboardType="number-pad"
          value={vacantUnits}
          onChangeText={setVacantUnits}
        />

        <Text style={sectionHeader}>Address</Text>

        <Text style={label}>Pincode</Text>
        <TextInput
          style={input}
          placeholder="Pincode"
          placeholderTextColor={colors.muted}
          keyboardType="number-pad"
          value={pincode}
          onChangeText={setPincode}
        />

        <Text style={label}>City</Text>
        <TouchableOpacity style={styles.selector} onPress={openCitySheet} activeOpacity={0.7}>
          <Text style={[styles.selectorText, !city && styles.selectorPlaceholder]}>
            {city || "Select city"}
          </Text>
          <Ionicons name="chevron-down" size={16} color={colors.muted} />
        </TouchableOpacity>

        <Text style={label}>State</Text>
        <TouchableOpacity
          style={styles.selector}
          onPress={() => setStateSheetOpen(true)}
          activeOpacity={0.7}
        >
          <Text style={[styles.selectorText, !state && styles.selectorPlaceholder]}>
            {state || "Select state"}
          </Text>
          <Ionicons name="chevron-down" size={16} color={colors.muted} />
        </TouchableOpacity>

        <Text style={label}>House/Flat/Block no.</Text>
        <TextInput
          style={input}
          placeholder="House/Flat/Block no."
          placeholderTextColor={colors.muted}
          value={line1}
          onChangeText={setLine1}
        />

        <Text style={label}>Description for tenants (optional)</Text>
        <TextInput
          style={[input, styles.descriptionInput]}
          placeholder="Amenities, house rules, neighbourhood, etc."
          placeholderTextColor={colors.muted}
          value={description}
          onChangeText={setDescription}
          multiline
          textAlignVertical="top"
        />

        <View style={footerRow}>
          <TouchableOpacity style={secondaryButton} onPress={handleSave}>
            <Text style={secondaryButtonText}>Save as draft</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[primaryButton, isNextDisabled && primaryButtonDisabled]}
            disabled={isNextDisabled}
            onPress={handleSave}
          >
            <Text style={primaryButtonText}>{saving ? "Saving…" : "Next"}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <BottomSheet
        visible={citySheetOpen}
        onClose={() => setCitySheetOpen(false)}
        title="Select city"
        dismissOnBackdrop
      >
        <ScrollView
          style={styles.sheetScroll}
          contentContainerStyle={styles.sheetContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator
        >
          {citiesLoading ? (
            <ActivityIndicator color={colors.primary} style={styles.sheetLoader} />
          ) : (
            cities.map((c) => (
              <TouchableOpacity
                key={c._id}
                style={styles.sheetOption}
                onPress={() => { setCity(c.name); setCitySheetOpen(false); }}
              >
                <Text style={styles.sheetOptionText}>{c.name}</Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </BottomSheet>

      <BottomSheet
        visible={stateSheetOpen}
        onClose={() => setStateSheetOpen(false)}
        title="Select state"
        dismissOnBackdrop
      >
        <ScrollView
          style={styles.sheetScroll}
          contentContainerStyle={styles.sheetContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator
        >
          {INDIAN_STATES.map((s) => (
            <TouchableOpacity
              key={s}
              style={styles.sheetOption}
              onPress={() => { setState(s); setStateSheetOpen(false); }}
            >
              <Text style={styles.sheetOptionText}>{s}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </BottomSheet>
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
  topBarTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.navy,
  },
  stepLabel: {
    fontSize: 12,
    color: colors.muted,
    marginBottom: 4,
  },
  selector: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.inputBg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  selectorText: { fontSize: 15, color: colors.navy },
  selectorPlaceholder: { color: colors.muted },
  descriptionInput: { minHeight: 120, paddingTop: 12 },
  sheetScroll: { maxHeight: 320 },
  sheetContent: { paddingBottom: 8 },
  sheetLoader: { paddingVertical: 24 },
  sheetOption: { paddingVertical: 12 },
  sheetOptionText: { fontSize: 15, color: colors.navy },
});
