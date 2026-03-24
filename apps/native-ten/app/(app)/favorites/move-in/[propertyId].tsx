import React, { useCallback, useEffect, useMemo, useState } from "react";
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

const STEP_LABELS = ["Basic details", "Room selection", "E-KYC", "Payment"] as const;
type Step = 0 | 1 | 2 | 3;
const TOTAL_STEPS = STEP_LABELS.length;

const PAYMENT_METHODS = ["Bank transfer", "UPI", "Cash"] as const;
type PaymentMethod = (typeof PAYMENT_METHODS)[number];
type PaymentStatus = "paid" | "pending";

function paymentActionLabel(method: PaymentMethod): string {
  return method === "Cash" ? "Pay on reception" : "Pay Now";
}

type MaritalStatus = "married" | "single";

type EmergencyContactRow = {
  id: string;
  name: string;
  phone: string;
  relation: string;
};

type AvailableRoomOption = {
  id: string;
  title: string;
  subtitle: string;
  rentAmount?: number;
};

type LikedPropertyRow = {
  _id: string;
  roomOptions?: Array<{
    _id?: string;
    category?: string;
    typeName?: string | null;
    numberOfRooms?: number | null;
    rentAmount?: number | null;
  }>;
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

function formatIndianRupees(amount: number): string {
  return Math.round(amount).toLocaleString("en-IN");
}

function roomCategoryLabel(category: string | undefined): string {
  if (!category) return "Room";
  const key = category.trim().toLowerCase();
  if (key === "single") return "Single";
  if (key === "double") return "Double";
  if (key === "triple") return "Triple";
  if (key === "3plus") return "3+ Bed";
  return category;
}

function roomTitleFromOption(option: {
  category?: string;
  typeName?: string | null;
  numberOfRooms?: number | null;
}): string {
  const typeName = option.typeName?.trim();
  if (typeName) return typeName;
  const category = roomCategoryLabel(option.category);
  const count = option.numberOfRooms;
  if (typeof count === "number" && count > 0) {
    return `${category} · ${count} room${count === 1 ? "" : "s"}`;
  }
  return category;
}

function StepBar({ step }: { step: Step }) {
  return (
    <View style={s.stepShell}>
      <View style={s.stepBarInner}>
        {STEP_LABELS.map((label, index) => {
          const isCurrent = step === index;
          const isDone = step > index;
          return (
            <React.Fragment key={label}>
              <View style={s.stepCol}>
                <View
                  style={[
                    s.stepDisc,
                    isCurrent && s.stepDiscCurrent,
                    isDone && s.stepDiscDone,
                    !isCurrent && !isDone && s.stepDiscUpcoming,
                  ]}
                >
                  {isDone ? (
                    <Ionicons name="checkmark" size={16} color={colors.white} />
                  ) : (
                    <Text
                      style={[
                        s.stepDiscNum,
                        isCurrent && s.stepDiscNumOnPrimary,
                        !isCurrent && !isDone && s.stepDiscNumMuted,
                      ]}
                    >
                      {index + 1}
                    </Text>
                  )}
                </View>
                <Text style={[s.stepTitle, isCurrent && s.stepTitleStrong]} numberOfLines={2}>
                  {label}
                </Text>
              </View>
              {index < TOTAL_STEPS - 1 ? (
                <View style={s.stepBridge}>
                  <View style={s.stepBridgeTrack}>
                    <View style={[s.stepBridgeFill, step > index && s.stepBridgeFillFull]} />
                  </View>
                </View>
              ) : null}
            </React.Fragment>
          );
        })}
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
  const [roomOptions, setRoomOptions] = useState<AvailableRoomOption[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [selectedRoomOptionId, setSelectedRoomOptionId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null);
  const [expandedPaymentMethod, setExpandedPaymentMethod] = useState<PaymentMethod | null>(null);
  const [agreementAccepted, setAgreementAccepted] = useState(false);

  const stepIndicatorText = useMemo(() => `${step + 1} / ${TOTAL_STEPS}`, [step]);

  useEffect(() => {
    let cancelled = false;
    const loadRoomOptions = async () => {
      if (!propertyId) {
        if (!cancelled) {
          setRoomOptions([]);
          setRoomsLoading(false);
        }
        return;
      }
      setRoomsLoading(true);
      try {
        const liked = (await (convex as any).query("properties:listLikedForTenants", {})) as
          | LikedPropertyRow[]
          | null
          | undefined;
        if (cancelled) return;
        const property = (liked ?? []).find((row) => row?._id === propertyId);
        const mappedWithRank: Array<AvailableRoomOption & { rank: number }> = [];
        (property?.roomOptions ?? []).forEach((option, index) => {
            const id = option?._id;
            if (!id) return;
            const title = roomTitleFromOption(option);
            const category = roomCategoryLabel(option.category);
            const subtitle =
              typeof option.rentAmount === "number" && option.rentAmount > 0
                ? `${category} · ₹${formatIndianRupees(option.rentAmount)}/month`
                : `${category} · Price on request`;
            mappedWithRank.push({
              id,
              title,
              subtitle,
              rentAmount:
                typeof option.rentAmount === "number" && option.rentAmount > 0
                  ? option.rentAmount
                  : undefined,
              rank: index,
            });
          });
        const mapped = mappedWithRank
          .sort((a, b) => {
            const rentA = a.rentAmount ?? Number.MAX_SAFE_INTEGER;
            const rentB = b.rentAmount ?? Number.MAX_SAFE_INTEGER;
            if (rentA !== rentB) return rentA - rentB;
            return a.rank - b.rank;
          })
          .map(({ rank: _rank, ...rest }) => rest);
        setRoomOptions(mapped);
      } catch (err) {
        console.warn("loadRoomOptions", err);
        if (!cancelled) setRoomOptions([]);
      } finally {
        if (!cancelled) setRoomsLoading(false);
      }
    };
    void loadRoomOptions();
    return () => {
      cancelled = true;
    };
  }, [convex, propertyId]);

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

  const validateRoomSelection = (): boolean => {
    if (!selectedRoomOptionId) {
      Alert.alert("Room selection", "Please select one room option to continue.");
      return false;
    }
    return true;
  };

  const validatePaymentMethod = (): boolean => {
    if (!paymentMethod || !paymentStatus) {
      Alert.alert("Payment method", "Please choose a preferred payment method.");
      return false;
    }
    return true;
  };

  const validateAgreementConsent = (): boolean => {
    if (!agreementAccepted) {
      Alert.alert(
        "Agreement required",
        "Please agree to the rental agreement before submitting your request.",
      );
      return false;
    }
    return true;
  };

  const handleContinue = () => {
    if (step === 0) {
      if (validateBasic()) setStep(1);
      return;
    }
    if (step === 1) {
      if (validateRoomSelection()) setStep(2);
      return;
    }
    if (step === 2) {
      if (validateEkyc()) setStep(3);
    }
  };

  const handleSubmit = async () => {
    if (
      !validateBasic() ||
      !validateRoomSelection() ||
      !validateEkyc() ||
      !validatePaymentMethod() ||
      !validateAgreementConsent()
    ) {
      return;
    }
    if (!propertyId) {
      Alert.alert("Missing property", "Go back and open a listing again.");
      return;
    }
    if (!govIdType || !maritalStatus || !selectedRoomOptionId || !paymentMethod || !paymentStatus) {
      return;
    }
    if (!agreementAccepted) {
      return;
    }
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
        selectedRoomOptionId,
        paymentMethod,
        paymentStatus,
        agreementAccepted: true,
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
          onPress={() => (step === 0 ? router.back() : setStep((prev) => (prev - 1) as Step))}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={step === 0 ? "Go back" : "Back to previous step"}
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
                  <Text style={s.sectionTitle}>Basic details</Text>
                  <Text style={s.sectionSubtitle}>
                    Contact details for the property team. Kept private and used only for this
                    application.
                  </Text>
                </View>
                <View style={s.sectionPill}>
                  <Text style={s.sectionPillText}>{stepIndicatorText}</Text>
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
          ) : step === 1 ? (
            <View style={s.formCard}>
              <View style={s.sectionHeadRow}>
                <View style={s.sectionHeadText}>
                  <Text style={s.sectionTitle}>Room selection</Text>
                  <Text style={s.sectionSubtitle}>
                    Choose your preferred room option from currently available choices.
                  </Text>
                </View>
                <View style={s.sectionPill}>
                  <Text style={s.sectionPillText}>{stepIndicatorText}</Text>
                </View>
              </View>
              {roomsLoading ? (
                <View style={s.centerState}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={s.centerStateText}>Loading available room options...</Text>
                </View>
              ) : roomOptions.length === 0 ? (
                <View style={s.centerState}>
                  <Ionicons name="bed-outline" size={24} color={colors.muted} />
                  <Text style={s.centerStateText}>
                    No room options are available right now for this listing.
                  </Text>
                </View>
              ) : (
                <View style={s.roomList}>
                  {roomOptions.map((room) => {
                    const selected = selectedRoomOptionId === room.id;
                    return (
                      <Pressable
                        key={room.id}
                        onPress={() => setSelectedRoomOptionId(room.id)}
                        style={({ pressed }) => [
                          s.roomOptionCard,
                          selected && s.roomOptionCardSelected,
                          pressed && s.roomOptionCardPressed,
                        ]}
                      >
                        <View style={s.roomOptionMain}>
                          <Text style={[s.roomOptionTitle, selected && s.roomOptionTitleSelected]}>
                            {room.title}
                          </Text>
                          <Text style={s.roomOptionSubtitle}>{room.subtitle}</Text>
                        </View>
                        <View style={[s.radioOuter, selected && s.radioOuterActive]}>
                          {selected ? <View style={s.radioInner} /> : null}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          ) : step === 2 ? (
            <View style={s.formCard}>
              <View style={s.sectionHeadRow}>
                <View style={s.sectionHeadText}>
                  <Text style={s.sectionTitle}>E-KYC</Text>
                  <Text style={s.sectionSubtitle}>
                    Match your government ID exactly. Encrypted and used only for verification.
                  </Text>
                </View>
                <View style={s.sectionPill}>
                  <Text style={s.sectionPillText}>{stepIndicatorText}</Text>
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
                  <Text style={s.sectionTitle}>Payment method</Text>
                  <Text style={s.sectionSubtitle}>
                    Share your preferred payment method for the move-in process.
                  </Text>
                </View>
                <View style={s.sectionPill}>
                  <Text style={s.sectionPillText}>{stepIndicatorText}</Text>
                </View>
              </View>
              <View style={s.paymentMethodsWrap}>
                {PAYMENT_METHODS.map((method) => {
                  const active = expandedPaymentMethod === method;
                  return (
                    <View
                      key={method}
                      style={[s.paymentAccordionItem, active && s.paymentAccordionItemActive]}
                    >
                      <Pressable
                        onPress={() =>
                          setExpandedPaymentMethod((prev) => (prev === method ? null : method))
                        }
                        style={s.paymentAccordionHeader}
                      >
                        <Text
                          style={[
                            s.paymentAccordionTitle,
                            active && s.paymentAccordionTitleActive,
                          ]}
                        >
                          {method}
                        </Text>
                        <Ionicons
                          name={active ? "chevron-up" : "chevron-down"}
                          size={18}
                          color={active ? colors.primary : colors.muted}
                        />
                      </Pressable>
                      {active ? (
                        <View style={s.paymentAccordionBody}>
                          <TouchableOpacity
                            style={s.paymentActionBtn}
                            activeOpacity={0.9}
                            onPress={() => {
                              setPaymentMethod(method);
                              setPaymentStatus(method === "Cash" ? "pending" : "paid");
                            }}
                          >
                            <Text style={s.paymentActionBtnText}>
                              {paymentActionLabel(method)}
                            </Text>
                          </TouchableOpacity>
                          {paymentMethod === method && paymentStatus ? (
                            <Text style={s.paymentSelectionMeta}>
                              {paymentStatus === "paid"
                                ? "Payment status: Paid"
                                : "Payment status: Pending"}
                            </Text>
                          ) : null}
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>

              <Pressable
                onPress={() => setAgreementAccepted((prev) => !prev)}
                style={({ pressed }) => [
                  s.agreementConsentRow,
                  pressed && s.agreementConsentRowPressed,
                ]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: agreementAccepted }}
                accessibilityLabel="I agree to the rental agreement"
              >
                <View style={[s.agreementCheckbox, agreementAccepted && s.agreementCheckboxChecked]}>
                  {agreementAccepted ? (
                    <Ionicons name="checkmark" size={14} color={colors.white} />
                  ) : null}
                </View>
                <Text style={s.agreementConsentText}>
                  I agree to the rental agreement and the move-in terms.
                </Text>
              </Pressable>
            </View>
          )}
        </ScrollView>

        <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 18) }]}>
          {step === 0 ? (
            <TouchableOpacity
              style={s.primaryBtn}
              onPress={handleContinue}
              activeOpacity={0.92}
            >
              <Text style={s.primaryBtnText}>Continue to room selection</Text>
              <Ionicons name="arrow-forward" size={20} color={colors.white} style={s.primaryBtnIcon} />
            </TouchableOpacity>
          ) : step < 3 ? (
            <View style={s.footerRow}>
              <TouchableOpacity
                style={[s.secondaryBtn, submitting && s.footerBtnDisabled]}
                onPress={() => setStep((prev) => (prev - 1) as Step)}
                activeOpacity={0.92}
                disabled={submitting}
              >
                <Text style={s.secondaryBtnText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.primaryBtnFlex, submitting && s.footerBtnDisabled]}
                onPress={handleContinue}
                activeOpacity={0.92}
                disabled={submitting}
              >
                <Text style={s.primaryBtnText}>
                  {step === 1 ? "Continue to E-KYC" : "Continue to payment"}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.footerRow}>
              <TouchableOpacity
                style={[s.secondaryBtn, submitting && s.footerBtnDisabled]}
                onPress={() => setStep(2)}
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
    width: 66,
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
    marginBottom: 28,
    maxWidth: 42,
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
  centerState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 30,
    gap: 10,
  },
  centerStateText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.muted,
    textAlign: "center",
  },
  roomList: {
    gap: 10,
  },
  roomOptionCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: colors.white,
  },
  roomOptionCardSelected: {
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: "rgba(30, 41, 59, 0.05)",
  },
  roomOptionCardPressed: {
    opacity: 0.9,
  },
  roomOptionMain: {
    flex: 1,
    minWidth: 0,
  },
  roomOptionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.navy,
    marginBottom: 4,
  },
  roomOptionTitleSelected: {
    color: colors.primary,
  },
  roomOptionSubtitle: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.muted,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    backgroundColor: colors.white,
  },
  radioOuterActive: {
    borderColor: colors.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  paymentMethodsWrap: {
    gap: 10,
    marginBottom: 20,
  },
  paymentAccordionItem: {
    borderWidth: 1.5,
    borderColor: "rgba(148, 163, 184, 0.45)",
    borderRadius: 14,
    backgroundColor: colors.surfaceGray,
    overflow: "hidden",
  },
  paymentAccordionItemActive: {
    borderColor: colors.primary,
    backgroundColor: "rgba(30, 41, 59, 0.06)",
  },
  paymentAccordionHeader: {
    minHeight: 54,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  paymentAccordionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.navy,
    flex: 1,
    minWidth: 0,
  },
  paymentAccordionTitleActive: {
    color: colors.primary,
  },
  paymentAccordionBody: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(148, 163, 184, 0.45)",
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 12,
  },
  paymentActionBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  paymentActionBtnText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "800",
  },
  paymentSelectionMeta: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: "700",
    color: colors.muted,
  },
  agreementConsentRow: {
    marginTop: 0,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 8,
  },
  agreementConsentRowPressed: {
    opacity: 0.85,
  },
  agreementCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    flexShrink: 0,
  },
  agreementCheckboxChecked: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  agreementConsentText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "600",
    color: colors.navy,
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
