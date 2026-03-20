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
  sectionHeader,
  stepLabel,
  title,
} from "../../../constants/theme";

const TYPES = [
  "Maintenance",
  "Registration Charge",
  "KYC Charge",
  "Agreement Charge",
  "Onboarding Charge",
  "One-Time Charge",
];

const REPETITIONS = ["One time", "Monthly"] as const;
const GRACE_PERIODS = [5, 7, 10];

export default function ChargesScreen() {
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

  const [isChargingExtra, setIsChargingExtra] = useState<boolean | null>(null);
  const [type, setType] = useState("");
  const [amount, setAmount] = useState("");
  const [repetition, setRepetition] =
    useState<(typeof REPETITIONS)[number] | null>(null);
  const [gracePeriod, setGracePeriod] = useState<number | null>(null);

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
        if (status.extraCharges) {
          const c = status.extraCharges;
          setIsChargingExtra(
            c.isChargingExtra === undefined
              ? null
              : Boolean(c.isChargingExtra),
          );
          setType(c.type ?? "");
          setAmount(c.amount != null ? String(c.amount) : "");
          setRepetition(
            (c.repetition as (typeof REPETITIONS)[number]) ?? null,
          );
          setGracePeriod(
            c.gracePeriodDays != null ? Number(c.gracePeriodDays) : null,
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
      await (convex as any).mutation("onboarding:upsertExtraCharges", {
        propertyId,
        isChargingExtra:
          isChargingExtra === null
            ? undefined
            : isChargingExtra
              ? true
              : false,
        type: type || undefined,
        amount: amount ? Number(amount) : undefined,
        repetition: repetition || undefined,
        gracePeriodDays: gracePeriod ?? undefined,
      });
      router.push("/(onboarding)/referral");
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const showChargeFields = isChargingExtra === true;

  return (
    <ScrollView contentContainerStyle={container}>
      <View style={card}>
        <Text style={stepLabel}>Step 7 of 7 · Other Charges</Text>
        <Text style={title}>Other Charges</Text>

        {loading && (
          <View style={loadingRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={loadingText}>Loading extra charges...</Text>
          </View>
        )}

        {error ? <Text style={errorText}>{error}</Text> : null}

        <Text style={label}>Do you take any extra charge?</Text>
        <View style={chipRow}>
          <TouchableOpacity
            style={[chip, isChargingExtra === true && chipActive]}
            onPress={() => setIsChargingExtra(true)}
          >
            <Text
              style={[
                chipText,
                isChargingExtra === true && chipTextActive,
              ]}
            >
              Yes
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[chip, isChargingExtra === false && chipActive]}
            onPress={() => setIsChargingExtra(false)}
          >
            <Text
              style={[
                chipText,
                isChargingExtra === false && chipTextActive,
              ]}
            >
              No
            </Text>
          </TouchableOpacity>
        </View>

        {showChargeFields && (
          <>
            <Text style={sectionHeader}>Add a charge</Text>

            <Text style={label}>Type</Text>
            <View style={chipRow}>
              {TYPES.map((t) => {
                const active = type === t;
                return (
                  <TouchableOpacity
                    key={t}
                    style={[styles.smallChip, active && chipActive]}
                    onPress={() => setType(t)}
                  >
                    <Text
                      style={[
                        chipText,
                        active && chipTextActive,
                      ]}
                    >
                      {t}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={label}>Amount</Text>
            <TextInput
              style={input}
              placeholder="0"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              value={amount}
              onChangeText={setAmount}
            />

            <Text style={label}>Extra charge repetition</Text>
            <View style={chipRow}>
              {REPETITIONS.map((rep) => {
                const active = repetition === rep;
                return (
                  <TouchableOpacity
                    key={rep}
                    style={[chip, active && chipActive]}
                    onPress={() => setRepetition(rep)}
                  >
                    <Text
                      style={[
                        chipText,
                        active && chipTextActive,
                      ]}
                    >
                      {rep}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={label}>Grace period</Text>
            <View style={chipRow}>
              {GRACE_PERIODS.map((days) => {
                const active = gracePeriod === days;
                return (
                  <TouchableOpacity
                    key={days}
                    style={[chip, active && chipActive]}
                    onPress={() => setGracePeriod(days)}
                  >
                    <Text
                      style={[
                        chipText,
                        active && chipTextActive,
                      ]}
                    >
                      {days} days
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
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
  smallChip: {
    ...chip,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
  },
});
