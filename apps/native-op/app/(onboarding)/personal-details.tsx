import { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StepHeader } from "../../components/StepHeader";
import { colors, radii } from "../../constants/theme";
import { useOnboarding } from "../../context/OnboardingContext";

export default function PersonalDetailsScreen() {
  const router = useRouter();
  const { update } = useOnboarding();
  const { name: paramName } = useLocalSearchParams<{ name?: string }>();

  const [fullName, setFullName] = useState(paramName ?? "");
  const [brandName, setBrandName] = useState("");
  const [totalProperties, setTotalProperties] = useState("1");

  const isValid = fullName.trim().length > 0;

  const handleContinue = () => {
    if (!isValid) return;
    update({ fullName, brandName });
    router.push("/(onboarding)/property/basic" as any);
  };

  return (
    <ScrollView
      contentContainerStyle={s.container}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <StepHeader
        step={1}
        onBack={() => router.back()}
        onSkip={handleContinue}
      />

      <Text style={s.heading}>Your details</Text>
      <Text style={s.sub}>Tell us about you and your business.</Text>

      <Text style={s.label}>Full name *</Text>
      <TextInput
        style={s.input}
        placeholder="e.g. Rahul Sharma"
        placeholderTextColor={colors.muted}
        value={fullName}
        onChangeText={setFullName}
        autoCapitalize="words"
      />

      <Text style={s.label}>Brand / business name</Text>
      <TextInput
        style={s.input}
        placeholder="e.g. Sharma PG & Hostels"
        placeholderTextColor={colors.muted}
        value={brandName}
        onChangeText={setBrandName}
      />

      <Text style={s.label}>Number of properties</Text>
      <View style={s.stepper}>
        <TouchableOpacity
          style={s.stepperBtn}
          onPress={() =>
            setTotalProperties((v) => String(Math.max(1, Number(v) - 1)))
          }
          activeOpacity={0.7}
        >
          <Text style={s.stepperBtnText}>−</Text>
        </TouchableOpacity>
        <Text style={s.stepperValue}>{totalProperties}</Text>
        <TouchableOpacity
          style={s.stepperBtn}
          onPress={() =>
            setTotalProperties((v) => String(Number(v) + 1))
          }
          activeOpacity={0.7}
        >
          <Text style={s.stepperBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[s.btn, !isValid && s.btnDisabled]}
        onPress={handleContinue}
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
    marginTop: 20,
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
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
  },
  stepperBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperBtnText: {
    fontSize: 22,
    color: colors.navy,
    lineHeight: 26,
  },
  stepperValue: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.navy,
    minWidth: 32,
    textAlign: "center",
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
