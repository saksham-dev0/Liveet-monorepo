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
import { useRouter } from "expo-router";
import { useConvex } from "convex/react";
import {
  colors,
  card as cardStyle,
  container as containerStyle,
  input as inputStyle,
  label as labelStyle,
  title as titleStyle,
  subtitle as subtitleStyle,
  errorText as errorTextStyle,
  primaryButton,
  primaryButtonDisabled,
  primaryButtonText,
  secondaryButton,
  secondaryButtonText,
  footerRow,
} from "../../constants/theme";

export default function ReferralScreen() {
  const router = useRouter();
  const convex = useConvex();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await (convex as any).query(
          "onboarding:getOnboardingStatus",
          {},
        );
        if (cancelled || !status) return;
        if (status.referralCode) {
          setCode(status.referralCode);
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
  }, [convex]);

  const handleNext = async () => {
    setSaving(true);
    setError(null);
    try {
      if (code.trim()) {
        await (convex as any).mutation("onboarding:setReferralCode", {
          referralCode: code.trim(),
        });
      }
      router.push("/(onboarding)/success");
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={containerStyle}>
      <View style={cardStyle}>
        <Text style={titleStyle}>Add referral code</Text>
        <Text style={subtitleStyle}>
          If you have a referral code, add it here. You can skip this step if
          you don't have one.
        </Text>

        {loading && (
          <View style={styles.loadingCenter}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}

        {error ? <Text style={errorTextStyle}>{error}</Text> : null}

        <Text style={labelStyle}>Referral code</Text>
        <TextInput
          style={inputStyle}
          placeholder="Enter referral code"
          placeholderTextColor={colors.muted}
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
        />

        <View style={footerRow}>
          <TouchableOpacity
            style={secondaryButton}
            onPress={() => router.push("/(onboarding)/success")}
          >
            <Text style={secondaryButtonText}>Skip</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[primaryButton, saving && primaryButtonDisabled]}
            disabled={saving}
            onPress={handleNext}
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
  loadingCenter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
});
