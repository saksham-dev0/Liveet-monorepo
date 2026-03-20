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
  card as cardStyle,
  container as containerStyle,
  input as inputStyle,
  label as labelStyle,
  stepLabel as stepLabelStyle,
  title as titleStyle,
  subtitle as subtitleStyle,
  errorText as errorTextStyle,
  loadingRow as loadingRowStyle,
  loadingText as loadingTextStyle,
  primaryButton as primaryButtonStyle,
  primaryButtonDisabled as primaryButtonDisabledStyle,
  primaryButtonText as primaryButtonTextStyle,
} from "../../constants/theme";

type City = {
  _id: string;
  name: string;
};

export default function PersonalDetailsScreen() {
  const router = useRouter();
  const convex = useConvex();
  const { citiesJson } = useLocalSearchParams<{ citiesJson?: string }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [brandName, setBrandName] = useState("");
  const [totalUnits, setTotalUnits] = useState("");
  const [totalProperties, setTotalProperties] = useState("");
  const [selectedCities, setSelectedCities] = useState<City[]>([]);
  const [preferredLanguage, setPreferredLanguage] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await (convex as any).query(
          "onboarding:getOnboardingStatus",
          {},
        );
        if (cancelled || !status) return;

        const profile = status.onboardingProfile;
        if (profile) {
          setFullName(profile.fullName ?? "");
          setBrandName(profile.brandName ?? "");
          setTotalUnits(
            profile.totalUnits != null ? String(profile.totalUnits) : "",
          );
          setTotalProperties(
            profile.totalProperties != null
              ? String(profile.totalProperties)
              : "",
          );
          setPreferredLanguage(profile.preferredLanguage ?? "");
        } else if (status.user && status.user.name) {
          setFullName(status.user.name);
        }

        if (
          !citiesJson &&
          profile?.operatingCityIds &&
          profile.operatingCityIds.length > 0
        ) {
          const cities: City[] = [];
          for (const cityId of profile.operatingCityIds) {
            const city = await (convex as any).query("cities:getById", {
              cityId,
            });
            if (city) cities.push(city);
          }
          if (!cancelled) {
            setSelectedCities(cities);
          }
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [convex, citiesJson]);

  const handleSave = async () => {
    if (!fullName.trim()) {
      setError("Full name is required.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const operatingCityIds = selectedCities.map((c) => c._id);
      await (convex as any).mutation("onboarding:upsertPersonalDetails", {
        fullName: fullName.trim(),
        brandName: brandName.trim() || undefined,
        totalUnits: totalUnits ? Number(totalUnits) : undefined,
        totalProperties: totalProperties ? Number(totalProperties) : undefined,
        operatingCityIds,
        preferredLanguage: preferredLanguage.trim() || undefined,
      });
      router.push("/(onboarding)/business-details");
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleSelectCities = async () => {
    if (fullName.trim()) {
      try {
        const operatingCityIds = selectedCities.map((c) => c._id);
        await (convex as any).mutation("onboarding:upsertPersonalDetails", {
          fullName: fullName.trim(),
          brandName: brandName.trim() || undefined,
          totalUnits: totalUnits ? Number(totalUnits) : undefined,
          totalProperties: totalProperties ? Number(totalProperties) : undefined,
          operatingCityIds,
          preferredLanguage: preferredLanguage.trim() || undefined,
        });
      } catch {
        // Ignore autosave errors; user can still continue.
      }
    }

    router.push({
      pathname: "/(onboarding)/cities-modal",
      params: {
        selectedIds: selectedCities.map((c) => c._id).join(","),
      },
    } as any);
  };

  useEffect(() => {
    if (!citiesJson) return;
    try {
      const parsed = JSON.parse(String(citiesJson)) as City[];
      setSelectedCities(parsed);
    } catch {
      // ignore parse error
    }
  }, [citiesJson]);

  const isContinueDisabled = saving || !fullName.trim();

  return (
    <ScrollView
      contentContainerStyle={containerStyle}
      keyboardShouldPersistTaps="handled"
    >
      <View style={cardStyle}>
        <Text style={stepLabelStyle}>Step 1 of 2 · Personal details</Text>
        <Text style={titleStyle}>Welcome to Liveet</Text>
        <Text style={subtitleStyle}>
          Please tell us a little bit about you
        </Text>

        {loading && (
          <View style={loadingRowStyle}>
            <ActivityIndicator color={colors.primary} />
            <Text style={loadingTextStyle}>Loading your details...</Text>
          </View>
        )}

        {error ? <Text style={errorTextStyle}>{error}</Text> : null}

        <Text style={labelStyle}>Full name</Text>
        <TextInput
          style={inputStyle}
          placeholder="Full name"
          placeholderTextColor={colors.muted}
          value={fullName}
          onChangeText={setFullName}
          autoCapitalize="words"
        />

        <Text style={labelStyle}>Brand name</Text>
        <TextInput
          style={inputStyle}
          placeholder="Brand name"
          placeholderTextColor={colors.muted}
          value={brandName}
          onChangeText={setBrandName}
        />

        <Text style={labelStyle}>How many units do you manage?</Text>
        <TextInput
          style={inputStyle}
          placeholder="Total units"
          placeholderTextColor={colors.muted}
          keyboardType="number-pad"
          value={totalUnits}
          onChangeText={setTotalUnits}
        />

        <Text style={labelStyle}>How many properties do you have?</Text>
        <TextInput
          style={inputStyle}
          placeholder="Total properties"
          placeholderTextColor={colors.muted}
          keyboardType="number-pad"
          value={totalProperties}
          onChangeText={setTotalProperties}
        />

        <Text style={labelStyle}>Where do you operate?</Text>
        <TouchableOpacity style={styles.selector} onPress={handleSelectCities}>
          <Text style={styles.selectorText}>
            {selectedCities.length === 0
              ? "Add cities"
              : selectedCities.map((c) => c.name).join(", ")}
          </Text>
        </TouchableOpacity>

        <Text style={labelStyle}>What's your preferred language?</Text>
        <TextInput
          style={inputStyle}
          placeholder="Preferred language"
          placeholderTextColor={colors.muted}
          value={preferredLanguage}
          onChangeText={setPreferredLanguage}
        />

        <TouchableOpacity
          style={[
            primaryButtonStyle,
            isContinueDisabled && primaryButtonDisabledStyle,
            { marginTop: 28 },
          ]}
          disabled={isContinueDisabled}
          onPress={handleSave}
        >
          <Text style={primaryButtonTextStyle}>
            {saving ? "Saving..." : "Continue"}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  selector: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.inputBg,
  },
  selectorText: {
    fontSize: 15,
    color: colors.muted,
  },
});
