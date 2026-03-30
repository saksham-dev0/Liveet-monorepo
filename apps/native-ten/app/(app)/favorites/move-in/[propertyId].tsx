import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useConvex } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { colors, radii, cardShadow } from "../../../../constants/theme";
import { BottomSheet } from "../../../../components/BottomSheet";

type RoomOption = {
  id: string;
  label: string;
  rentAmount: number | null;
  category: string;
};

type Field = {
  key: keyof FormState;
  label: string;
  placeholder: string;
  keyboardType?: "default" | "phone-pad" | "email-address";
  hint?: string;
};

type FormState = {
  name: string;
  phone: string;
  email: string;
  dateOfBirth: string;
  address: string;
  moveInDate: string;
};

const FIELDS: Field[] = [
  { key: "name", label: "Full name", placeholder: "Enter your full name" },
  {
    key: "phone",
    label: "Contact number",
    placeholder: "e.g. 9876543210",
    keyboardType: "phone-pad",
  },
  {
    key: "email",
    label: "Email address",
    placeholder: "you@example.com",
    keyboardType: "email-address",
  },
  {
    key: "dateOfBirth",
    label: "Date of birth",
    placeholder: "DD/MM/YYYY",
    hint: "Format: DD/MM/YYYY",
  },
  {
    key: "address",
    label: "Current address",
    placeholder: "Street, city, state",
  },
  {
    key: "moveInDate",
    label: "Preferred move-in date",
    placeholder: "DD/MM/YYYY",
    hint: "Format: DD/MM/YYYY",
  },
];

function formatRent(amount: number | null): string {
  if (amount == null) return "";
  if (amount >= 1000) {
    const k = amount / 1000;
    const rounded = Math.round(k * 10) / 10;
    const str = rounded.toFixed(1).replace(/\.0$/, "");
    return `  ·  ₹${str}K/mo`;
  }
  return `  ·  ₹${amount.toLocaleString("en-IN")}/mo`;
}

