import { useEffect, useState } from "react";
import {
  ActivityIndicator,
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

export default function TenantDetailsScreen() {
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

  const [canStayMale, setCanStayMale] = useState(false);
  const [canStayFemale, setCanStayFemale] = useState(false);
  const [canStayOthers, setCanStayOthers] = useState(false);
  const [bestStudent, setBestStudent] = useState(false);
  const [bestWorking, setBestWorking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await (convex as any).query(
          "onboarding:getOnboardingStatus",
          {},
        );
        if (cancelled || !status) return;

        const prop = status.property;
        if (prop && !propertyId) setPropertyId(prop._id);

        const t = status.tenantDetails;
        if (t) {
          setCanStayMale(!!t.canStayMale);
          setCanStayFemale(!!t.canStayFemale);
          setCanStayOthers(!!t.canStayOthers);
          setBestStudent(!!t.bestForStudent);
          setBestWorking(!!t.bestForWorkingProfessional);
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
      setError("Please complete basic property details first.");
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
      router.push({
        pathname: "/(onboarding)/property/rooms",
        params: { propertyId },
      } as any);
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const toggle = (value: boolean, setter: (v: boolean) => void) =>
    setter(!value);

  return (
    <ScrollView contentContainerStyle={container}>
      <View style={card}>
        <Text style={stepLabel}>Step 2 of 7 · Tenant details</Text>
        <Text style={title}>Tenant details</Text>

        {loading && (
          <View style={loadingRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={loadingText}>Loading tenant details...</Text>
          </View>
        )}

        {error ? <Text style={errorText}>{error}</Text> : null}

        <Text style={sectionHeader}>Who can stay</Text>
        <View style={chipRow}>
          <TouchableOpacity
            style={[chip, canStayMale && chipActive]}
            onPress={() => toggle(canStayMale, setCanStayMale)}
          >
            <Text style={[chipText, canStayMale && chipTextActive]}>Male</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[chip, canStayFemale && chipActive]}
            onPress={() => toggle(canStayFemale, setCanStayFemale)}
          >
            <Text
              style={[chipText, canStayFemale && chipTextActive]}
            >
              Female
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[chip, canStayOthers && chipActive]}
            onPress={() => toggle(canStayOthers, setCanStayOthers)}
          >
            <Text
              style={[chipText, canStayOthers && chipTextActive]}
            >
              Others
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={sectionHeader}>Best suited for</Text>
        <View style={chipRow}>
          <TouchableOpacity
            style={[chip, bestStudent && chipActive]}
            onPress={() => toggle(bestStudent, setBestStudent)}
          >
            <Text
              style={[chipText, bestStudent && chipTextActive]}
            >
              Student
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[chip, bestWorking && chipActive]}
            onPress={() => toggle(bestWorking, setBestWorking)}
          >
            <Text
              style={[chipText, bestWorking && chipTextActive]}
            >
              Working professional
            </Text>
          </TouchableOpacity>
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
