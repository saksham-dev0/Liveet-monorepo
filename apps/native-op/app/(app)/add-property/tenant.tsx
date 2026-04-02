import { useState, useEffect } from "react";
import {
  ScrollView,
  Text,
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
  primaryButton,
  primaryButtonDisabled,
  primaryButtonText,
  secondaryButton,
  secondaryButtonText,
  sectionHeader,
  title,
} from "../../../constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet } from "react-native";

export default function AddPropertyTenantScreen() {
  const router = useRouter();
  const convex = useConvex();
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [canStayMale, setCanStayMale] = useState(false);
  const [canStayFemale, setCanStayFemale] = useState(false);
  const [canStayOthers, setCanStayOthers] = useState(false);
  const [bestStudent, setBestStudent] = useState(false);
  const [bestWorking, setBestWorking] = useState(false);

  useEffect(() => {
    if (!propertyId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await (convex as any).query("onboarding:getPropertyFlowData", { propertyId });
        if (cancelled || !data?.tenantDetails) return;
        const t = data.tenantDetails;
        setCanStayMale(!!t.canStayMale);
        setCanStayFemale(!!t.canStayFemale);
        setCanStayOthers(!!t.canStayOthers);
        setBestStudent(!!t.bestForStudent);
        setBestWorking(!!t.bestForWorkingProfessional);
      } catch {
        // ignore — form stays at defaults if fetch fails
      }
    })();
    return () => { cancelled = true; };
  }, [convex, propertyId]);

  const toggle = (value: boolean, setter: (v: boolean) => void) => setter(!value);

  const handleSave = async (saveAsDraft = false) => {
    if (!propertyId) {
      setError("Missing property ID. Please go back and try again.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await (convex as any).mutation("onboarding:updateTenantDetails", {
        propertyId,
        canStayMale,
        canStayFemale,
        canStayOthers,
        bestForStudent: bestStudent,
        bestForWorkingProfessional: bestWorking,
      });
      if (!saveAsDraft) {
        router.push({
          pathname: "/(app)/add-property/rooms",
          params: { propertyId },
        } as any);
      }
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
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
        <Text style={styles.stepLabel}>Step 2 of 7 · Tenant details</Text>
        <Text style={title}>Tenant details</Text>

        {error ? <Text style={errorText}>{error}</Text> : null}

        <Text style={sectionHeader}>Who can stay</Text>
        <View style={chipRow}>
          <TouchableOpacity style={[chip, canStayMale && chipActive]} onPress={() => toggle(canStayMale, setCanStayMale)}>
            <Text style={[chipText, canStayMale && chipTextActive]}>Male</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[chip, canStayFemale && chipActive]} onPress={() => toggle(canStayFemale, setCanStayFemale)}>
            <Text style={[chipText, canStayFemale && chipTextActive]}>Female</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[chip, canStayOthers && chipActive]} onPress={() => toggle(canStayOthers, setCanStayOthers)}>
            <Text style={[chipText, canStayOthers && chipTextActive]}>Others</Text>
          </TouchableOpacity>
        </View>

        <Text style={sectionHeader}>Best suited for</Text>
        <View style={chipRow}>
          <TouchableOpacity style={[chip, bestStudent && chipActive]} onPress={() => toggle(bestStudent, setBestStudent)}>
            <Text style={[chipText, bestStudent && chipTextActive]}>Student</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[chip, bestWorking && chipActive]} onPress={() => toggle(bestWorking, setBestWorking)}>
            <Text style={[chipText, bestWorking && chipTextActive]}>Working professional</Text>
          </TouchableOpacity>
        </View>

        <View style={footerRow}>
          <TouchableOpacity style={secondaryButton} onPress={() => handleSave(true)}>
            <Text style={secondaryButtonText}>Save as draft</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[primaryButton, saving && primaryButtonDisabled]}
            disabled={saving}
            onPress={() => handleSave(false)}
          >
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
  topBarTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.navy,
  },
  stepLabel: {
    fontSize: 12,
    color: colors.muted,
    marginBottom: 4,
  },
});
