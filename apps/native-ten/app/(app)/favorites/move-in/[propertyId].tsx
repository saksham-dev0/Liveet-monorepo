import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { useConvex } from "convex/react";
import { BottomSheet } from "../../../../components/BottomSheet";
import { Image } from "expo-image";
import * as Device from "expo-device";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { colors, radii, cardShadow } from "../../../../constants/theme";

const GOV_ID_TYPES = [
  "PAN",
  "Aadhar card",
  "Passport",
  "Driving License",
  "College ID",
  "Others",
] as const;

type GovIdType = (typeof GOV_ID_TYPES)[number];

type Step = 0 | 1;

type MaritalStatus = "married" | "single";

type EmergencyContactRow = {
  id: string;
  name: string;
  phone: string;
  relation: string;
};

function makeEmergencyContactId(): string {
  return `ec-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

const GOV_ID_ICONS: Record<GovIdType, keyof typeof Ionicons.glyphMap> = {
  PAN: "reader-outline",
  "Aadhar card": "id-card-outline",
  Passport: "book-outline",
  "Driving License": "car-outline",
  "College ID": "school-outline",
  Others: "ellipsis-horizontal-circle-outline",
};

function StepBar({ step }: { step: Step }) {
  const onStep2 = step === 1;
  return (
    <View style={s.stepShell}>
      <View style={s.stepBarInner}>
        <View style={s.stepCol}>
          <View
            style={[s.stepDisc, step === 0 && s.stepDiscCurrent, onStep2 && s.stepDiscDone]}
          >
            {onStep2 ? (
              <Ionicons name="checkmark" size={18} color={colors.white} />
            ) : (
              <Text style={[s.stepDiscNum, s.stepDiscNumOnPrimary]}>1</Text>
            )}
          </View>
          <Text style={[s.stepTitle, !onStep2 && s.stepTitleStrong]} numberOfLines={1}>
            E-KYC
          </Text>
        </View>

        <View style={s.stepBridge}>
          <View style={s.stepBridgeTrack}>
            <View style={[s.stepBridgeFill, onStep2 && s.stepBridgeFillFull]} />
          </View>
        </View>

        <View style={s.stepCol}>
          <View
            style={[s.stepDisc, !onStep2 && s.stepDiscUpcoming, onStep2 && s.stepDiscCurrent]}
          >
            <Text
              style={[
                s.stepDiscNum,
                onStep2 && s.stepDiscNumOnPrimary,
                !onStep2 && s.stepDiscNumMuted,
              ]}
            >
              2
            </Text>
          </View>
          <Text style={[s.stepTitle, onStep2 && s.stepTitleStrong]} numberOfLines={2}>
            Basic details
          </Text>
        </View>
      </View>
    </View>
  );
}

async function pickIdImage(): Promise<{ uri: string; mimeType: string } | null> {
  // Opening the real camera on the iOS Simulator often terminates the app — block before native code runs.
  if (!Device.isDevice) {
    Alert.alert(
      "Use a real device",
      "The simulator cannot run the camera reliably. Use a physical phone to capture your ID, or test this step on a device.",
    );
    return null;
  }

  try {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== "granted") {
      Alert.alert(
        "Camera access needed",
        "Allow camera access in Settings to capture your ID. This flow uses the camera only, not your photo library.",
      );
      return null;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.9,
    });

    if (result.canceled || !result.assets?.[0]?.uri) return null;
    const asset = result.assets[0];
    return {
      uri: asset.uri,
      mimeType: asset.mimeType ?? "image/jpeg",
    };
  } catch (err) {
    console.warn("pickIdImage", err);
    Alert.alert(
      "Could not open camera",
      "Something went wrong opening the camera. Rebuild the app after updating permissions in app.json, and check Settings → Privacy → Camera for this app.",
    );
    return null;
  }
}

async function uploadLocalImageToConvex(
  convex: any,
  uri: string,
  mimeType: string,
): Promise<string> {
  const gen = await convex.mutation("moveIn:generateMoveInIdUploadUrl", {});
  const uploadUrl = gen?.uploadUrl as string | undefined;
  if (!uploadUrl) {
    throw new Error("Could not get upload URL. Check your connection.");
  }
  const fileResponse = await fetch(uri);
  const blob = await fileResponse.blob();
  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    body: blob,
    headers: { "Content-Type": mimeType || "image/jpeg" },
  });
  const body = await uploadRes.json();
  const storageId = body?.storageId as string | undefined;
  if (!storageId) {
    throw new Error("Upload failed. Please try again.");
  }
  return storageId;
}

export default function MoveInFlowScreen() {
  const router = useRouter();
  const convex = useConvex();
  const insets = useSafeAreaInsets();
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();

  const [step, setStep] = useState<Step>(0);

  const [legalName, setLegalName] = useState("");
  const [govIdType, setGovIdType] = useState<GovIdType | null>(null);
  const [govIdOtherLabel, setGovIdOtherLabel] = useState("");
  const [govIdNumber, setGovIdNumber] = useState("");
  const [idFront, setIdFront] = useState<{ uri: string; mimeType: string } | null>(null);
  const [idBack, setIdBack] = useState<{ uri: string; mimeType: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [dob, setDob] = useState("");
  const [maritalStatus, setMaritalStatus] = useState<MaritalStatus | null>(null);
  const [address, setAddress] = useState("");
  const [moveInDate, setMoveInDate] = useState("");
  const [professionalDetails, setProfessionalDetails] = useState("");
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContactRow[]>(() => [
    { id: makeEmergencyContactId(), name: "", phone: "", relation: "" },
  ]);

  const [govTypeSheetVisible, setGovTypeSheetVisible] = useState(false);

  const updateEmergencyContact = useCallback(
    (id: string, field: "name" | "phone" | "relation", value: string) => {
      setEmergencyContacts((prev) =>
        prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
      );
    },
    [],
  );

  const addEmergencyContact = useCallback(() => {
    setEmergencyContacts((prev) => [
      ...prev,
      { id: makeEmergencyContactId(), name: "", phone: "", relation: "" },
    ]);
  }, []);

  const removeEmergencyContact = useCallback((id: string) => {
    setEmergencyContacts((prev) =>
      prev.length <= 1 ? prev : prev.filter((row) => row.id !== id),
    );
  }, []);

  const pickFront = useCallback(async () => {
    const picked = await pickIdImage();
    if (picked) setIdFront({ uri: picked.uri, mimeType: picked.mimeType });
  }, []);

  const pickBack = useCallback(async () => {
    const picked = await pickIdImage();
    if (picked) setIdBack({ uri: picked.uri, mimeType: picked.mimeType });
  }, []);

  const validateEkyc = (): boolean => {
    if (!legalName.trim()) {
      Alert.alert("Missing name", "Please enter your name as it appears on the ID.");
      return false;
    }
    if (!govIdType) {
      Alert.alert("Select ID type", "Choose the type of government ID.");
      return false;
    }
    if (govIdType === "Others" && !govIdOtherLabel.trim()) {
      Alert.alert("Specify ID", "Please describe the ID type for “Others”.");
      return false;
    }
    if (!govIdNumber.trim()) {
      Alert.alert("Missing ID number", "Enter your government ID number.");
      return false;
    }
    if (!idFront) {
      Alert.alert("Front photo", "Capture the front of your ID with the camera.");
      return false;
    }
    if (!idBack) {
      Alert.alert("Back photo", "Capture the back of your ID with the camera.");
      return false;
    }
    return true;
  };

  const validateBasic = (): boolean => {
    if (!phone.trim()) {
      Alert.alert("Mobile number", "Enter your mobile number.");
      return false;
    }
    const emailTrim = email.trim();
    if (!emailTrim) {
      Alert.alert("Email", "Enter your email address.");
      return false;
    }
    if (!emailTrim.includes("@") || emailTrim.length < 5) {
      Alert.alert("Email", "Enter a valid email address.");
      return false;
    }
    if (!dob.trim()) {
      Alert.alert("Date of birth", "Enter your date of birth.");
      return false;
    }
    if (!maritalStatus) {
      Alert.alert("Marital status", "Select Married or Single.");
      return false;
    }
    if (!address.trim()) {
      Alert.alert("Address", "Enter your address.");
      return false;
    }
    if (!moveInDate.trim()) {
      Alert.alert("Move-in date", "Enter your preferred or planned move-in date.");
      return false;
    }
    if (!professionalDetails.trim()) {
      Alert.alert("Professional details", "Describe your profession, employer, or role.");
      return false;
    }
    const trimmedContacts = emergencyContacts.map((c) => ({
      id: c.id,
      name: c.name.trim(),
      phone: c.phone.trim(),
      relation: c.relation.trim(),
    }));
    const complete = trimmedContacts.filter((c) => c.name && c.phone && c.relation);
    const partial = trimmedContacts.filter((c) => {
      const any = c.name || c.phone || c.relation;
      const all = c.name && c.phone && c.relation;
      return any && !all;
    });
    if (partial.length > 0) {
      Alert.alert(
        "Incomplete emergency contact",
        "Each contact needs a name, phone number, and relation. Finish or remove incomplete rows.",
      );
      return false;
    }
    if (complete.length === 0) {
      Alert.alert(
        "Emergency contacts",
        "Add at least one emergency contact with name, phone, and relation.",
      );
      return false;
    }
    return true;
  };

  const handleContinueFromEkyc = () => {
    if (validateEkyc()) setStep(1);
  };

  const handleSubmit = async () => {
    if (!validateEkyc() || !validateBasic()) return;
    if (!propertyId) {
      Alert.alert("Missing property", "Go back and open a listing again.");
      return;
    }
    if (!govIdType || !maritalStatus) return;
    if (!idFront || !idBack) {
      Alert.alert("ID photos", "Capture both sides of your ID before submitting.");
      return;
    }

    const emergencyPayload = emergencyContacts
      .map((c) => ({
        name: c.name.trim(),
        phone: c.phone.trim(),
        relation: c.relation.trim(),
      }))
      .filter((c) => c.name && c.phone && c.relation);

    setSubmitting(true);
    try {
      const frontFileId = await uploadLocalImageToConvex(convex, idFront.uri, idFront.mimeType);
      const backFileId = await uploadLocalImageToConvex(convex, idBack.uri, idBack.mimeType);

      await (convex as any).mutation("moveIn:submitMoveInApplication", {
        propertyId,
        legalNameAsOnId: legalName.trim(),
        govIdType,
        govIdOtherLabel: govIdType === "Others" ? govIdOtherLabel.trim() : undefined,
        govIdNumber: govIdNumber.trim(),
        idFrontFileId: frontFileId,
        idBackFileId: backFileId,
        phone: phone.trim(),
        email: email.trim(),
        dateOfBirth: dob.trim(),
        maritalStatus,
        address: address.trim(),
        moveInDate: moveInDate.trim(),
        professionalDetails: professionalDetails.trim(),
        emergencyContacts: emergencyPayload,
      });

      Alert.alert(
        "Submitted",
        "Your move-in details have been saved. The property team may contact you next.",
        [{ text: "OK", onPress: () => router.back() }],
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Please try again.";
      Alert.alert("Could not submit", message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity
          style={[s.headerBtn, s.headerBtnLayer]}
          onPress={() => (step === 0 ? router.back() : setStep(0))}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={step === 0 ? "Go back" : "Back to E-KYC"}
        >
          <Ionicons name="chevron-back" size={22} color={colors.navy} />
        </TouchableOpacity>
        <View style={s.headerTitleBlock}>
          <Text style={s.headerTitle}>Move-in</Text>
          <Text style={s.headerSubtitle}>Tenant verification</Text>
        </View>
      </View>

      <StepBar step={step} />

      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 0 ? (
            <View style={s.formCard}>
              <View style={s.sectionHeadRow}>
                <View style={s.sectionHeadText}>
                  <Text style={s.sectionTitle}>E-KYC</Text>
                  <Text style={s.sectionSubtitle}>
                    Match your government ID exactly. Encrypted and used only for verification.
                  </Text>
                </View>
                <View style={s.sectionPill}>
                  <Text style={s.sectionPillText}>1 / 2</Text>
                </View>
              </View>

              <Text style={[s.fieldLabel, s.fieldLabelFirst]}>Full name (as on ID)</Text>
              <TextInput
                style={s.inputWell}
                value={legalName}
                onChangeText={setLegalName}
                placeholder="e.g. Rahul Kumar"
                placeholderTextColor={colors.muted}
                autoCapitalize="words"
                autoCorrect={false}
              />

              <Text style={s.fieldLabel}>Government ID type</Text>
              <TouchableOpacity
                style={s.selectTrigger}
                onPress={() => setGovTypeSheetVisible(true)}
                activeOpacity={0.88}
                accessibilityRole="button"
                accessibilityLabel="Type of government proof"
                accessibilityHint="Opens a list to choose your ID type"
              >
                <Ionicons
                  name={govIdType ? GOV_ID_ICONS[govIdType] : "id-card-outline"}
                  size={20}
                  color={govIdType ? colors.primary : colors.muted}
                  style={s.selectLeadingIcon}
                />
                <Text
                  style={[s.selectTriggerText, !govIdType && s.selectTriggerPlaceholder]}
                  numberOfLines={1}
                >
                  {govIdType ?? "Choose document type"}
                </Text>
                <View style={s.selectChevron}>
                  <Ionicons name="chevron-down" size={18} color={colors.navy} />
                </View>
              </TouchableOpacity>

              <BottomSheet
                visible={govTypeSheetVisible}
                onClose={() => setGovTypeSheetVisible(false)}
                title="Government ID type"
                maxHeight="58%"
              >
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={s.govTypeSheetList}
                >
                  {GOV_ID_TYPES.map((t) => {
                    const selected = govIdType === t;
                    const icon = GOV_ID_ICONS[t];
                    return (
                      <Pressable
                        key={t}
                        onPress={() => {
                          setGovIdType(t);
                          setGovTypeSheetVisible(false);
                        }}
                        style={({ pressed }) => [
                          s.govTypeOption,
                          selected && s.govTypeOptionSelected,
                          pressed && s.govTypeOptionPressed,
                        ]}
                      >
                        <View style={s.govTypeOptionRow}>
                          <View style={s.govTypeIconSlot}>
                            <Ionicons
                              name={icon}
                              size={22}
                              color={selected ? colors.primary : colors.muted}
                            />
                          </View>
                          <Text
                            style={[s.govTypeOptionLabel, selected && s.govTypeOptionLabelSelected]}
                            numberOfLines={1}
                          >
                            {t}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </BottomSheet>

              {govIdType === "Others" ? (
                <>
                  <Text style={s.fieldLabel}>Describe ID type</Text>
                  <TextInput
                    style={s.inputWell}
                    value={govIdOtherLabel}
                    onChangeText={setGovIdOtherLabel}
                    placeholder="e.g. Voter ID"
                    placeholderTextColor={colors.muted}
                  />
                </>
              ) : null}

              <Text style={s.fieldLabel}>ID number</Text>
              <TextInput
                style={s.inputWell}
                value={govIdNumber}
                onChangeText={setGovIdNumber}
                placeholder="Number printed on the document"
                placeholderTextColor={colors.muted}
                autoCapitalize="characters"
                autoCorrect={false}
              />

              <Text style={s.fieldLabel}>Document photos</Text>
              <View style={s.uploadRow}>
                <TouchableOpacity
                  style={s.uploadCard}
                  onPress={pickFront}
                  activeOpacity={0.9}
                  accessibilityRole="button"
                  accessibilityLabel="Capture front of ID with camera"
                >
                  {idFront ? (
                    <>
                      <Image
                        source={{ uri: idFront.uri }}
                        style={s.uploadPreview}
                        contentFit="cover"
                      />
                      <View style={s.uploadChangeBadge}>
                        <Text style={s.uploadChangeBadgeText}>Change</Text>
                      </View>
                    </>
                  ) : (
                    <>
                      <View style={s.uploadIconRing}>
                        <Ionicons name="camera-outline" size={24} color={colors.primary} />
                      </View>
                      <Text style={s.uploadTitle}>Front</Text>
                      <Text style={s.uploadHint}>Open camera · well lit, all corners visible</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={s.uploadCard}
                  onPress={pickBack}
                  activeOpacity={0.9}
                  accessibilityRole="button"
                  accessibilityLabel="Capture back of ID with camera"
                >
                  {idBack ? (
                    <>
                      <Image
                        source={{ uri: idBack.uri }}
                        style={s.uploadPreview}
                        contentFit="cover"
                      />
                      <View style={s.uploadChangeBadge}>
                        <Text style={s.uploadChangeBadgeText}>Change</Text>
                      </View>
                    </>
                  ) : (
                    <>
                      <View style={s.uploadIconRing}>
                        <Ionicons name="camera-outline" size={24} color={colors.primary} />
                      </View>
                      <Text style={s.uploadTitle}>Back</Text>
                      <Text style={s.uploadHint}>Open camera · same ID, reverse side</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={s.formCard}>
              <View style={s.sectionHeadRow}>
                <View style={s.sectionHeadText}>
                  <Text style={s.sectionTitle}>Basic details</Text>
                  <Text style={s.sectionSubtitle}>
                    Contact details for the property team. Kept private and used only for this
                    application.
                  </Text>
                </View>
                <View style={s.sectionPill}>
                  <Text style={s.sectionPillText}>2 / 2</Text>
                </View>
              </View>

              <Text style={[s.fieldLabel, s.fieldLabelFirst]}>Mobile number</Text>
              <TextInput
                style={s.inputWell}
                value={phone}
                onChangeText={setPhone}
                placeholder="+91 98765 43210"
                placeholderTextColor={colors.muted}
                keyboardType="phone-pad"
              />

              <Text style={s.fieldLabel}>Email</Text>
              <TextInput
                style={s.inputWell}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={colors.muted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={s.fieldLabel}>Date of birth</Text>
              <TextInput
                style={s.inputWell}
                value={dob}
                onChangeText={setDob}
                placeholder="DD/MM/YYYY"
                placeholderTextColor={colors.muted}
              />

              <Text style={s.fieldLabel}>Marital status</Text>
              <View style={s.maritalRow}>
                {(
                  [
                    { key: "married" as const, label: "Married" },
                    { key: "single" as const, label: "Single" },
                  ] as const
                ).map(({ key, label }) => {
                  const active = maritalStatus === key;
                  return (
                    <Pressable
                      key={key}
                      onPress={() => setMaritalStatus(key)}
                      style={[s.maritalChip, active && s.maritalChipActive]}
                    >
                      <Text style={[s.maritalChipText, active && s.maritalChipTextActive]}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={s.fieldLabel}>Address</Text>
              <TextInput
                style={[s.inputWell, s.inputMultiline]}
                value={address}
                onChangeText={setAddress}
                placeholder="House, street, area, city, PIN"
                placeholderTextColor={colors.muted}
                multiline
                textAlignVertical="top"
              />

              <Text style={s.fieldLabel}>Move-in date</Text>
              <TextInput
                style={s.inputWell}
                value={moveInDate}
                onChangeText={setMoveInDate}
                placeholder="DD/MM/YYYY or month you plan to move"
                placeholderTextColor={colors.muted}
              />

              <Text style={s.subSectionTitle}>Professional details</Text>
              <Text style={s.subSectionHint}>
                Occupation, employer, years of experience, or other relevant work information.
              </Text>
              <TextInput
                style={[s.inputWell, s.textareaProfessional]}
                value={professionalDetails}
                onChangeText={setProfessionalDetails}
                placeholder="e.g. Software engineer at Acme Corp, 3 years in product engineering…"
                placeholderTextColor={colors.muted}
                multiline
                textAlignVertical="top"
              />

              <Text style={s.subSectionTitle}>Emergency contacts</Text>
              <Text style={s.subSectionHint}>
                People we can reach if we cannot contact you. Add one or more. Not used for
                marketing.
              </Text>

              {emergencyContacts.map((contact, index) => (
                <View key={contact.id} style={s.emergencyCard}>
                  <View style={s.emergencyCardHeader}>
                    <Text style={s.emergencyCardTitle}>Contact {index + 1}</Text>
                    {emergencyContacts.length > 1 ? (
                      <Pressable
                        onPress={() => removeEmergencyContact(contact.id)}
                        style={({ pressed }) => [s.emergencyRemoveBtn, pressed && { opacity: 0.7 }]}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove emergency contact ${index + 1}`}
                      >
                        <Ionicons name="trash-outline" size={22} color={colors.error} />
                      </Pressable>
                    ) : null}
                  </View>

                  <Text style={s.fieldLabel}>Name</Text>
                  <TextInput
                    style={s.inputWell}
                    value={contact.name}
                    onChangeText={(v) => updateEmergencyContact(contact.id, "name", v)}
                    placeholder="Full name"
                    placeholderTextColor={colors.muted}
                    autoCapitalize="words"
                  />

                  <Text style={s.fieldLabel}>Phone number</Text>
                  <TextInput
                    style={s.inputWell}
                    value={contact.phone}
                    onChangeText={(v) => updateEmergencyContact(contact.id, "phone", v)}
                    placeholder="+91 …"
                    placeholderTextColor={colors.muted}
                    keyboardType="phone-pad"
                  />

                  <Text style={s.fieldLabel}>Relation with contact</Text>
                  <TextInput
                    style={s.inputWell}
                    value={contact.relation}
                    onChangeText={(v) => updateEmergencyContact(contact.id, "relation", v)}
                    placeholder="e.g. Father, Mother, Spouse, Sibling"
                    placeholderTextColor={colors.muted}
                  />
                </View>
              ))}

              <TouchableOpacity
                style={s.addContactBtn}
                onPress={addEmergencyContact}
                activeOpacity={0.88}
                accessibilityRole="button"
                accessibilityLabel="Add another emergency contact"
              >
                <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
                <Text style={s.addContactBtnText}>Add another contact</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 18) }]}>
          {step === 0 ? (
            <TouchableOpacity
              style={s.primaryBtn}
              onPress={handleContinueFromEkyc}
              activeOpacity={0.92}
            >
              <Text style={s.primaryBtnText}>Continue to basic details</Text>
              <Ionicons name="arrow-forward" size={20} color={colors.white} style={s.primaryBtnIcon} />
            </TouchableOpacity>
          ) : (
            <View style={s.footerRow}>
              <TouchableOpacity
                style={[s.secondaryBtn, submitting && s.footerBtnDisabled]}
                onPress={() => setStep(0)}
                activeOpacity={0.92}
                disabled={submitting}
              >
                <Text style={s.secondaryBtnText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.primaryBtnFlex, submitting && s.footerBtnDisabled]}
                onPress={() => void handleSubmit()}
                activeOpacity={0.92}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={s.primaryBtnText}>Submit</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.pageBg,
    paddingHorizontal: 20,
  },
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    marginBottom: 14,
    position: "relative",
    minHeight: 44,
  },
  headerBtnLayer: {
    zIndex: 1,
  },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.06)",
    ...Platform.select({
      ios: {
        shadowColor: "#0f172a",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  headerTitleBlock: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    pointerEvents: "box-none",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.navy,
    letterSpacing: -0.4,
    textAlign: "center",
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.muted,
    marginTop: 2,
    textAlign: "center",
  },
  stepShell: {
    backgroundColor: colors.white,
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.05)",
    ...cardShadow,
  },
  stepBarInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stepCol: {
    alignItems: "center",
    width: 88,
  },
  stepDisc: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  stepDiscCurrent: {
    backgroundColor: colors.primary,
  },
  stepDiscDone: {
    backgroundColor: colors.primary,
  },
  stepDiscUpcoming: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.border,
  },
  stepDiscNum: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.navy,
  },
  stepDiscNumOnPrimary: {
    color: colors.white,
  },
  stepDiscNumMuted: {
    color: colors.muted,
    fontWeight: "700",
  },
  stepTitle: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.muted,
    textAlign: "center",
    lineHeight: 14,
  },
  stepTitleStrong: {
    color: colors.navy,
    fontWeight: "800",
  },
  stepBridge: {
    flex: 1,
    paddingHorizontal: 4,
    marginBottom: 26,
    maxWidth: 120,
  },
  stepBridgeTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.progressTrack,
    overflow: "hidden",
  },
  stepBridgeFill: {
    width: "0%",
    height: "100%",
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  stepBridgeFillFull: {
    width: "100%",
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 28 },
  formCard: {
    backgroundColor: colors.white,
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.06)",
    ...cardShadow,
  },
  sectionHeadRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 20,
    paddingBottom: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  sectionHeadText: {
    flex: 1,
    minWidth: 0,
  },
  sectionPill: {
    backgroundColor: colors.surfaceGray,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionPillText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.navy,
    letterSpacing: 0.5,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.navy,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: colors.muted,
    lineHeight: 21,
    fontWeight: "500",
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.navy,
    marginTop: 18,
    marginBottom: 10,
    letterSpacing: 0.2,
    textTransform: "uppercase",
  },
  fieldLabelFirst: {
    marginTop: 4,
  },
  subSectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.navy,
    marginTop: 22,
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  subSectionHint: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.muted,
    lineHeight: 19,
    marginBottom: 10,
  },
  inputWell: {
    backgroundColor: colors.surfaceGray,
    borderWidth: 1.5,
    borderColor: "rgba(148, 163, 184, 0.45)",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: "500",
    color: colors.navy,
    ...Platform.select({
      ios: {
        shadowColor: "#0f172a",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
      },
      default: {},
    }),
  },
  inputMultiline: {
    minHeight: 108,
    paddingTop: 14,
  },
  textareaProfessional: {
    minHeight: 140,
    paddingTop: 14,
  },
  emergencyCard: {
    marginBottom: 14,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceGray,
  },
  emergencyCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  emergencyCardTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.navy,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  emergencyRemoveBtn: {
    padding: 4,
  },
  addContactBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(148, 163, 184, 0.55)",
    backgroundColor: colors.white,
    marginTop: 2,
  },
  addContactBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.primary,
  },
  maritalRow: {
    flexDirection: "row",
    gap: 12,
  },
  maritalChip: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "rgba(148, 163, 184, 0.45)",
    backgroundColor: colors.surfaceGray,
    alignItems: "center",
  },
  maritalChipActive: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: "rgba(30, 41, 59, 0.06)",
  },
  maritalChipText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.navy,
  },
  maritalChipTextActive: {
    fontWeight: "700",
    color: colors.primary,
  },
  selectTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    backgroundColor: colors.surfaceGray,
    borderWidth: 1.5,
    borderColor: "rgba(148, 163, 184, 0.45)",
    borderRadius: 14,
    paddingLeft: 14,
    paddingRight: 8,
    paddingVertical: 6,
    minHeight: 52,
    ...Platform.select({
      ios: {
        shadowColor: "#0f172a",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
      },
      default: {},
    }),
  },
  selectLeadingIcon: {
    marginRight: 2,
  },
  selectTriggerText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: colors.navy,
    paddingVertical: 8,
    minWidth: 0,
  },
  selectTriggerPlaceholder: {
    fontWeight: "500",
    color: colors.muted,
  },
  selectChevron: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.06)",
  },
  govTypeSheetList: {
    width: "100%",
    paddingTop: 6,
    paddingBottom: 16,
    gap: 10,
  },
  /** Full-width tappable card; inner View is the guaranteed horizontal row (icon + label). */
  govTypeOption: {
    width: "100%",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    overflow: "hidden",
  },
  govTypeOptionSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: "rgba(30, 41, 59, 0.05)",
  },
  govTypeOptionPressed: {
    opacity: 0.92,
  },
  govTypeOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    minHeight: 54,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 14,
  },
  govTypeIconSlot: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  govTypeOptionLabel: {
    flex: 1,
    flexShrink: 1,
    fontSize: 16,
    fontWeight: "600",
    color: colors.navy,
    letterSpacing: -0.2,
    lineHeight: 22,
    includeFontPadding: false,
  },
  govTypeOptionLabelSelected: {
    color: colors.primary,
    fontWeight: "700",
  },
  uploadRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  uploadCard: {
    flex: 1,
    height: 174,
    position: "relative",
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "rgba(100, 116, 139, 0.35)",
    backgroundColor: colors.surfaceGray,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
  },
  uploadIconRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.06)",
    ...Platform.select({
      ios: {
        shadowColor: "#0f172a",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  uploadTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.navy,
    marginBottom: 4,
  },
  uploadHint: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.muted,
    textAlign: "center",
    lineHeight: 16,
    paddingHorizontal: 4,
  },
  uploadPreview: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14,
  },
  uploadChangeBadge: {
    position: "absolute",
    bottom: 10,
    alignSelf: "center",
    backgroundColor: "rgba(15, 23, 42, 0.88)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
  },
  uploadChangeBadgeText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "700",
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(15, 23, 42, 0.08)",
    paddingTop: 14,
    backgroundColor: colors.pageBg,
    ...Platform.select({
      ios: {
        shadowColor: "#0f172a",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
      },
      default: {},
    }),
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: 17,
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
      },
      android: { elevation: 6 },
      default: {},
    }),
  },
  primaryBtnIcon: {
    marginTop: 1,
  },
  primaryBtnFlex: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: 17,
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
      },
      android: { elevation: 5 },
      default: {},
    }),
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.white,
    letterSpacing: -0.2,
  },
  footerRow: {
    flexDirection: "row",
    gap: 12,
  },
  secondaryBtn: {
    flex: 1,
    borderRadius: radii.pill,
    paddingVertical: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(148, 163, 184, 0.55)",
    backgroundColor: colors.white,
  },
  secondaryBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.navy,
  },
  footerBtnDisabled: {
    opacity: 0.65,
  },
});
