import { useEffect, useState } from "react";
import {
  ActivityIndicator,
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
  loadingRow,
  loadingText,
  primaryButton,
  primaryButtonDisabled,
  primaryButtonText,
  secondaryButton,
  secondaryButtonText,
  stepLabel,
  title,
} from "../../../constants/theme";

const OPTIONS = ["3 months", "6 months", "9 months", "12 months"];
const CUSTOM_VALUE = "custom";

export default function AgreementScreen() {
  const router = useRouter();
  const convex = useConvex();
  const { propertyId: propertyIdParam } = useLocalSearchParams<{
    propertyId?: string;
  }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [propertyId, setPropertyId] = useState<string | null>(
    propertyIdParam ? String(propertyIdParam) : null,
  );

  const [securityDepositDuration, setSecurityDepositDuration] = useState("");
  const [agreementDuration, setAgreementDuration] = useState("");
  const [lockInPeriod, setLockInPeriod] = useState("");
  const [noticePeriod, setNoticePeriod] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await (convex as any).query(
          "onboarding:getOnboardingStatus",
          {},
        );
        if (cancelled || !status) return;
        if (status.property && !propertyId) setPropertyId(status.property._id);
        if (status.agreement) {
          const a = status.agreement;
          setSecurityDepositDuration(a.securityDepositDuration ?? "");
          setAgreementDuration(a.agreementDuration ?? "");
          setLockInPeriod(a.lockInPeriod ?? "");
          setNoticePeriod(a.noticePeriod ?? "");
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [convex, propertyId]);

  const handleSave = async () => {
    if (!propertyId) {
      setError("Please complete property basics first.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await (convex as any).mutation("onboarding:upsertAgreementDetails", {
        propertyId,
        securityDepositDuration:
          securityDepositDuration && securityDepositDuration !== CUSTOM_VALUE
            ? securityDepositDuration
            : undefined,
        agreementDuration:
          agreementDuration && agreementDuration !== CUSTOM_VALUE
            ? agreementDuration
            : undefined,
        lockInPeriod:
          lockInPeriod && lockInPeriod !== CUSTOM_VALUE ? lockInPeriod : undefined,
        noticePeriod:
          noticePeriod && noticePeriod !== CUSTOM_VALUE
            ? noticePeriod
            : undefined,
      });
      router.push({
        pathname: "/(onboarding)/property/rent",
        params: { propertyId },
      } as any);
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const isCustom = (v: string) =>
    v.trim() !== "" && !OPTIONS.includes(v);

  const renderOptionRow = (
    labelText: string,
    value: string,
    setter: (v: string) => void,
  ) => {
    const customActive = isCustom(value);
    const showCustomInput = customActive || value === CUSTOM_VALUE;
    const displayValue = value === CUSTOM_VALUE ? "" : value;
    return (
      <View style={styles.optionGroup}>
        <Text style={label}>{labelText}</Text>
        <View style={chipRow}>
          {OPTIONS.map((option) => {
            const active = value === option;
            return (
              <TouchableOpacity
                key={option}
                style={[chip, active && chipActive]}
                onPress={() => setter(option)}
              >
                <Text style={[chipText, active && chipTextActive]}>{option}</Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            style={[chip, (customActive || value === CUSTOM_VALUE) && chipActive]}
            onPress={() => {
              if (!isCustom(value) && value !== CUSTOM_VALUE) setter(CUSTOM_VALUE);
            }}
          >
            <Text
              style={[
                chipText,
                (customActive || value === CUSTOM_VALUE) && chipTextActive,
              ]}
            >
              Custom
            </Text>
          </TouchableOpacity>
        </View>
        {showCustomInput && (
          <TextInput
            style={[input, styles.customInput]}
            placeholder="e.g. 2 months, 18 months, 1 year"
            placeholderTextColor={colors.muted}
            value={value === CUSTOM_VALUE ? "" : value}
            onChangeText={(text) =>
              setter(text.trim() === "" ? CUSTOM_VALUE : text)
            }
          />
        )}
      </View>
    );
  };

  return (
    <ScrollView contentContainerStyle={container}>
      <View style={card}>
        <Text style={stepLabel}>Step 5 of 7 · Agreement details</Text>
        <Text style={title}>Agreement details</Text>

        {loading && (
          <View style={loadingRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={loadingText}>Loading agreement...</Text>
          </View>
        )}

        {error ? <Text style={errorText}>{error}</Text> : null}

        {renderOptionRow(
          "Security deposit duration",
          securityDepositDuration,
          setSecurityDepositDuration,
        )}
        {renderOptionRow(
          "Agreement duration",
          agreementDuration,
          setAgreementDuration,
        )}
        {renderOptionRow(
          "Lock-in period",
          lockInPeriod,
          setLockInPeriod,
        )}
        {renderOptionRow(
          "Notice period",
          noticePeriod,
          setNoticePeriod,
        )}

        <View style={footerRow}>
          <TouchableOpacity style={secondaryButton} onPress={handleSave}>
            <Text style={secondaryButtonText}>Save as draft</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[primaryButton, saving && primaryButtonDisabled]}
            disabled={saving}
            onPress={handleSave}
          >
            <Text style={primaryButtonText}>
              {saving ? "Saving..." : "Next"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  optionGroup: {
    marginTop: 4,
  },
  customInput: {
    marginTop: 10,
  },
});
