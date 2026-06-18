import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../packages/backend/convex/_generated/api";
import { colors, radii } from "@/constants/theme";

const getMyEditableProfileRef = api.tenants.getMyEditableProfile;
const updateTenantProfileRef = api.tenants.updateTenantProfile;

type Section = {
  title: string;
  icon: string;
  fields: Field[];
};

type Field = {
  key: keyof FormState;
  label: string;
  placeholder: string;
  keyboardType?: "default" | "phone-pad" | "email-address";
  required?: boolean;
};

type FormState = {
  studentName: string;
  studentPhone: string;
  studentEmail: string;
  course: string;
  parentName: string;
  parentPhone: string;
  parentEmail: string;
};

const SECTIONS: Section[] = [
  {
    title: "Personal info",
    icon: "person-outline",
    fields: [
      { key: "studentName", label: "Full name", placeholder: "Your full name", required: true },
      { key: "studentPhone", label: "Phone number", placeholder: "10-digit mobile number", keyboardType: "phone-pad", required: true },
      { key: "studentEmail", label: "Email address", placeholder: "your@email.com", keyboardType: "email-address" },
      { key: "course", label: "Course / Occupation", placeholder: "e.g. B.Tech CSE, Software Engineer" },
    ],
  },
  {
    title: "Guardian & emergency contact",
    icon: "people-outline",
    fields: [
      { key: "parentName", label: "Guardian name", placeholder: "Parent or guardian's name" },
      { key: "parentPhone", label: "Guardian phone", placeholder: "Guardian's mobile number", keyboardType: "phone-pad" },
      { key: "parentEmail", label: "Guardian email", placeholder: "guardian@email.com", keyboardType: "email-address" },
    ],
  },
];

const EMPTY: FormState = {
  studentName: "",
  studentPhone: "",
  studentEmail: "",
  course: "",
  parentName: "",
  parentPhone: "",
  parentEmail: "",
};

export default function PersonalScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const profile = useQuery(getMyEditableProfileRef);
  const updateProfile = useMutation(updateTenantProfileRef);

  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [initialised, setInitialised] = useState(false);

  useEffect(() => {
    if (profile && !initialised) {
      setForm({
        studentName: profile.studentName ?? "",
        studentPhone: profile.studentPhone ?? "",
        studentEmail: profile.studentEmail ?? "",
        course: profile.course ?? "",
        parentName: profile.parentName ?? "",
        parentPhone: profile.parentPhone ?? "",
        parentEmail: profile.parentEmail ?? "",
      });
      setInitialised(true);
    }
  }, [profile, initialised]);

  const isValid = form.studentName.trim().length > 0 && form.studentPhone.trim().length > 0;

  function set(key: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!isValid) return;
    setLoading(true);
    try {
      await updateProfile({
        studentName: form.studentName.trim(),
        studentPhone: form.studentPhone.trim(),
        studentEmail: form.studentEmail.trim() || undefined,
        course: form.course.trim() || undefined,
        parentName: form.parentName.trim() || undefined,
        parentPhone: form.parentPhone.trim() || undefined,
        parentEmail: form.parentEmail.trim() || undefined,
      });
      Alert.alert("Saved", "Your details have been updated.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to save details.");
    } finally {
      setLoading(false);
    }
  }

  const isLoading = profile === undefined;

  return (
    <View style={s.root}>
      <View style={[s.header, { paddingTop: insets.top + 14 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={colors.navy} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Edit basic details</Text>
        <View style={{ width: 36 }} />
      </View>

      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : profile === null ? (
        <View style={s.center}>
          <Ionicons name="alert-circle-outline" size={40} color={colors.muted} />
          <Text style={s.emptyText}>No active tenancy found.</Text>
          <Text style={s.emptySubText}>Profile editing is available once you have an active booking.</Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 32 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={s.banner}>
              <Ionicons name="information-circle-outline" size={20} color={colors.navy} style={{ marginTop: 1 }} />
              <Text style={s.bannerText}>
                Keep your contact and guardian info up to date so your operator can reach you.
              </Text>
            </View>

            {SECTIONS.map((section) => (
              <View key={section.title} style={s.section}>
                <View style={s.sectionHeader}>
                  <Ionicons name={section.icon as any} size={16} color={colors.navy} />
                  <Text style={s.sectionTitle}>{section.title}</Text>
                </View>
                {section.fields.map((field) => (
                  <View key={field.key}>
                    <Text style={s.label}>
                      {field.label}
                      {field.required && <Text style={s.required}> *</Text>}
                    </Text>
                    <TextInput
                      style={s.input}
                      placeholder={field.placeholder}
                      placeholderTextColor={colors.muted}
                      value={form[field.key]}
                      onChangeText={(v) => set(field.key, v)}
                      keyboardType={field.keyboardType ?? "default"}
                      autoCapitalize={field.keyboardType === "email-address" ? "none" : "words"}
                      returnKeyType="next"
                    />
                  </View>
                ))}
              </View>
            ))}

            <TouchableOpacity
              style={[s.btn, (!isValid || loading) && s.btnDisabled]}
              activeOpacity={0.8}
              onPress={handleSave}
              disabled={!isValid || loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={s.btnText}>Save changes</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.surfaceGray,
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: colors.navy },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 32 },
  emptyText: { fontSize: 16, fontWeight: "700", color: colors.navy, textAlign: "center" },
  emptySubText: { fontSize: 13, color: colors.muted, textAlign: "center", lineHeight: 19 },
  body: { paddingHorizontal: 20, paddingTop: 20 },
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: colors.white,
    borderRadius: radii.card,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bannerText: { flex: 1, fontSize: 13, color: colors.muted, lineHeight: 19 },
  section: {
    marginTop: 24,
    backgroundColor: colors.white,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 4,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.navy },
  label: { fontSize: 12, fontWeight: "600", color: colors.muted, marginBottom: 6, marginTop: 14 },
  required: { color: "#ef4444" },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.input,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    backgroundColor: colors.pageBg,
    color: colors.navy,
  },
  btn: {
    marginTop: 36,
    borderRadius: radii.pill,
    paddingVertical: 15,
    alignItems: "center",
    backgroundColor: colors.primary,
  },
  btnDisabled: { opacity: 0.35 },
  btnText: { fontSize: 15, fontWeight: "700", color: colors.white },
});
