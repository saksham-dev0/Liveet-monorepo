import { useState, useEffect } from "react";
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
  sectionHeader,
  title,
} from "../../../constants/theme";
import { Ionicons } from "@expo/vector-icons";

const TYPES = ["Maintenance","Registration Charge","KYC Charge","Agreement Charge","Onboarding Charge","One-Time Charge"];
const REPETITIONS = ["One time", "Monthly"] as const;
const GRACE_PERIODS = [5, 7, 10];

export default function AddPropertyChargesScreen() {
  const router = useRouter();
  const convex = useConvex();
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [initialized, setInitialized] = useState(false);
  const [isChargingExtra, setIsChargingExtra] = useState<boolean | null>(null);
  const [type, setType] = useState("");
  const [amount, setAmount] = useState("");
  const [repetition, setRepetition] = useState<(typeof REPETITIONS)[number] | null>(null);
  const [gracePeriod, setGracePeriod] = useState<number | null>(null);

  useEffect(() => {
    if (!propertyId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await (convex as any).query("onboarding:getPropertyFlowData", { propertyId });
        if (cancelled) return;
        const ec = data?.extraCharges;
        if (ec) {
          if (ec.isChargingExtra != null) setIsChargingExtra(ec.isChargingExtra);
          if (ec.type) setType(ec.type);
          if (ec.amount != null) setAmount(String(ec.amount));
          if (ec.repetition) setRepetition(ec.repetition as (typeof REPETITIONS)[number]);
          if (ec.gracePeriodDays != null) setGracePeriod(ec.gracePeriodDays);
        }
      } catch {
        // ignore — form stays at defaults if fetch fails
      } finally {
        if (!cancelled) setInitialized(true);
      }
    })();
    return () => { cancelled = true; };
  }, [convex, propertyId]);

  const handleFinish = async () => {
    if (!propertyId) { setError("Missing property ID."); return; }
    setSaving(true); setError(null);
    try {
      const payload: Record<string, unknown> = { propertyId };
      if (isChargingExtra !== null) payload.isChargingExtra = isChargingExtra;
      if (isChargingExtra === true) {
        if (type) payload.type = type;
        if (amount) payload.amount = Number(amount);
        if (repetition) payload.repetition = repetition;
        if (gracePeriod != null) payload.gracePeriodDays = gracePeriod;
      }
      await (convex as any).mutation("onboarding:upsertExtraCharges", payload);

      // Switch dashboard to this new property
      await (convex as any).mutation("properties:setPrimaryProperty", { propertyId });

      // Navigate back to home dashboard
      router.replace("/(app)/(tabs)/" as any);
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const showChargeFields = isChargingExtra === true;

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
        <Text style={styles.stepLabel}>Step 7 of 7 · Other Charges</Text>
        <Text style={title}>Other Charges</Text>

        {error ? <Text style={errorText}>{error}</Text> : null}

        <Text style={label}>Do you take any extra charge?</Text>
        <View style={chipRow}>
          <TouchableOpacity style={[chip, isChargingExtra === true && chipActive]} onPress={() => setIsChargingExtra(true)}>
            <Text style={[chipText, isChargingExtra === true && chipTextActive]}>Yes</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[chip, isChargingExtra === false && chipActive]} onPress={() => setIsChargingExtra(false)}>
            <Text style={[chipText, isChargingExtra === false && chipTextActive]}>No</Text>
          </TouchableOpacity>
        </View>

        {showChargeFields && (
          <>
            <Text style={sectionHeader}>Add a charge</Text>
            <Text style={label}>Type</Text>
            <View style={chipRow}>
              {TYPES.map((t) => (
                <TouchableOpacity key={t} style={[styles.smallChip, type === t && chipActive]} onPress={() => setType(t)}>
                  <Text style={[chipText, type === t && chipTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={label}>Amount</Text>
            <TextInput style={input} placeholder="0" placeholderTextColor={colors.muted} keyboardType="number-pad" value={amount} onChangeText={setAmount} />

            <Text style={label}>Extra charge repetition</Text>
            <View style={chipRow}>
              {REPETITIONS.map((rep) => (
                <TouchableOpacity key={rep} style={[chip, repetition === rep && chipActive]} onPress={() => setRepetition(rep)}>
                  <Text style={[chipText, repetition === rep && chipTextActive]}>{rep}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={label}>Grace period</Text>
            <View style={chipRow}>
              {GRACE_PERIODS.map((days) => (
                <TouchableOpacity key={days} style={[chip, gracePeriod === days && chipActive]} onPress={() => setGracePeriod(days)}>
                  <Text style={[chipText, gracePeriod === days && chipTextActive]}>{days} days</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <View style={footerRow}>
          <TouchableOpacity style={[primaryButton, { flex: 1 }, (!initialized || saving) && primaryButtonDisabled]} disabled={!initialized || saving} onPress={handleFinish}>
            <Text style={primaryButtonText}>{saving ? "Saving…" : "Add property"}</Text>
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
  smallChip: { ...chip, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1 },
});
