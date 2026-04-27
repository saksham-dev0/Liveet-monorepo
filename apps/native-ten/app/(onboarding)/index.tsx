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
import { colors } from "../../constants/theme";

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const convex = useConvex();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [isAlreadyInLiveet, setIsAlreadyInLiveet] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  const canSubmit = name.trim().length > 0 && phone.trim().length > 0 && isAlreadyInLiveet !== null;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      await (convex as any).mutation("users:completeTenantOnboarding", {
        name: name.trim(),
        phone: phone.trim(),
        isAlreadyInLiveet: isAlreadyInLiveet!,
      });
      router.replace("/(app)");
    } catch {
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

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
          onPress={handleSubmit}
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

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    backgroundColor: "#fff",
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
});
