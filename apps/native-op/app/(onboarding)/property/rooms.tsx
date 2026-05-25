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

const ROOM_TYPES = [
  { id: "single", label: "Single", emoji: "🛏️" },
  { id: "double", label: "Double sharing", emoji: "🛏️🛏️" },
  { id: "triple", label: "Triple sharing", emoji: "3×" },
  { id: "dormitory", label: "Dormitory", emoji: "🏨" },
  { id: "studio", label: "Studio / 1BHK", emoji: "🏠" },
  { id: "2bhk", label: "2BHK", emoji: "🏡" },
];

const AMENITIES = [
  { id: "ac", label: "AC" },
  { id: "wifi", label: "Wi-Fi" },
  { id: "attached_bath", label: "Attached Bath" },
  { id: "parking", label: "Parking" },
  { id: "laundry", label: "Laundry" },
  { id: "balcony", label: "Balcony" },
  { id: "meals", label: "Meals" },
  { id: "security", label: "24/7 Security" },
  { id: "gym", label: "Gym" },
];

export default function RoomsScreen() {
  const router = useRouter();
  const { update } = useOnboarding();
  const [totalUnits, setTotalUnits] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);

  const toggleType = (id: string) => {
    setSelectedTypes((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleAmenity = (id: string) => {
    setSelectedAmenities((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const isValid = selectedTypes.length > 0;

  return (
    <ScrollView
      contentContainerStyle={s.container}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <StepHeader
        step={3}
        onBack={() => router.back()}
        onSkip={() => { update({ totalUnits, roomTypes: selectedTypes, amenities: selectedAmenities }); router.push("/(onboarding)/property/tenant" as any); }}
      />

      <Text style={s.heading}>Room setup</Text>
      <Text style={s.sub}>How many units and what types do you offer?</Text>

      <Text style={s.label}>Total units</Text>
      <TextInput
        style={s.input}
        value={totalUnits}
        onChangeText={(t) => setTotalUnits(t.replace(/[^0-9]/g, ""))}
        keyboardType="number-pad"
        placeholder="e.g. 10"
        placeholderTextColor={colors.muted}
        maxLength={4}
      />

      <Text style={s.label}>Room types offered</Text>
      <Text style={s.hint}>Pick all that apply</Text>
      <View style={s.chips}>
        {ROOM_TYPES.map((t) => {
          const active = selectedTypes.includes(t.id);
          return (
            <TouchableOpacity
              key={t.id}
              style={[s.chip, active && s.chipActive]}
              onPress={() => toggleType(t.id)}
              activeOpacity={0.7}
            >
              <Text style={s.chipEmoji}>{t.emoji}</Text>
              <Text style={[s.chipLabel, active && s.chipLabelActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[s.label, { marginTop: 28 }]}>Amenities</Text>
      <Text style={s.hint}>What does your property offer?</Text>
      <View style={s.amenityChips}>
        {AMENITIES.map((a) => {
          const active = selectedAmenities.includes(a.id);
          return (
            <TouchableOpacity
              key={a.id}
              style={[s.amenityChip, active && s.chipActive]}
              onPress={() => toggleAmenity(a.id)}
              activeOpacity={0.7}
            >
              <Text style={[s.amenityLabel, active && s.chipLabelActive]}>
                {a.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        style={[s.btn, !isValid && s.btnDisabled]}
        onPress={() => {
          update({ totalUnits, roomTypes: selectedTypes, amenities: selectedAmenities });
          router.push("/(onboarding)/property/tenant" as any);
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
    marginBottom: 6,
    marginTop: 16,
  },
  hint: {
    fontSize: 12,
    color: colors.muted,
    marginBottom: 12,
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.inputBg,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 16,
    color: colors.navy,
    fontWeight: "600",
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
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
  chipActive: {
    backgroundColor: colors.navy,
    borderColor: colors.navy,
  },
  chipEmoji: {
    fontSize: 14,
  },
  chipLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.navy,
  },
  chipLabelActive: {
    color: colors.white,
  },
  amenityChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  amenityChip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
  },
  amenityLabel: {
    fontSize: 13,
    fontWeight: "500",
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
