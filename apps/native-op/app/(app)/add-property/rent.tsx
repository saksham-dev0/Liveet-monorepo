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
  secondaryButton,
  secondaryButtonText,
  title,
} from "../../../constants/theme";
import { Ionicons } from "@expo/vector-icons";

const CYCLES = ["01 - 01", "15 - 15"];
const GRACE_PERIODS = [5, 7, 10];

export default function AddPropertyRentScreen() {
  const router = useRouter();
  const convex = useConvex();
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [initialized, setInitialized] = useState(false);
  const [cycle, setCycle] = useState("");
  const [gracePeriod, setGracePeriod] = useState<number | null>(null);
  const [hasLateFee, setHasLateFee] = useState<boolean | null>(null);
  const [lateFeeAmount, setLateFeeAmount] = useState("");

  useEffect(() => {
    if (!propertyId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await (convex as any).query("onboarding:getPropertyFlowData", { propertyId });
        if (cancelled) return;
        const r = data?.rent;
        if (r) {
          if (r.monthlyRentalCycle) setCycle(r.monthlyRentalCycle);
          if (r.gracePeriodDays != null) setGracePeriod(r.gracePeriodDays);
          if (r.hasLateFee != null) setHasLateFee(r.hasLateFee);
          if (r.lateFeeAmount != null) setLateFeeAmount(String(r.lateFeeAmount));
        }
      } catch {
        // ignore — form stays at defaults if fetch fails
      } finally {
        if (!cancelled) setInitialized(true);
      }
    })();
    return () => { cancelled = true; };
  }, [convex, propertyId]);

  const handleSave = async (saveAsDraft = false) => {
    if (!propertyId) { setError("Missing property ID."); return; }
    setSaving(true); setError(null);
    try {
      await (convex as any).mutation("onboarding:upsertRentDetails", {
        propertyId,
        monthlyRentalCycle: cycle || undefined,
        gracePeriodDays: gracePeriod ?? undefined,
        hasLateFee: hasLateFee === null ? undefined : hasLateFee,
        lateFeeAmount: hasLateFee === true && lateFeeAmount ? Number(lateFeeAmount) : undefined,
      });
      if (!saveAsDraft) {
        router.push({ pathname: "/(app)/add-property/charges", params: { propertyId } } as any);
      }
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const renderChipRow = (labelText: string, values: string[], selected: string, setter: (v: string) => void) => (
    <View style={styles.group}>
      <Text style={label}>{labelText}</Text>
      <View style={chipRow}>
        {values.map((val) => (
          <TouchableOpacity key={val} style={[chip, selected === val && chipActive]} onPress={() => setter(val)}>
            <Text style={[chipText, selected === val && chipTextActive]}>{val}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

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
        <Text style={styles.stepLabel}>Step 6 of 7 · Rent</Text>
        <Text style={title}>Rent</Text>

        {error ? <Text style={errorText}>{error}</Text> : null}

        {renderChipRow("Monthly rental cycle", CYCLES, cycle, setCycle)}

        <View style={styles.group}>
          <Text style={label}>Grace Period</Text>
          <View style={chipRow}>
            {GRACE_PERIODS.map((days) => (
              <TouchableOpacity key={days} style={[chip, gracePeriod === days && chipActive]} onPress={() => setGracePeriod(days)}>
                <Text style={[chipText, gracePeriod === days && chipTextActive]}>{days} days</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.group}>
          <Text style={label}>Fine for late payment</Text>
          <View style={chipRow}>
            <TouchableOpacity style={[chip, hasLateFee === true && chipActive]} onPress={() => setHasLateFee(true)}>
              <Text style={[chipText, hasLateFee === true && chipTextActive]}>Yes</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[chip, hasLateFee === false && chipActive]} onPress={() => setHasLateFee(false)}>
              <Text style={[chipText, hasLateFee === false && chipTextActive]}>No</Text>
            </TouchableOpacity>
          </View>
          {hasLateFee === true && (
            <>
              <Text style={label}>Amount</Text>
              <TextInput style={input} placeholder="Amount" placeholderTextColor={colors.muted} keyboardType="number-pad" value={lateFeeAmount} onChangeText={setLateFeeAmount} />
            </>
          )}
        </View>

        <View style={footerRow}>
          <TouchableOpacity style={[secondaryButton, !initialized && primaryButtonDisabled]} disabled={!initialized} onPress={() => handleSave(true)}>
            <Text style={secondaryButtonText}>Save as draft</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[primaryButton, (!initialized || saving) && primaryButtonDisabled]} disabled={!initialized || saving} onPress={() => handleSave(false)}>
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
  group: { marginTop: 4 },
});
