import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useConvex } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { colors, radii, cardShadow } from "../../../constants/theme";

// ─── Types ───────────────────────────────────────────────────────────────────

const GOV_ID_TYPES = [
  "PAN",
  "Aadhar card",
  "Passport",
  "Driving License",
  "College ID",
  "Others",
] as const;
type GovIdType = (typeof GOV_ID_TYPES)[number];

const MARITAL_OPTIONS = ["single", "married"] as const;
type MaritalStatus = (typeof MARITAL_OPTIONS)[number];

const PAYMENT_METHODS = ["Bank transfer", "UPI", "Cash"] as const;
type PaymentMethod = (typeof PAYMENT_METHODS)[number];

type RoomOption = { id: string; label: string; rentAmount: number | null };

type Step = 1 | 2;

type EmergencyContact = { id: string; name: string; phone: string; relation: string };

function uid() {
  return `ec-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Step progress bar ───────────────────────────────────────────────────────

function StepBar({ step }: { step: Step }) {
  return (
    <View style={sb.row}>
      {([1, 2] as Step[]).map((n) => (
        <View key={n} style={[sb.seg, step >= n ? sb.segActive : sb.segInactive]} />
      ))}
    </View>
  );
}
const sb = StyleSheet.create({
  row: { flexDirection: "row", gap: 6, marginBottom: 20, marginTop: 4 },
  seg: { flex: 1, height: 4, borderRadius: 2 },
  segActive: { backgroundColor: colors.primary },
  segInactive: { backgroundColor: colors.progressTrack },
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function SectionLabel({ text }: { text: string }) {
  return <Text style={s.sectionLabel}>{text}</Text>;
}

function FieldWrap({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={s.fieldWrap}>
      <Text style={s.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function ChipRow<T extends string>({
  options,
  value,
  onChange,
  labelFor,
}: {
  options: readonly T[];
  value: T | null;
  onChange: (v: T) => void;
  labelFor?: (v: T) => string;
}) {
  return (
    <View style={s.chipRow}>
      {options.map((opt) => {
        const active = value === opt;
        return (
          <TouchableOpacity
            key={opt}
            style={[s.chip, active && s.chipActive]}
            activeOpacity={0.75}
            onPress={() => onChange(opt)}
          >
            <Text style={[s.chipText, active && s.chipTextActive]}>
              {labelFor ? labelFor(opt) : opt}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function KycPaymentScreen() {
  const { propertyId, title } = useLocalSearchParams<{
    propertyId: string;
    applicationId?: string;
    title?: string;
  }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const convex = useConvex();

  const propertyName = typeof title === "string" && title ? title : "Property";

  // ── Step 1: KYC ──
  const [govIdType, setGovIdType] = useState<GovIdType | null>(null);
  const [govIdNumber, setGovIdNumber] = useState("");
  const [govIdPhotoUri, setGovIdPhotoUri] = useState<string | null>(null);
  const [govIdPhotoStorageId, setGovIdPhotoStorageId] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [maritalStatus, setMaritalStatus] = useState<MaritalStatus | null>(null);
  const [professionalDetails, setProfessionalDetails] = useState("");
  const [contacts, setContacts] = useState<EmergencyContact[]>([
    { id: uid(), name: "", phone: "", relation: "" },
  ]);

  // ── Step 2: Room & Payment ──
  const [roomOptions, setRoomOptions] = useState<RoomOption[]>([]);
  const [selectedRoomOptionId, setSelectedRoomOptionId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [agreementAccepted, setAgreementAccepted] = useState(false);

  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Load room options for step 2
  useEffect(() => {
    if (!propertyId) return;
    (convex as any)
      .query("properties:getPropertyRoomOptionsForTenant", { propertyId })
      .then((res: any) => setRoomOptions((res?.items ?? []) as RoomOption[]))
      .catch(() => setRoomOptions([]));
  }, [convex, propertyId]);

  // ── Gov ID photo capture ──
  async function handleCaptureGovId() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Camera access is required to capture your ID photo.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      allowsEditing: false,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    setGovIdPhotoUri(asset.uri);
    setGovIdPhotoStorageId(null);
    setUploadingPhoto(true);
    try {
      const { uploadUrl } = await (convex as any).mutation("moveIn:generateMoveInIdUploadUrl", {});
      const fileResponse = await fetch(asset.uri);
      const blob = await fileResponse.blob();
      const uploadRes = await fetch(uploadUrl, {
        method: "POST",
        body: blob,
        headers: { "Content-Type": asset.mimeType ?? "image/jpeg" },
      });
      const { storageId } = await uploadRes.json();
      if (!storageId) throw new Error("Upload failed");
      setGovIdPhotoStorageId(storageId);
    } catch {
      Alert.alert("Upload failed", "Could not upload the photo. Please try again.");
      setGovIdPhotoUri(null);
      setGovIdPhotoStorageId(null);
    } finally {
      setUploadingPhoto(false);
    }
  }

  // ── Contact helpers ──
  function updateContact(id: string, field: keyof Omit<EmergencyContact, "id">, val: string) {
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: val } : c)));
  }
  function addContact() {
    setContacts((prev) => [...prev, { id: uid(), name: "", phone: "", relation: "" }]);
  }
  function removeContact(id: string) {
    setContacts((prev) => (prev.length > 1 ? prev.filter((c) => c.id !== id) : prev));
  }

  // ── Step 1 validation ──
  const step1Valid =
    !!govIdType &&
    govIdNumber.trim().length > 0 &&
    !!govIdPhotoStorageId &&
    !!maritalStatus &&
    professionalDetails.trim().length > 0 &&
    contacts.some((c) => c.name.trim() && c.phone.trim() && c.relation.trim());

  // ── Step 2 validation ──
  const step2Valid = !!paymentMethod && agreementAccepted;

  async function handleSubmit() {
    if (!step2Valid || submitting || !propertyId) return;
    setSubmitting(true);
    try {
      const validContacts = contacts.filter(
        (c) => c.name.trim() && c.phone.trim() && c.relation.trim(),
      );
      await (convex as any).mutation("moveIn:completeKycAndPayment", {
        propertyId,
        govIdType: govIdType!,
        govIdNumber: govIdNumber.trim(),
        idFrontFileId: govIdPhotoStorageId ?? undefined,
        maritalStatus: maritalStatus!,
        professionalDetails: professionalDetails.trim(),
        emergencyContacts: validContacts.map(({ name, phone, relation }) => ({
          name: name.trim(),
          phone: phone.trim(),
          relation: relation.trim(),
        })),
        selectedRoomOptionId: selectedRoomOptionId ?? undefined,
        paymentMethod: paymentMethod!,
        agreementAccepted: true,
      });
      setSubmitted(true);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Success ──
  if (submitted) {
    return (
      <View style={[s.root, { paddingTop: insets.top }]}>
        <View style={s.successWrap}>
          <View style={s.successCircle}>
            <Ionicons name="checkmark" size={44} color={colors.white} />
          </View>
          <Text style={s.successTitle}>You're all set!</Text>
          <Text style={s.successSub}>
            Your KYC and payment details have been submitted. Your landlord will
            confirm your room assignment shortly.
          </Text>
          <TouchableOpacity style={s.doneBtn} activeOpacity={0.85} onPress={() => router.back()}>
            <Text style={s.doneBtnText}>Back to Chat</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[s.root, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity
            style={s.backBtn}
            onPress={() => (step === 1 ? router.back() : setStep(1))}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={18} color={colors.navy} />
          </TouchableOpacity>
          <View style={s.hCenter}>
            <Text style={s.hTitle} numberOfLines={1}>
              {step === 1 ? "Identity & Details" : "Room & Payment"}
            </Text>
            <Text style={s.hSub} numberOfLines={1}>
              {propertyName}
            </Text>
          </View>
          <View style={s.backBtn} />
        </View>

        <StepBar step={step} />

        <ScrollView
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 1 ? (
            <>
              {/* ── Government ID ── */}
              <SectionLabel text="Government ID" />
              <FieldWrap label="ID type">
                <ChipRow
                  options={GOV_ID_TYPES}
                  value={govIdType}
                  onChange={setGovIdType}
                />
              </FieldWrap>

              <FieldWrap label="ID number">
                <TextInput
                  style={s.input}
                  value={govIdNumber}
                  onChangeText={setGovIdNumber}
                  placeholder="Enter ID number"
                  placeholderTextColor="rgba(107,114,128,0.75)"
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
              </FieldWrap>

              <FieldWrap label="ID photo (live capture)">
                <TouchableOpacity
                  style={s.cameraBox}
                  activeOpacity={0.75}
                  onPress={handleCaptureGovId}
                  disabled={uploadingPhoto}
                >
                  {govIdPhotoUri ? (
                    <>
                      <Image source={{ uri: govIdPhotoUri }} style={s.cameraPreview} resizeMode="cover" />
                      {uploadingPhoto && (
                        <View style={s.cameraOverlay}>
                          <ActivityIndicator color={colors.white} />
                          <Text style={s.cameraOverlayText}>Uploading…</Text>
                        </View>
                      )}
                      {!uploadingPhoto && govIdPhotoStorageId && (
                        <View style={s.cameraOverlay}>
                          <Ionicons name="checkmark-circle" size={28} color={colors.white} />
                        </View>
                      )}
                    </>
                  ) : (
                    <View style={s.cameraPlaceholder}>
                      {uploadingPhoto ? (
                        <ActivityIndicator color={colors.primary} />
                      ) : (
                        <>
                          <Ionicons name="camera-outline" size={32} color={colors.primary} />
                          <Text style={s.cameraPlaceholderText}>Tap to take a photo of your ID</Text>
                        </>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
                {govIdPhotoUri && !uploadingPhoto && (
                  <TouchableOpacity style={s.retakeBtn} onPress={handleCaptureGovId} activeOpacity={0.7}>
                    <Ionicons name="refresh-outline" size={14} color={colors.primary} />
                    <Text style={s.retakeBtnText}>Retake photo</Text>
                  </TouchableOpacity>
                )}
              </FieldWrap>

              {/* ── Personal ── */}
              <SectionLabel text="Personal details" />
              <FieldWrap label="Marital status">
                <ChipRow
                  options={MARITAL_OPTIONS}
                  value={maritalStatus}
                  onChange={setMaritalStatus}
                  labelFor={(v) => v.charAt(0).toUpperCase() + v.slice(1)}
                />
              </FieldWrap>

              <FieldWrap label="Occupation / professional details">
                <TextInput
                  style={[s.input, s.textArea]}
                  value={professionalDetails}
                  onChangeText={setProfessionalDetails}
                  placeholder="e.g. Software engineer at Infosys"
                  placeholderTextColor="rgba(107,114,128,0.75)"
                  multiline
                  textAlignVertical="top"
                />
              </FieldWrap>

              {/* ── Emergency contacts ── */}
              <SectionLabel text="Emergency contacts" />
              {contacts.map((c, i) => (
                <View key={c.id} style={s.contactCard}>
                  <View style={s.contactCardHeader}>
                    <Text style={s.contactCardTitle}>Contact {i + 1}</Text>
                    {contacts.length > 1 && (
                      <TouchableOpacity onPress={() => removeContact(c.id)} hitSlop={8}>
                        <Ionicons name="trash-outline" size={16} color={colors.error} />
                      </TouchableOpacity>
                    )}
                  </View>
                  <TextInput
                    style={[s.input, { marginBottom: 8 }]}
                    value={c.name}
                    onChangeText={(v) => updateContact(c.id, "name", v)}
                    placeholder="Full name"
                    placeholderTextColor="rgba(107,114,128,0.75)"
                  />
                  <TextInput
                    style={[s.input, { marginBottom: 8 }]}
                    value={c.phone}
                    onChangeText={(v) => updateContact(c.id, "phone", v)}
                    placeholder="Phone number"
                    placeholderTextColor="rgba(107,114,128,0.75)"
                    keyboardType="phone-pad"
                  />
                  <TextInput
                    style={s.input}
                    value={c.relation}
                    onChangeText={(v) => updateContact(c.id, "relation", v)}
                    placeholder="Relation (e.g. Parent, Sibling)"
                    placeholderTextColor="rgba(107,114,128,0.75)"
                  />
                </View>
              ))}
              <TouchableOpacity style={s.addContactBtn} onPress={addContact} activeOpacity={0.7}>
                <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                <Text style={s.addContactText}>Add another contact</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.nextBtn, !step1Valid && s.nextBtnDisabled]}
                activeOpacity={0.85}
                disabled={!step1Valid}
                onPress={() => setStep(2)}
              >
                <Text style={s.nextBtnText}>Next — Room & Payment</Text>
                <Ionicons name="arrow-forward" size={16} color={colors.white} style={{ marginLeft: 8 }} />
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* ── Room selection ── */}
              {roomOptions.length > 0 && (
                <>
                  <SectionLabel text="Room type preference" />
                  <View style={s.roomGrid}>
                    {roomOptions.map((opt) => {
                      const sel = selectedRoomOptionId === opt.id;
                      return (
                        <TouchableOpacity
                          key={opt.id}
                          style={[s.roomChip, sel && s.roomChipSelected]}
                          activeOpacity={0.75}
                          onPress={() => setSelectedRoomOptionId(sel ? null : opt.id)}
                        >
                          <Text style={[s.roomChipText, sel && s.roomChipTextSelected]}>
                            {opt.label}
                          </Text>
                          {opt.rentAmount != null && (
                            <Text style={[s.roomChipRent, sel && s.roomChipRentSelected]}>
                              ₹{opt.rentAmount.toLocaleString("en-IN")}/mo
                            </Text>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}

              {/* ── Payment method ── */}
              <SectionLabel text="Payment method" />
              <View style={s.paymentGrid}>
                {PAYMENT_METHODS.map((method) => {
                  const sel = paymentMethod === method;
                  const icon =
                    method === "Bank transfer"
                      ? "business-outline"
                      : method === "UPI"
                        ? "phone-portrait-outline"
                        : "cash-outline";
                  return (
                    <TouchableOpacity
                      key={method}
                      style={[s.payCard, sel && s.payCardSelected]}
                      activeOpacity={0.75}
                      onPress={() => setPaymentMethod(method)}
                    >
                      <Ionicons
                        name={icon}
                        size={22}
                        color={sel ? colors.white : colors.navy}
                      />
                      <Text style={[s.payCardText, sel && s.payCardTextSelected]}>
                        {method}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* ── Agreement ── */}
              <SectionLabel text="Rental agreement" />
              <TouchableOpacity
                style={s.agreementRow}
                activeOpacity={0.7}
                onPress={() => setAgreementAccepted((v) => !v)}
              >
                <View style={[s.checkbox, agreementAccepted && s.checkboxChecked]}>
                  {agreementAccepted && (
                    <Ionicons name="checkmark" size={14} color={colors.white} />
                  )}
                </View>
                <Text style={s.agreementText}>
                  I agree to the rental agreement and terms provided by the property
                  owner.
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.nextBtn, (!step2Valid || submitting) && s.nextBtnDisabled]}
                activeOpacity={0.85}
                disabled={!step2Valid || submitting}
                onPress={() => void handleSubmit()}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <>
                    <Text style={s.nextBtnText}>Submit KYC & Payment</Text>
                    <Ionicons name="checkmark-circle-outline" size={17} color={colors.white} style={{ marginLeft: 8 }} />
                  </>
                )}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg, paddingHorizontal: 16 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
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
  hTitle: { fontSize: 17, fontWeight: "800", color: colors.navy },
  hSub: { fontSize: 12, color: colors.muted, fontWeight: "500", marginTop: 1 },

  scrollContent: { paddingBottom: 40 },

  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 20,
    marginBottom: 10,
  },

  fieldWrap: { marginBottom: 12 },
  fieldLabel: { fontSize: 13, fontWeight: "700", color: colors.navy, marginBottom: 6 },

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
  textArea: { minHeight: 80, textAlignVertical: "top" },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: "600", color: colors.navy },
  chipTextActive: { color: colors.white },

  contactCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 10,
  },
  contactCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  contactCardTitle: { fontSize: 13, fontWeight: "700", color: colors.navy },

  addContactBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    marginBottom: 4,
  },
  addContactText: { fontSize: 13, fontWeight: "600", color: colors.primary },

  // Room grid
  roomGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 4 },
  roomChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: "center",
    minWidth: 90,
  },
  roomChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  roomChipText: { fontSize: 13, fontWeight: "700", color: colors.navy },
  roomChipTextSelected: { color: colors.white },
  roomChipRent: { fontSize: 11, color: colors.muted, marginTop: 2 },
  roomChipRentSelected: { color: "rgba(255,255,255,0.8)" },

  // Payment grid
  paymentGrid: { flexDirection: "row", gap: 10, marginBottom: 4 },
  payCard: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  payCardSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  payCardText: { fontSize: 12, fontWeight: "700", color: colors.navy, textAlign: "center" },
  payCardTextSelected: { color: colors.white },

  // Agreement
  agreementRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  agreementText: { flex: 1, fontSize: 13, color: colors.navy, lineHeight: 19, fontWeight: "500" },

  // Next / submit button
  nextBtn: {
    marginTop: 24,
    borderRadius: radii.pill,
    paddingVertical: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  nextBtnDisabled: { backgroundColor: colors.primaryLight },
  nextBtnText: { fontSize: 15, fontWeight: "700", color: colors.white },

  // Gov ID camera
  cameraBox: {
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
    overflow: "hidden",
    height: 180,
  },
  cameraPreview: { width: "100%", height: "100%" },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  cameraOverlayText: { color: colors.white, fontSize: 13, fontWeight: "600" },
  cameraPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  cameraPlaceholderText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.muted,
    textAlign: "center",
    paddingHorizontal: 16,
  },
  retakeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  retakeBtnText: { fontSize: 12, fontWeight: "600", color: colors.primary },

  // Success
  successWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingBottom: 40,
  },
  successCircle: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  successTitle: { fontSize: 26, fontWeight: "800", color: colors.navy, marginBottom: 10 },
  successSub: {
    fontSize: 14,
    color: colors.muted,
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
