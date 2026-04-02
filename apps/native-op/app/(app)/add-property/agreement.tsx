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
import { useConvex } from "convex/react";
import {
  colors,
  card,
  chip,
  chipActive,
  chipRow,
  chipText,
  chipTextActive,
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
  title,
} from "../../../constants/theme";
import { Ionicons } from "@expo/vector-icons";

const OPTIONS = ["3 months", "6 months", "9 months", "12 months"];
const CUSTOM_VALUE = "custom";

export default function AddPropertyAgreementScreen() {
  const router = useRouter();
  const convex = useConvex();
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [securityDepositDuration, setSecurityDepositDuration] = useState("");
  const [agreementDuration, setAgreementDuration] = useState("");
  const [lockInPeriod, setLockInPeriod] = useState("");
  const [noticePeriod, setNoticePeriod] = useState("");

  const handleSave = async () => {
    if (!propertyId) { setError("Missing property ID."); return; }
    setSaving(true); setError(null);
    try {
      await (convex as any).mutation("onboarding:upsertAgreementDetails", {
        propertyId,
        securityDepositDuration: securityDepositDuration && securityDepositDuration !== CUSTOM_VALUE ? securityDepositDuration : undefined,
        agreementDuration: agreementDuration && agreementDuration !== CUSTOM_VALUE ? agreementDuration : undefined,
        lockInPeriod: lockInPeriod && lockInPeriod !== CUSTOM_VALUE ? lockInPeriod : undefined,
        noticePeriod: noticePeriod && noticePeriod !== CUSTOM_VALUE ? noticePeriod : undefined,
      });
      router.push({ pathname: "/(app)/add-property/rent", params: { propertyId } } as any);
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const isCustom = (v: string) => v.trim() !== "" && !OPTIONS.includes(v);

  const renderOptionRow = (labelText: string, value: string, setter: (v: string) => void) => {
    const customActive = isCustom(value);
    return (
      <View style={styles.optionGroup}>
        <Text style={label}>{labelText}</Text>
        <View style={chipRow}>
          {OPTIONS.map((option) => (
            <TouchableOpacity key={option} style={[chip, value === option && chipActive]} onPress={() => setter(option)}>
              <Text style={[chipText, value === option && chipTextActive]}>{option}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[chip, (customActive || value === CUSTOM_VALUE) && chipActive]} onPress={() => { if (!isCustom(value) && value !== CUSTOM_VALUE) setter(CUSTOM_VALUE); }}>
            <Text style={[chipText, (customActive || value === CUSTOM_VALUE) && chipTextActive]}>Custom</Text>
          </TouchableOpacity>
        </View>
        {(customActive || value === CUSTOM_VALUE) && (
          <TextInput
            style={[input, styles.customInput]}
            placeholder="e.g. 2 months, 18 months, 1 year"
            placeholderTextColor={colors.muted}
            value={value === CUSTOM_VALUE ? "" : value}
            onChangeText={(text) => setter(text.trim() === "" ? CUSTOM_VALUE : text)}
          />
        )}
      </View>
    );
  };

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
        <Text style={styles.stepLabel}>Step 5 of 7 · Agreement details</Text>
        <Text style={title}>Agreement details</Text>

        {error ? <Text style={errorText}>{error}</Text> : null}

        {renderOptionRow("Security deposit duration", securityDepositDuration, setSecurityDepositDuration)}
        {renderOptionRow("Agreement duration", agreementDuration, setAgreementDuration)}
        {renderOptionRow("Lock-in period", lockInPeriod, setLockInPeriod)}
        {renderOptionRow("Notice period", noticePeriod, setNoticePeriod)}

        <View style={footerRow}>
          <TouchableOpacity style={secondaryButton} onPress={handleSave}>
            <Text style={secondaryButtonText}>Save as draft</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[primaryButton, saving && primaryButtonDisabled]} disabled={saving} onPress={handleSave}>
            <Text style={primaryButtonText}>{saving ? "Saving…" : "Next"}</Text>
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
  optionGroup: { marginTop: 4 },
  customInput: { marginTop: 10 },
});
