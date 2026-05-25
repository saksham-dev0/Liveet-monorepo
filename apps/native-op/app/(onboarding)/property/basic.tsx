import { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { StepHeader } from "../../../components/StepHeader";
import { colors, radii } from "../../../constants/theme";
import { useOnboarding } from "../../../context/OnboardingContext";

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Delhi", "Jammu and Kashmir", "Ladakh", "Puducherry", "Chandigarh",
];

const PROPERTY_TYPES = [
  { id: "pg", label: "PG / Hostel", emoji: "🏠" },
  { id: "apartment", label: "Apartment", emoji: "🏢" },
  { id: "villa", label: "Villa / House", emoji: "🏡" },
  { id: "commercial", label: "Commercial", emoji: "🏬" },
];

export default function PropertyBasicScreen() {
  const router = useRouter();
  const { update } = useOnboarding();

  const [propertyType, setPropertyType] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [stateOpen, setStateOpen] = useState(false);

  const isValid = name.trim().length > 0 && propertyType !== null;

  return (
    <ScrollView
      contentContainerStyle={s.container}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <StepHeader
        step={2}
        onBack={() => router.back()}
        onSkip={() => router.push("/(onboarding)/property/rooms" as any)}
      />

      <Text style={s.heading}>Your property</Text>
      <Text style={s.sub}>Tell us about the property you manage.</Text>

      <Text style={s.label}>Property type</Text>
      <View style={s.typeRow}>
        {PROPERTY_TYPES.map((t) => (
          <TouchableOpacity
            key={t.id}
            style={[s.typeCard, propertyType === t.id && s.typeCardActive]}
            onPress={() => setPropertyType(t.id)}
            activeOpacity={0.7}
          >
            <Text style={s.typeEmoji}>{t.emoji}</Text>
            <Text style={[s.typeLabel, propertyType === t.id && s.typeLabelActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.label}>Property name *</Text>
      <TextInput
        style={s.input}
        placeholder="e.g. Sharma PG Koramangala"
        placeholderTextColor={colors.muted}
        value={name}
        onChangeText={setName}
      />

      <Text style={s.sectionLabel}>Address</Text>

      <Text style={s.label}>House / Flat / Block no.</Text>
      <TextInput
        style={s.input}
        placeholder="e.g. 12A, 2nd Floor"
        placeholderTextColor={colors.muted}
        value={line1}
        onChangeText={setLine1}
      />

      <Text style={s.label}>City</Text>
      <TextInput
        style={s.input}
        placeholder="e.g. Bangalore"
        placeholderTextColor={colors.muted}
        value={city}
        onChangeText={setCity}
      />

      <Text style={s.label}>State</Text>
      <TouchableOpacity
        style={s.selector}
        onPress={() => setStateOpen(!stateOpen)}
        activeOpacity={0.7}
      >
        <Text style={[s.selectorText, !state && s.selectorPlaceholder]}>
          {state || "Select state"}
        </Text>
        <Text style={s.chevron}>{stateOpen ? "▲" : "▼"}</Text>
      </TouchableOpacity>
      {stateOpen && (
        <View style={s.dropdown}>
          <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
            {INDIAN_STATES.map((st) => (
              <TouchableOpacity
                key={st}
                style={s.dropdownItem}
                onPress={() => { setState(st); setStateOpen(false); }}
              >
                <Text style={s.dropdownText}>{st}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <Text style={s.label}>Pincode</Text>
      <TextInput
        style={s.input}
        placeholder="6-digit pincode"
        placeholderTextColor={colors.muted}
        keyboardType="number-pad"
        maxLength={6}
        value={pincode}
        onChangeText={setPincode}
      />

      <TouchableOpacity
        style={[s.btn, !isValid && s.btnDisabled]}
        onPress={() => {
          update({
            propertyType: propertyType ?? "",
            propertyName: name,
            addressLine1: line1,
            city,
            state,
            pincode,
          });
          router.push("/(onboarding)/property/rooms" as any);
        }}
        disabled={!isValid}
        activeOpacity={0.8}
      >
        <Text style={s.btnText}>Continue</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
    backgroundColor: colors.white,
  },
  heading: {
    fontSize: 32,
    fontWeight: "800",
    color: colors.navy,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  sub: {
    fontSize: 15,
    color: colors.muted,
    marginBottom: 32,
    lineHeight: 22,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.navy,
    marginBottom: 8,
    marginTop: 16,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.navy,
    marginTop: 28,
    marginBottom: 4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 20,
  },
  typeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  typeCard: {
    flex: 1,
    minWidth: "44%",
    borderRadius: radii.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
    padding: 14,
    alignItems: "center",
    gap: 6,
  },
  typeCardActive: {
    borderColor: colors.navy,
    backgroundColor: colors.navy,
  },
  typeEmoji: {
    fontSize: 24,
  },
  typeLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.navy,
    textAlign: "center",
  },
  typeLabelActive: {
    color: colors.white,
  },
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
  selector: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.input,
    paddingHorizontal: 16,
    paddingVertical: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.inputBg,
  },
  selectorText: {
    fontSize: 16,
    color: colors.navy,
  },
  selectorPlaceholder: {
    color: colors.muted,
  },
  chevron: {
    fontSize: 11,
    color: colors.muted,
  },
  dropdown: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.input,
    backgroundColor: colors.white,
    marginTop: 4,
    overflow: "hidden",
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dropdownText: {
    fontSize: 15,
    color: colors.navy,
  },
  btn: {
    borderRadius: radii.pill,
    paddingVertical: 17,
    alignItems: "center",
    backgroundColor: colors.navy,
    marginTop: 40,
  },
  btnDisabled: {
    backgroundColor: colors.primaryLight,
  },
  btnText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.white,
  },
});
