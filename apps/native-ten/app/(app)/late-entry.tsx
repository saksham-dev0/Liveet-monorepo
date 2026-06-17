import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { useMutation } from "convex/react";
import { anyApi } from "convex/server";
import { colors, radii } from "@/constants/theme";

const submitLateEntryRef = anyApi.tenants.submitLateEntry;

export default function LateEntryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const submitLateEntry = useMutation(submitLateEntryRef);

  const isValid = date.trim().length > 0 && time.trim().length > 0 && reason.trim().length > 0;

  async function handleSubmit() {
    if (!isValid) return;
    setLoading(true);
    try {
      await submitLateEntry({ date: date.trim(), time: time.trim(), reason: reason.trim() });
      Alert.alert("Request sent", "Your late entry request has been submitted.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to submit request.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 14 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={colors.navy} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Late Entry</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Info banner */}
        <View style={s.banner}>
          <Ionicons name="time-outline" size={20} color={colors.navy} style={{ marginTop: 1 }} />
          <Text style={s.bannerText}>
            Notify the gate that you will be arriving late. Fill in the details below.
          </Text>
        </View>

        {/* Date */}
        <Text style={s.label}>Return date</Text>
        <TextInput
          style={s.input}
          placeholder="DD/MM/YYYY"
          placeholderTextColor={colors.muted}
          value={date}
          onChangeText={setDate}
          keyboardType={Platform.OS === "ios" ? "numbers-and-punctuation" : "default"}
          returnKeyType="next"
        />

        {/* Time */}
        <Text style={s.label}>Expected arrival time</Text>
        <TextInput
          style={s.input}
          placeholder="e.g. 10:30 PM"
          placeholderTextColor={colors.muted}
          value={time}
          onChangeText={setTime}
          returnKeyType="next"
        />

        {/* Reason */}
        <Text style={s.label}>Reason</Text>
        <TextInput
          style={[s.input, s.multiline]}
          placeholder="Brief reason for late arrival…"
          placeholderTextColor={colors.muted}
          value={reason}
          onChangeText={setReason}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          returnKeyType="done"
        />

        {/* Submit */}
        <TouchableOpacity
          style={[s.btn, (!isValid || loading) && s.btnDisabled]}
          activeOpacity={0.8}
          onPress={handleSubmit}
          disabled={!isValid || loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <Text style={s.btnText}>Submit request</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.pageBg,
  },
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceGray,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.navy,
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
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
  bannerText: {
    flex: 1,
    fontSize: 13,
    color: colors.muted,
    lineHeight: 19,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.navy,
    marginBottom: 6,
    marginTop: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.input,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    backgroundColor: colors.white,
    color: colors.navy,
  },
  multiline: {
    minHeight: 110,
    paddingTop: 13,
  },
  btn: {
    marginTop: 36,
    borderRadius: radii.pill,
    paddingVertical: 15,
    alignItems: "center",
    backgroundColor: colors.primary,
  },
  btnDisabled: {
    opacity: 0.35,
  },
  btnText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.white,
  },
});
