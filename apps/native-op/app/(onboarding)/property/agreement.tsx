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

const AGREEMENT_TYPES = [
  {
    id: "leave_license",
    label: "Leave & License",
    desc: "Recommended for PGs and hostels",
    emoji: "📄",
  },
  {
    id: "rental",
    label: "Rental Agreement",
    desc: "Standard residential / commercial",
    emoji: "🤝",
  },
];

const NOTICE_PERIODS = ["15 days", "30 days", "45 days", "60 days", "90 days"];

const CHARGES = [
  { id: "electricity", label: "Electricity", emoji: "⚡" },
  { id: "water", label: "Water", emoji: "💧" },
  { id: "maintenance", label: "Maintenance", emoji: "🔧" },
  { id: "food", label: "Food charges", emoji: "🍽️" },
  { id: "cleaning", label: "Cleaning", emoji: "🧹" },
];

export default function AgreementScreen() {
  const router = useRouter();

  const [agreementType, setAgreementType] = useState<string | null>(null);
  const [rent, setRent] = useState("");
  const [deposit, setDeposit] = useState("");
  const [noticePeriod, setNoticePeriod] = useState<string | null>(null);
  const [selectedCharges, setSelectedCharges] = useState<string[]>([]);

  const toggleCharge = (id: string) => {
    setSelectedCharges((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const isValid = agreementType !== null && rent.trim().length > 0;

  return (
    <ScrollView
      contentContainerStyle={s.container}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <StepHeader
        step={5}
        showSkip={false}
        onBack={() => router.back()}
      />

      <Text style={s.heading}>Agreement & rent</Text>
      <Text style={s.sub}>Last step — set up your rent and agreement terms.</Text>

      <Text style={s.label}>Agreement type</Text>
      {AGREEMENT_TYPES.map((t) => (
        <TouchableOpacity
          key={t.id}
          style={[s.agreeCard, agreementType === t.id && s.agreeCardActive]}
          onPress={() => setAgreementType(t.id)}
          activeOpacity={0.7}
        >
          <Text style={s.agreeEmoji}>{t.emoji}</Text>
          <View style={s.agreeText}>
            <Text style={[s.agreeLabel, agreementType === t.id && s.agreeLabelActive]}>
              {t.label}
            </Text>
            <Text style={[s.agreeDesc, agreementType === t.id && s.agreeDescActive]}>
              {t.desc}
            </Text>
          </View>
          {agreementType === t.id && (
            <Text style={s.checkmark}>✓</Text>
          )}
        </TouchableOpacity>
      ))}

      <Text style={[s.label, { marginTop: 28 }]}>Monthly rent (₹)</Text>
      <TextInput
        style={s.input}
        placeholder="e.g. 8000"
        placeholderTextColor={colors.muted}
        keyboardType="number-pad"
        value={rent}
        onChangeText={setRent}
      />

      <Text style={s.label}>Security deposit (₹)</Text>
      <TextInput
        style={s.input}
        placeholder="e.g. 16000 (2 months)"
        placeholderTextColor={colors.muted}
        keyboardType="number-pad"
        value={deposit}
        onChangeText={setDeposit}
      />

      <Text style={[s.label, { marginTop: 28 }]}>Notice period</Text>
      <View style={s.noticePills}>
        {NOTICE_PERIODS.map((p) => (
          <TouchableOpacity
            key={p}
            style={[s.noticePill, noticePeriod === p && s.noticePillActive]}
            onPress={() => setNoticePeriod(p)}
            activeOpacity={0.7}
          >
            <Text style={[s.noticePillText, noticePeriod === p && s.noticePillTextActive]}>
              {p}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[s.label, { marginTop: 28 }]}>Additional charges</Text>
      <Text style={s.hint}>{"What's included in or added to the rent?"}</Text>
      <View style={s.chargeChips}>
        {CHARGES.map((c) => {
          const active = selectedCharges.includes(c.id);
          return (
            <TouchableOpacity
              key={c.id}
              style={[s.chargeChip, active && s.chargeChipActive]}
              onPress={() => toggleCharge(c.id)}
              activeOpacity={0.7}
            >
              <Text style={s.chargeEmoji}>{c.emoji}</Text>
              <Text style={[s.chargeLabel, active && s.chargeLabelActive]}>
                {c.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        style={[s.btn, !isValid && s.btnDisabled]}
        onPress={() => router.push("/(onboarding)/success" as any)}
        disabled={!isValid}
        activeOpacity={0.8}
      >
        <Text style={s.btnText}>Finish setup</Text>
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
  agreeCard: {
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
  agreeCardActive: {
    borderColor: colors.navy,
    backgroundColor: colors.navy,
  },
  agreeEmoji: {
    fontSize: 26,
  },
  agreeText: {
    flex: 1,
  },
  agreeLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.navy,
    marginBottom: 2,
  },
  agreeLabelActive: {
    color: colors.white,
  },
  agreeDesc: {
    fontSize: 12,
    color: colors.muted,
  },
  agreeDescActive: {
    color: "rgba(255,255,255,0.7)",
  },
  checkmark: {
    fontSize: 18,
    color: colors.white,
    fontWeight: "700",
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
  noticePills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  noticePill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
  },
  noticePillActive: {
    borderColor: colors.navy,
    backgroundColor: colors.navy,
  },
  noticePillText: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.navy,
  },
  noticePillTextActive: {
    color: colors.white,
  },
  chargeChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chargeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
  },
  chargeChipActive: {
    borderColor: colors.navy,
    backgroundColor: colors.navy,
  },
  chargeEmoji: {
    fontSize: 14,
  },
  chargeLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.navy,
  },
  chargeLabelActive: {
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
