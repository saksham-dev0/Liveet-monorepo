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

const CYCLES = ["01 - 01", "15 - 15"];
const GRACE_PERIODS = [5, 7, 10];

export default function RentScreen() {
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

  const [cycle, setCycle] = useState("");
  const [gracePeriod, setGracePeriod] = useState<number | null>(null);
  const [hasLateFee, setHasLateFee] = useState<boolean | null>(null);
  const [lateFeeAmount, setLateFeeAmount] = useState("");

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
        if (status.rent) {
          const r = status.rent;
          setCycle(r.monthlyRentalCycle ?? "");
          setGracePeriod(
            r.gracePeriodDays != null ? Number(r.gracePeriodDays) : null,
          );
          setHasLateFee(
            r.hasLateFee === undefined ? null : Boolean(r.hasLateFee),
          );
          setLateFeeAmount(
            r.lateFeeAmount != null ? String(r.lateFeeAmount) : "",
          );
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
      await (convex as any).mutation("onboarding:upsertRentDetails", {
        propertyId,
        monthlyRentalCycle: cycle || undefined,
        gracePeriodDays: gracePeriod ?? undefined,
        hasLateFee:
          hasLateFee === null ? undefined : hasLateFee ? true : false,
        lateFeeAmount: lateFeeAmount ? Number(lateFeeAmount) : undefined,
      });
      router.push({
        pathname: "/(onboarding)/property/charges",
        params: { propertyId },
      } as any);
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const renderChipRow = (
    labelText: string,
    values: string[],
    selected: string,
    setter: (v: string) => void,
  ) => (
    <View style={styles.group}>
      <Text style={label}>{labelText}</Text>
      <View style={chipRow}>
        {values.map((val) => {
          const active = selected === val;
          return (
            <TouchableOpacity
              key={val}
              style={[chip, active && chipActive]}
              onPress={() => setter(val)}
            >
              <Text style={[chipText, active && chipTextActive]}>{val}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  return (
    <ScrollView contentContainerStyle={container}>
      <View style={card}>
        <Text style={stepLabel}>Step 6 of 7 · Rent</Text>
        <Text style={title}>Rent</Text>

        {loading && (
          <View style={loadingRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={loadingText}>Loading rent details...</Text>
          </View>
        )}

        {error ? <Text style={errorText}>{error}</Text> : null}

        {renderChipRow("Monthly rental cycle", CYCLES, cycle, setCycle)}

        <View style={styles.group}>
          <Text style={label}>Grace Period</Text>
          <View style={chipRow}>
            {GRACE_PERIODS.map((days) => {
              const active = gracePeriod === days;
              return (
                <TouchableOpacity
                  key={days}
                  style={[chip, active && chipActive]}
                  onPress={() => setGracePeriod(days)}
                >
                  <Text style={[chipText, active && chipTextActive]}>
                    {days} days
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.group}>
          <Text style={label}>Fine for late payment</Text>
          <View style={chipRow}>
            <TouchableOpacity
              style={[chip, hasLateFee === true && chipActive]}
              onPress={() => setHasLateFee(true)}
            >
              <Text
                style={[chipText, hasLateFee === true && chipTextActive]}
              >
                Yes
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[chip, hasLateFee === false && chipActive]}
              onPress={() => setHasLateFee(false)}
            >
              <Text
                style={[chipText, hasLateFee === false && chipTextActive]}
              >
                No
              </Text>
            </TouchableOpacity>
          </View>

          {hasLateFee === true && (
            <>
              <Text style={label}>Amount</Text>
              <TextInput
                style={input}
                placeholder="Amount"
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
                value={lateFeeAmount}
                onChangeText={setLateFeeAmount}
              />
            </>
          )}
        </View>

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
  group: {
    marginTop: 4,
  },
});