export default function MoveInRequestScreen() {
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const convex = useConvex();

  const [form, setForm] = useState<FormState>({
    name: "",
    phone: "",
    email: "",
    dateOfBirth: "",
    address: "",
    moveInDate: "",
  });
  const [roomOptions, setRoomOptions] = useState<RoomOption[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<RoomOption | null>(null);
  const [roomSheetOpen, setRoomSheetOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!propertyId) return;
    (convex as any)
      .query("properties:getPropertyRoomOptionsForTenant", { propertyId })
      .then((res: any) => {
        setRoomOptions((res?.items ?? []) as RoomOption[]);
      })
      .catch(() => setRoomOptions([]));
  }, [convex, propertyId]);

  function setField(key: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const allFilled = FIELDS.every((f) => form[f.key].trim().length > 0);

  async function handleSubmit() {
    if (!allFilled || submitting) return;
    setSubmitting(true);
    try {
      await (convex as any).mutation("moveIn:submitQuickMoveInRequest", {
        propertyId,
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        dateOfBirth: form.dateOfBirth.trim(),
        address: form.address.trim(),
        moveInDate: form.moveInDate.trim(),
        selectedRoomOptionId: selectedRoom?.id ?? undefined,
      });
      setSubmitted(true);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <View style={[s.root, { paddingTop: insets.top }]}>
        <View style={s.successWrap}>
          <View style={s.successCircle}>
            <Ionicons name="checkmark" size={40} color={colors.white} />
          </View>
          <Text style={s.successTitle}>Request sent!</Text>
          <Text style={s.successSubtitle}>
            Your move-in request has been submitted. The property owner will review it
            and get back to you.
          </Text>
          <TouchableOpacity
            style={s.doneBtn}
            activeOpacity={0.8}
            onPress={() => router.back()}
          >
            <Text style={s.doneBtnText}>Back to Liked Properties</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[s.root, { paddingTop: insets.top }]}>
          {/* Header */}
          <View style={s.header}>
            <TouchableOpacity
              style={s.backBtn}
              onPress={() => router.back()}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Ionicons name="chevron-back" size={18} color={colors.navy} />
            </TouchableOpacity>
            <View style={s.hCenter}>
              <Text style={s.hTitle}>Move-in Request</Text>
            </View>
            <View style={s.backBtn} />
          </View>

          <ScrollView
            contentContainerStyle={s.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={s.subheading}>
              Fill in your basic details so the owner can review your move-in request.
            </Text>

            {/* Room type picker */}
            <View style={s.fieldWrap}>
              <Text style={s.fieldLabel}>Room type</Text>
              <TouchableOpacity
                style={[s.input, s.pickerRow]}
                activeOpacity={0.75}
                onPress={() => setRoomSheetOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Select room type"
              >
                <Text
                  style={[
                    s.pickerText,
                    !selectedRoom && s.pickerPlaceholder,
                  ]}
                  numberOfLines={1}
                >
                  {selectedRoom
                    ? `${selectedRoom.label}${formatRent(selectedRoom.rentAmount)}`
                    : "Select a room type (optional)"}
                </Text>
                <Ionicons
                  name="chevron-down"
                  size={16}
                  color={colors.muted}
                  style={{ marginLeft: 6 }}
                />
              </TouchableOpacity>
            </View>

            {FIELDS.map((field) => (
              <View key={field.key} style={s.fieldWrap}>
                <Text style={s.fieldLabel}>{field.label}</Text>
                <TextInput
                  style={s.input}
                  value={form[field.key]}
                  onChangeText={(v) => setField(field.key, v)}
                  placeholder={field.placeholder}
                  placeholderTextColor="rgba(107,114,128,0.8)"
                  keyboardType={field.keyboardType ?? "default"}
                  autoCapitalize={field.key === "email" ? "none" : "words"}
                  autoCorrect={false}
                />
                {field.hint ? (
                  <Text style={s.hint}>{field.hint}</Text>
                ) : null}
              </View>
            ))}

            <TouchableOpacity
              style={[s.submitBtn, (!allFilled || submitting) && s.submitBtnDisabled]}
              activeOpacity={0.85}
              onPress={handleSubmit}
              disabled={!allFilled || submitting}
            >
              {submitting ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={s.submitBtnText}>Submit Request</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      {/* Room type bottom sheet */}
      <BottomSheet
        visible={roomSheetOpen}
        onClose={() => setRoomSheetOpen(false)}
        title="Select room type"
        maxHeight="70%"
      >
        <ScrollView
          style={s.sheetScroll}
          contentContainerStyle={s.sheetScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {roomOptions.length === 0 ? (
            <View style={s.sheetEmpty}>
              <Ionicons name="bed-outline" size={32} color={colors.muted} />
              <Text style={s.sheetEmptyText}>No room types listed for this property.</Text>
            </View>
          ) : (
            <>
              {/* Clear selection option */}
              {selectedRoom && (
                <TouchableOpacity
                  style={s.sheetOption}
                  activeOpacity={0.7}
                  onPress={() => {
                    setSelectedRoom(null);
                    setRoomSheetOpen(false);
                  }}
                >
                  <View style={s.sheetOptionLeft}>
                    <Ionicons name="close-circle-outline" size={20} color={colors.muted} />
                    <Text style={[s.sheetOptionLabel, { color: colors.muted }]}>
                      Clear selection
                    </Text>
                  </View>
                </TouchableOpacity>
              )}

              {roomOptions.map((option) => {
                const isSelected = selectedRoom?.id === option.id;
                return (
                  <TouchableOpacity
                    key={option.id}
                    style={[s.sheetOption, isSelected && s.sheetOptionSelected]}
                    activeOpacity={0.7}
                    onPress={() => {
                      setSelectedRoom(option);
                      setRoomSheetOpen(false);
                    }}
                  >
                    <View style={s.sheetOptionLeft}>
                      <View
                        style={[
                          s.sheetOptionIcon,
                          isSelected && s.sheetOptionIconSelected,
                        ]}
                      >
                        <Ionicons
                          name="bed-outline"
                          size={18}
                          color={isSelected ? colors.white : colors.navy}
                        />
                      </View>
                      <View>
                        <Text
                          style={[
                            s.sheetOptionLabel,
                            isSelected && s.sheetOptionLabelSelected,
                          ]}
                        >
                          {option.label}
                        </Text>
                        {option.rentAmount != null && (
                          <Text style={s.sheetOptionRent}>
                            ₹{option.rentAmount.toLocaleString("en-IN")} / month
                          </Text>
                        )}
                      </View>
                    </View>
                    {isSelected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color={colors.primary}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </>
          )}
        </ScrollView>
      </BottomSheet>
    </>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg, paddingHorizontal: 16 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    paddingTop: 4,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    ...cardShadow,
    shadowOpacity: 0.06,
    elevation: 2,
  },
  hCenter: { flex: 1, alignItems: "center" },
  hTitle: { fontSize: 20, fontWeight: "800", color: colors.navy },

  scrollContent: { paddingBottom: 36 },

  subheading: {
    fontSize: 14,
    color: colors.muted,
    fontWeight: "500",
    lineHeight: 20,
    marginBottom: 20,
    marginTop: 4,
  },

  fieldWrap: { marginBottom: 14 },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.navy,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.white,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: colors.navy,
    fontWeight: "500",
  },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pickerText: {
    flex: 1,
    fontSize: 15,
    color: colors.navy,
    fontWeight: "500",
  },
  pickerPlaceholder: {
    color: "rgba(107,114,128,0.8)",
    fontWeight: "400",
  },
  hint: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 4,
    marginLeft: 2,
  },

  submitBtn: {
    marginTop: 24,
    borderRadius: radii.pill,
    paddingVertical: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnDisabled: { backgroundColor: colors.primaryLight },
  submitBtnText: { fontSize: 15, fontWeight: "700", color: colors.white },

  // Bottom sheet styles
  sheetScroll: { marginTop: 4 },
  sheetScrollContent: { paddingBottom: 8 },
  sheetEmpty: {
    paddingVertical: 32,
    alignItems: "center",
    gap: 12,
  },
  sheetEmptyText: {
    fontSize: 14,
    color: colors.muted,
    textAlign: "center",
  },
  sheetOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetOptionSelected: {
    backgroundColor: "rgba(30,41,59,0.04)",
    borderRadius: 10,
    marginHorizontal: -4,
    paddingHorizontal: 8,
  },
  sheetOptionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  sheetOptionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.inputBg,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetOptionIconSelected: {
    backgroundColor: colors.primary,
  },
  sheetOptionLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.navy,
  },
  sheetOptionLabelSelected: { color: colors.navy },
  sheetOptionRent: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: "500",
    marginTop: 2,
  },

  // Success screen
  successWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingBottom: 40,
  },
  successCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.navy,
    marginBottom: 10,
  },
  successSubtitle: {
    fontSize: 14,
    color: colors.muted,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
  },
  doneBtn: {
    borderRadius: radii.pill,
    paddingVertical: 14,
    paddingHorizontal: 32,
    backgroundColor: colors.primary,
    alignItems: "center",
  },
  doneBtnText: { fontSize: 15, fontWeight: "700", color: colors.white },
});
