import { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { StepHeader } from "../../../components/StepHeader";
import { colors, radii } from "../../../constants/theme";

const GENDER_OPTIONS = [
  { id: "any", label: "Any gender", emoji: "👥", desc: "Open to everyone" },
  { id: "male", label: "Male only", emoji: "👨", desc: "Male tenants only" },
  { id: "female", label: "Female only", emoji: "👩", desc: "Female tenants only" },
];

const FOOD_OPTIONS = [
  { id: "any", label: "Any", emoji: "🍽️", desc: "No food preference" },
  { id: "veg", label: "Veg only", emoji: "🥗", desc: "Vegetarian kitchen" },
  { id: "nonveg", label: "Non-veg allowed", emoji: "🍗", desc: "Non-veg permitted" },
];

const OCCUPATION_OPTIONS = [
  { id: "any", label: "Any", emoji: "🌐" },
  { id: "working", label: "Working professionals", emoji: "💼" },
  { id: "student", label: "Students", emoji: "🎓" },
  { id: "family", label: "Families", emoji: "👨‍👩‍👧" },
];

function OptionCard({
  emoji,
  label,
  desc,
  selected,
  onPress,
}: {
  emoji: string;
  label: string;
  desc?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[s.optionCard, selected && s.optionCardActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={s.optionEmoji}>{emoji}</Text>
      <Text style={[s.optionLabel, selected && s.optionLabelActive]}>{label}</Text>
      {desc ? (
        <Text style={[s.optionDesc, selected && s.optionDescActive]}>{desc}</Text>
      ) : null}
      {selected && <Text style={s.checkmark}>✓</Text>}
    </TouchableOpacity>
  );
}

export default function TenantScreen() {
  const router = useRouter();
  const [gender, setGender] = useState<string | null>(null);
  const [food, setFood] = useState<string | null>(null);
  const [occupation, setOccupation] = useState<string | null>(null);

  const isValid = gender !== null;

  return (
    <ScrollView
      contentContainerStyle={s.container}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <StepHeader
        step={4}
        onBack={() => router.back()}
        onSkip={() => router.push("/(onboarding)/property/agreement" as any)}
      />

      <Text style={s.heading}>Tenant preferences</Text>
      <Text style={s.sub}>Who do you want to rent to?</Text>

      <Text style={s.label}>Gender preference</Text>
      {GENDER_OPTIONS.map((opt) => (
        <OptionCard
          key={opt.id}
          {...opt}
          selected={gender === opt.id}
          onPress={() => setGender(opt.id)}
        />
      ))}

      <Text style={[s.label, { marginTop: 28 }]}>Food preference</Text>
      {FOOD_OPTIONS.map((opt) => (
        <OptionCard
          key={opt.id}
          {...opt}
          selected={food === opt.id}
          onPress={() => setFood(opt.id)}
        />
      ))}

      <Text style={[s.label, { marginTop: 28 }]}>Preferred tenants</Text>
      <Text style={s.hint}>Select all that apply</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.occupationRow}
      >
        {OCCUPATION_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.id}
            style={[s.occupationChip, occupation === opt.id && s.occupationChipActive]}
            onPress={() => setOccupation(opt.id === occupation ? null : opt.id)}
            activeOpacity={0.7}
          >
            <Text style={s.occupationEmoji}>{opt.emoji}</Text>
            <Text style={[s.occupationLabel, occupation === opt.id && s.occupationLabelActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TouchableOpacity
        style={[s.btn, !isValid && s.btnDisabled]}
        onPress={() => router.push("/(onboarding)/property/agreement" as any)}
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
    marginBottom: 10,
    marginTop: 8,
  },
  hint: {
    fontSize: 12,
    color: colors.muted,
    marginBottom: 12,
    marginTop: -6,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: radii.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
    marginBottom: 10,
  },
  optionCardActive: {
    borderColor: colors.navy,
    backgroundColor: colors.navy,
  },
  optionEmoji: {
    fontSize: 24,
  },
  optionLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: colors.navy,
  },
  optionLabelActive: {
    color: colors.white,
  },
  optionDesc: {
    fontSize: 12,
    color: colors.muted,
  },
  optionDescActive: {
    color: "rgba(255,255,255,0.7)",
  },
  checkmark: {
    fontSize: 16,
    color: colors.white,
    fontWeight: "700",
  },
  occupationRow: {
    gap: 10,
    paddingBottom: 4,
  },
  occupationChip: {
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radii.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
    minWidth: 100,
  },
  occupationChipActive: {
    borderColor: colors.navy,
    backgroundColor: colors.navy,
  },
  occupationEmoji: {
    fontSize: 22,
  },
  occupationLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.navy,
    textAlign: "center",
  },
  occupationLabelActive: {
    color: colors.white,
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
