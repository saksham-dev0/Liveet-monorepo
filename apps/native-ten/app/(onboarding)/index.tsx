import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useConvex } from "convex/react";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../constants/theme";

type MatchedTenant = {
  importedTenantId: string;
  tenantName: string;
  propertyName: string | null;
  propertyCity: string | null;
  propertyState: string | null;
  propertyLine1: string | null;
  roomNumber: string | null;
  roomType: string | null;
  rent: number | null;
  moveInDate: string | null;
};

type Step = "form" | "verify";

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const convex = useConvex();

  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [isAlreadyInLiveet, setIsAlreadyInLiveet] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [matchedTenant, setMatchedTenant] = useState<MatchedTenant | null>(null);

  const canSubmit = name.trim().length > 0 && phone.trim().length > 0 && isAlreadyInLiveet !== null;

  async function handleContinue() {
    if (!canSubmit) return;
    setLoading(true);
    try {
      if (isAlreadyInLiveet) {
        const match = await (convex as any).query("users:lookupImportedTenantByPhone", {
          phone: phone.trim(),
        });
        if (match) {
          setMatchedTenant(match);
          setStep("verify");
          return;
        }
      }
      await submitOnboarding(false);
    } catch {
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function submitOnboarding(skipToLiveet: boolean) {
    setLoading(true);
    try {
      await (convex as any).mutation("users:completeTenantOnboarding", {
        name: name.trim(),
        phone: phone.trim(),
        isAlreadyInLiveet: skipToLiveet || isAlreadyInLiveet!,
      });
      router.replace("/(app)");
    } catch {
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (step === "verify" && matchedTenant) {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          contentContainerStyle={[
            styles.container,
            { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => { setStep("form"); setMatchedTenant(null); }}
            disabled={loading}
          >
            <Ionicons name="arrow-back" size={20} color={colors.navy} />
          </TouchableOpacity>

          <View style={styles.verifyIconWrap}>
            <Ionicons name="shield-checkmark-outline" size={40} color={colors.primary} />
          </View>
          <Text style={styles.title}>Is this you?</Text>
          <Text style={styles.subtitle}>
            We found a record matching your contact number. Confirm if the details below are yours.
          </Text>

          <View style={styles.matchCard}>
            <DetailRow icon="person-outline" label="Name" value={matchedTenant.tenantName} />
            {(matchedTenant.propertyName || matchedTenant.propertyCity) && (
              <DetailRow
                icon="home-outline"
                label="Property"
                value={[matchedTenant.propertyName, matchedTenant.propertyCity, matchedTenant.propertyState]
                  .filter(Boolean)
                  .join(", ")}
              />
            )}
            {matchedTenant.propertyLine1 && (
              <DetailRow icon="location-outline" label="Address" value={matchedTenant.propertyLine1} />
            )}
            {matchedTenant.roomNumber && (
              <DetailRow icon="bed-outline" label="Room" value={`Room ${matchedTenant.roomNumber}${matchedTenant.roomType ? ` · ${matchedTenant.roomType}` : ""}`} />
            )}
            {matchedTenant.rent != null && (
              <DetailRow icon="cash-outline" label="Rent" value={`₹${matchedTenant.rent.toLocaleString("en-IN")} / month`} />
            )}
            {matchedTenant.moveInDate && (
              <DetailRow icon="calendar-outline" label="Move-in" value={matchedTenant.moveInDate} />
            )}
          </View>

          <TouchableOpacity
            style={[styles.button, loading && { opacity: 0.6 }]}
            onPress={() => void submitOnboarding(true)}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Yes, that's me</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.outlineButton, loading && { opacity: 0.4 }]}
            onPress={() => void submitOnboarding(false)}
            disabled={loading}
          >
            <Text style={styles.outlineButtonText}>No, this isn't me</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Tell us about yourself</Text>
        <Text style={styles.subtitle}>
          Just a few details to get you started on Liveet.
        </Text>

        <View style={styles.field}>
          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your full name"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            editable={!loading}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Contact Number</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your phone number"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            editable={!loading}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Are you already living in a Liveet property?</Text>
          <View style={styles.optionRow}>
            <TouchableOpacity
              style={[
                styles.option,
                isAlreadyInLiveet === true && styles.optionSelected,
              ]}
              onPress={() => setIsAlreadyInLiveet(true)}
              disabled={loading}
            >
              <Text
                style={[
                  styles.optionText,
                  isAlreadyInLiveet === true && styles.optionTextSelected,
                ]}
              >
                Yes
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.option,
                isAlreadyInLiveet === false && styles.optionSelected,
              ]}
              onPress={() => setIsAlreadyInLiveet(false)}
              disabled={loading}
            >
              <Text
                style={[
                  styles.optionText,
                  isAlreadyInLiveet === false && styles.optionTextSelected,
                ]}
              >
                No
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.button, !canSubmit && styles.buttonDisabled]}
          onPress={() => void handleContinue()}
          disabled={!canSubmit || loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Continue</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIconWrap}>
        <Ionicons name={icon} size={16} color={colors.primary} />
      </View>
      <View style={styles.detailText}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    backgroundColor: "#fff",
  },
  backBtn: {
    alignSelf: "flex-start",
    marginBottom: 20,
    padding: 4,
  },
  verifyIconWrap: {
    alignSelf: "flex-start",
    marginBottom: 12,
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.navy,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "#6b7280",
    marginBottom: 32,
    lineHeight: 22,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.navy,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.navy,
    backgroundColor: "#f9fafb",
  },
  optionRow: {
    flexDirection: "row",
    gap: 12,
  },
  option: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#f9fafb",
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  optionText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#6b7280",
  },
  optionTextSelected: {
    color: "#fff",
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 12,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  outlineButton: {
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 12,
  },
  outlineButtonText: {
    color: "#6b7280",
    fontSize: 16,
    fontWeight: "600",
  },
  matchCard: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
    backgroundColor: "#f9fafb",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  detailIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    marginTop: 1,
  },
  detailText: { flex: 1 },
  detailLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.navy,
    lineHeight: 20,
  },
});
