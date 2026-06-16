import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useMutation, useQuery } from "convex/react";
import { anyApi } from "convex/server";
import { colors, radii, cardShadow } from "../../../constants/theme";

const generateUploadUrlRef = anyApi.kyc.generateUploadUrl;
const submitIdProofRef = anyApi.kyc.submitIdProof;
const submitProfilePhotoRef = anyApi.kyc.submitProfilePhoto;
const submitAgreementSignRef = anyApi.kyc.submitAgreementSign;
const getKycStatusRef = anyApi.kyc.getKycStatus;
const getPropertyDetailsRef = anyApi.kyc.getPropertyDetailsForTenant;

const ID_PROOF_TYPES = [
  { key: "aadhaar", label: "Aadhaar Card", placeholder: "Enter 12-digit Aadhaar number" },
  { key: "pan", label: "PAN Card", placeholder: "Enter 10-character PAN number" },
  { key: "passport", label: "Passport", placeholder: "Enter passport number" },
  { key: "driving_license", label: "Driving Licence", placeholder: "Enter driving licence number" },
  { key: "voter_id", label: "Voter ID", placeholder: "Enter Voter ID number" },
];

const STEP_META = [
  { label: "ID Proof", sub: "Government-issued ID" },
  { label: "Profile Photo", sub: "Selfie + legal name" },
  { label: "Agreement", sub: "Rental e-sign" },
];

type PickedImage = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

export default function KycScreen() {
  const { propertyId, tenantId } = useLocalSearchParams<{
    propertyId: string;
    tenantId: string;
  }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [currentStep, setCurrentStep] = useState(1);

  // Step 1 state
  const [selectedIdType, setSelectedIdType] = useState<string | null>(null);
  const [idNumber, setIdNumber] = useState("");
  const [frontImage, setFrontImage] = useState<PickedImage | null>(null);
  const [backImage, setBackImage] = useState<PickedImage | null>(null);

  // Step 2 state
  const [legalName, setLegalName] = useState("");
  const [selfieImage, setSelfieImage] = useState<PickedImage | null>(null);

  // Step 3 state
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [digitalSignature, setDigitalSignature] = useState("");

  const [submitting, setSubmitting] = useState(false);

  const generateUrl = useMutation(generateUploadUrlRef);
  const submitIdProof = useMutation(submitIdProofRef);
  const submitProfilePhoto = useMutation(submitProfilePhotoRef);
  const submitAgreementSign = useMutation(submitAgreementSignRef);

  const kycStatus = useQuery(
    getKycStatusRef,
    tenantId ? { tenantId: tenantId as any } : "skip"
  );

  const propertyDetails = useQuery(
    getPropertyDetailsRef,
    propertyId ? { propertyId: propertyId as any } : "skip"
  );

  const selectedType = ID_PROOF_TYPES.find((t) => t.key === selectedIdType);

  async function uploadImage(image: PickedImage): Promise<string> {
    const uploadUrl = await generateUrl({});
    const response = await fetch(image.uri);
    const blob = await response.blob();
    const res = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": image.mimeType ?? "image/jpeg" },
      body: blob,
    });
    if (!res.ok) throw new Error("Upload failed");
    const { storageId } = await res.json();
    return storageId;
  }

  async function pickIdImage(side: "front" | "back") {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const picked: PickedImage = { uri: asset.uri, fileName: asset.fileName, mimeType: asset.mimeType ?? "image/jpeg" };
      if (side === "front") setFrontImage(picked);
      else setBackImage(picked);
    }
  }

  async function pickSelfie(source: "camera" | "gallery") {
    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.85,
            cameraType: ImagePicker.CameraType.front,
            allowsEditing: true,
            aspect: [1, 1],
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.85,
            allowsEditing: true,
            aspect: [1, 1],
          });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setSelfieImage({ uri: asset.uri, fileName: asset.fileName, mimeType: asset.mimeType ?? "image/jpeg" });
    }
  }

  async function handleStep1Submit() {
    if (!selectedIdType) { Alert.alert("Select ID type", "Choose an ID proof type."); return; }
    if (!idNumber.trim()) { Alert.alert("Enter ID number", "Enter your ID number."); return; }
    if (!frontImage) { Alert.alert("Front image required", "Upload the front side of your ID."); return; }
    if (!backImage) { Alert.alert("Back image required", "Upload the back side of your ID."); return; }
    if (!tenantId) { Alert.alert("Error", "Tenant information missing."); return; }

    try {
      setSubmitting(true);
      const [frontId, backId] = await Promise.all([uploadImage(frontImage), uploadImage(backImage)]);
      await submitIdProof({
        tenantId: tenantId as any,
        idProofType: selectedIdType,
        idProofNumber: idNumber.trim(),
        idProofFrontStorageId: frontId,
        idProofBackStorageId: backId,
      });
      setCurrentStep(2);
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStep2Submit() {
    if (!legalName.trim()) { Alert.alert("Name required", "Enter your name as on the ID."); return; }
    if (!selfieImage) { Alert.alert("Photo required", "Take or upload a selfie."); return; }
    if (!tenantId) { Alert.alert("Error", "Tenant information missing."); return; }

    try {
      setSubmitting(true);
      const photoId = await uploadImage(selfieImage);
      await submitProfilePhoto({
        tenantId: tenantId as any,
        legalName: legalName.trim(),
        profilePhotoStorageId: photoId,
      });
      setCurrentStep(3);
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStep3Submit() {
    if (!agreedToTerms) {
      Alert.alert("Agreement required", "Please check the box to agree to the terms.");
      return;
    }
    if (!digitalSignature.trim()) {
      Alert.alert("Signature required", "Type your full name as a digital signature.");
      return;
    }
    if (!tenantId) {
      Alert.alert("Error", "Tenant information missing.");
      return;
    }

    try {
      setSubmitting(true);
      await submitAgreementSign({
        tenantId: tenantId as any,
        digitalSignatureName: digitalSignature.trim(),
      });
      Alert.alert(
        "KYC Submitted!",
        "All three steps are complete. Your information is under review.",
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  function handleBack() {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
    else router.back();
  }

  const progressWidth = `${(currentStep / 3) * 100}%` as const;
  const stepMeta = STEP_META[currentStep - 1];

  const idProofDone = !!kycStatus?.idProofStatus;
  const profileDone = !!kycStatus?.profilePhotoStatus;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.pageBg }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={handleBack} style={s.backBtn}>
          <Ionicons name="arrow-back" size={20} color={colors.navy} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>E-KYC Verification</Text>
          <Text style={s.headerSub}>
            Step {currentStep} of 3 · {stepMeta.label}
          </Text>
        </View>
        <View style={s.stepChip}>
          <Text style={s.stepChipTxt}>{currentStep}/3</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={s.progressTrack}>
        <View style={[s.progressFill, { width: progressWidth }]} />
      </View>

      {/* Step dots */}
      <View style={s.stepDots}>
        {STEP_META.map((m, i) => (
          <React.Fragment key={m.label}>
            <View style={s.dotWrap}>
              <View
                style={[
                  s.dot,
                  i + 1 < currentStep
                    ? s.dotDone
                    : i + 1 === currentStep
                    ? s.dotActive
                    : s.dotIdle,
                ]}
              >
                {i + 1 < currentStep ? (
                  <Ionicons name="checkmark" size={10} color="#D4F542" />
                ) : (
                  <Text style={[s.dotNum, i + 1 === currentStep && { color: "#D4F542" }]}>
                    {i + 1}
                  </Text>
                )}
              </View>
              <Text style={[s.dotLabel, i + 1 === currentStep && { color: colors.navy, fontWeight: "600" }]}>
                {m.label}
              </Text>
            </View>
            {i < 2 && <View style={[s.dotLine, i + 1 < currentStep && s.dotLineDone]} />}
          </React.Fragment>
        ))}
      </View>

      {currentStep === 1 ? (
        <Step1
          selectedIdType={selectedIdType}
          setSelectedIdType={setSelectedIdType}
          idNumber={idNumber}
          setIdNumber={setIdNumber}
          frontImage={frontImage}
          backImage={backImage}
          onPickFront={() => pickIdImage("front")}
          onPickBack={() => pickIdImage("back")}
          submitting={submitting}
          onSubmit={handleStep1Submit}
          alreadySubmitted={idProofDone}
          kycStatus={kycStatus}
          insets={insets}
        />
      ) : currentStep === 2 ? (
        <Step2
          legalName={legalName}
          setLegalName={setLegalName}
          selfieImage={selfieImage}
          onPickSelfie={pickSelfie}
          submitting={submitting}
          onSubmit={handleStep2Submit}
          alreadySubmitted={profileDone}
          kycStatus={kycStatus}
          insets={insets}
        />
      ) : (
        <Step3
          propertyDetails={propertyDetails}
          agreedToTerms={agreedToTerms}
          setAgreedToTerms={setAgreedToTerms}
          digitalSignature={digitalSignature}
          setDigitalSignature={setDigitalSignature}
          submitting={submitting}
          onSubmit={handleStep3Submit}
          kycStatus={kycStatus}
          insets={insets}
        />
      )}
    </KeyboardAvoidingView>
  );
}

// ─── Step 1: ID Proof ────────────────────────────────────────────────────────

function Step1({
  selectedIdType, setSelectedIdType,
  idNumber, setIdNumber,
  frontImage, backImage,
  onPickFront, onPickBack,
  submitting, onSubmit,
  alreadySubmitted, kycStatus, insets,
}: any) {
  const selectedType = ID_PROOF_TYPES.find((t) => t.key === selectedIdType);

  return (
    <ScrollView
      contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 32 }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <StatusBanner status={kycStatus?.idProofStatus} labels={["ID proof verified", "ID proof rejected — please resubmit", "ID proof under review"]} />

      <View style={s.infoBox}>
        <Ionicons name="information-circle-outline" size={16} color={colors.muted} />
        <Text style={s.infoTxt}>Upload a government-issued ID. Both front and back are required.</Text>
      </View>

      <Text style={s.label}>Choose ID type</Text>
      <View style={s.typeGrid}>
        {ID_PROOF_TYPES.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[s.typeChip, selectedIdType === t.key && s.typeChipActive]}
            onPress={() => setSelectedIdType(t.key)}
            activeOpacity={0.75}
          >
            <Text style={[s.typeChipTxt, selectedIdType === t.key && s.typeChipTxtActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {selectedIdType && (
        <>
          <Text style={s.label}>{selectedType?.label} Number</Text>
          <TextInput
            style={s.input}
            placeholder={selectedType?.placeholder}
            placeholderTextColor={colors.muted}
            value={idNumber}
            onChangeText={setIdNumber}
            autoCapitalize="characters"
            autoCorrect={false}
          />
        </>
      )}

      <Text style={[s.label, { marginTop: 24 }]}>Upload ID Images</Text>
      <View style={s.imageRow}>
        <ImageUploadCard label="Front side" image={frontImage} onPick={onPickFront} icon="id-card-outline" />
        <ImageUploadCard label="Back side" image={backImage} onPick={onPickBack} icon="id-card-outline" />
      </View>

      <SubmitButton submitting={submitting} onPress={onSubmit} label={alreadySubmitted ? "Resubmit & Continue" : "Save & Continue"} />
    </ScrollView>
  );
}

// ─── Step 2: Profile Photo ────────────────────────────────────────────────────

function Step2({
  legalName, setLegalName,
  selfieImage, onPickSelfie,
  submitting, onSubmit,
  alreadySubmitted, kycStatus, insets,
}: any) {
  return (
    <ScrollView
      contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 32 }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <StatusBanner status={kycStatus?.profilePhotoStatus} labels={["Profile photo verified", "Profile photo rejected — please resubmit", "Profile photo under review"]} />

      <View style={s.infoBox}>
        <Ionicons name="information-circle-outline" size={16} color={colors.muted} />
        <Text style={s.infoTxt}>Take a clear selfie with good lighting. Your face must be fully visible and match your ID.</Text>
      </View>

      {/* Selfie area */}
      <Text style={s.label}>Your photo</Text>
      <View style={s.selfieArea}>
        {selfieImage ? (
          <View style={s.selfiePreviewWrap}>
            <Image source={{ uri: selfieImage.uri }} style={s.selfiePreview} contentFit="cover" />
          </View>
        ) : (
          <View style={s.selfiePlaceholder}>
            <Ionicons name="person-outline" size={48} color={colors.muted} />
          </View>
        )}

        <View style={s.selfieActions}>
          <TouchableOpacity
            style={s.selfieBtn}
            onPress={() => onPickSelfie("camera")}
            activeOpacity={0.8}
          >
            <Ionicons name="camera" size={18} color={colors.white} />
            <Text style={s.selfieBtnTxt}>Take selfie</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.selfieBtn, s.selfieBtnAlt]}
            onPress={() => onPickSelfie("gallery")}
            activeOpacity={0.8}
          >
            <Ionicons name="images-outline" size={18} color={colors.navy} />
            <Text style={[s.selfieBtnTxt, { color: colors.navy }]}>Choose from gallery</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Legal name */}
      <Text style={[s.label, { marginTop: 24 }]}>Full name as on ID</Text>
      <View style={s.infoBox}>
        <Ionicons name="alert-circle-outline" size={16} color={colors.muted} />
        <Text style={s.infoTxt}>Enter your name exactly as it appears on your government-issued ID.</Text>
      </View>
      <TextInput
        style={s.input}
        placeholder="e.g. Rahul Kumar Sharma"
        placeholderTextColor={colors.muted}
        value={legalName}
        onChangeText={setLegalName}
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="done"
      />

      <SubmitButton submitting={submitting} onPress={onSubmit} label={alreadySubmitted ? "Resubmit Photo" : "Submit & Continue"} />
    </ScrollView>
  );
}

// ─── Step 3: Agreement ───────────────────────────────────────────────────────

function Step3({
  propertyDetails,
  agreedToTerms, setAgreedToTerms,
  digitalSignature, setDigitalSignature,
  submitting, onSubmit,
  kycStatus, insets,
}: any) {
  const alreadySigned = !!kycStatus?.agreementStatus;

  const detailRows = [
    { label: "Property", value: propertyDetails?.name },
    {
      label: "Address",
      value: [propertyDetails?.addressLine1, propertyDetails?.city, propertyDetails?.state, propertyDetails?.pincode]
        .filter(Boolean)
        .join(", ") || null,
    },
    { label: "Agreement duration", value: propertyDetails?.agreementDuration },
    { label: "Notice period", value: propertyDetails?.noticePeriod },
  ].filter((r) => r.value);

  return (
    <ScrollView
      contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 32 }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <StatusBanner
        status={kycStatus?.agreementStatus}
        labels={["Agreement signed & verified", "Agreement rejected — please re-sign", "Agreement under review"]}
      />

      {/* Property details card */}
      {propertyDetails && (
        <View style={s.detailCard}>
          <View style={s.detailCardHead}>
            <Ionicons name="business-outline" size={16} color={colors.navy} />
            <Text style={s.detailCardTitle}>Property Details</Text>
          </View>
          {detailRows.map((r) => (
            <View key={r.label} style={s.detailRow}>
              <Text style={s.detailLabel}>{r.label}</Text>
              <Text style={s.detailValue}>{r.value}</Text>
            </View>
          ))}

          {/* Room pricings */}
          {(propertyDetails.roomPricings?.length ?? 0) > 0 && (
            <>
              <View style={s.detailDivider} />
              <Text style={s.detailSectionHead}>Room Pricing</Text>
              {propertyDetails.roomPricings.map((rp: any, i: number) => (
                <View key={i} style={s.detailRow}>
                  <Text style={s.detailLabel}>{rp.roomType}</Text>
                  <Text style={s.detailValue}>
                    ₹{rp.rent}/mo · ₹{rp.deposit} deposit
                    {rp.bookingAmount ? ` · ₹${rp.bookingAmount} booking` : ""}
                  </Text>
                </View>
              ))}
            </>
          )}

          {/* Additional charges */}
          {(propertyDetails.additionalCharges?.length ?? 0) > 0 && (
            <>
              <View style={s.detailDivider} />
              <Text style={s.detailSectionHead}>Additional Charges</Text>
              {propertyDetails.additionalCharges.map((c: any) => (
                <View key={c.id} style={s.detailRow}>
                  <Text style={s.detailLabel}>{c.id}</Text>
                  <Text style={s.detailValue}>₹{c.amount}</Text>
                </View>
              ))}
            </>
          )}
        </View>
      )}

      {/* PDF viewer */}
      {propertyDetails?.agreementPdfUrl ? (
        <TouchableOpacity
          style={s.pdfBtn}
          onPress={() => Linking.openURL(propertyDetails.agreementPdfUrl)}
          activeOpacity={0.8}
        >
          <View style={s.pdfBtnLeft}>
            <View style={s.pdfIcon}>
              <Ionicons name="document-text-outline" size={22} color={colors.navy} />
            </View>
            <View>
              <Text style={s.pdfBtnTitle}>Rental Agreement PDF</Text>
              <Text style={s.pdfBtnSub}>Tap to open & read</Text>
            </View>
          </View>
          <Ionicons name="open-outline" size={18} color={colors.muted} />
        </TouchableOpacity>
      ) : (
        <View style={s.noPdfBox}>
          <Ionicons name="document-outline" size={18} color={colors.muted} />
          <Text style={s.noPdfTxt}>No agreement PDF uploaded by operator</Text>
        </View>
      )}

      {/* Checkbox */}
      <TouchableOpacity
        style={s.checkboxRow}
        onPress={() => setAgreedToTerms(!agreedToTerms)}
        activeOpacity={0.75}
      >
        <View style={[s.checkbox, agreedToTerms && s.checkboxChecked]}>
          {agreedToTerms && <Ionicons name="checkmark" size={13} color="#D4F542" />}
        </View>
        <Text style={s.checkboxTxt}>
          I hereby agree to the terms and conditions of the provided rental agreement
        </Text>
      </TouchableOpacity>

      {/* Digital signature */}
      <Text style={[s.label, { marginTop: 20 }]}>Digital Signature</Text>
      <View style={s.infoBox}>
        <Ionicons name="pencil-outline" size={16} color={colors.muted} />
        <Text style={s.infoTxt}>
          Type your full legal name below to sign. This acts as your digital signature.
        </Text>
      </View>
      <View style={s.signatureWrap}>
        <TextInput
          style={s.signatureInput}
          placeholder="Type your full name"
          placeholderTextColor={colors.muted}
          value={digitalSignature}
          onChangeText={setDigitalSignature}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="done"
        />
        {digitalSignature.trim().length > 0 && (
          <View style={s.signaturePreview}>
            <Text style={s.signaturePreviewLabel}>Signature preview</Text>
            <Text style={s.signaturePreviewName}>{digitalSignature.trim()}</Text>
            <View style={s.signatureLine} />
          </View>
        )}
      </View>

      <SubmitButton
        submitting={submitting}
        onPress={onSubmit}
        label={alreadySigned ? "Re-sign Agreement" : "Sign & Submit"}
      />
    </ScrollView>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function StatusBanner({ status, labels }: { status?: string; labels: [string, string, string] }) {
  if (!status) return null;
  const isVerified = status === "verified";
  const isRejected = status === "rejected";
  return (
    <View style={[s.banner, isVerified ? s.bannerSuccess : isRejected ? s.bannerError : s.bannerPending]}>
      <Ionicons
        name={isVerified ? "checkmark-circle" : isRejected ? "close-circle" : "time-outline"}
        size={16}
        color={isVerified ? "#16A34A" : isRejected ? colors.error : "#92400E"}
      />
      <Text style={[s.bannerTxt, { color: isVerified ? "#16A34A" : isRejected ? colors.error : "#92400E" }]}>
        {isVerified ? labels[0] : isRejected ? labels[1] : labels[2]}
      </Text>
    </View>
  );
}

function ImageUploadCard({ label, image, onPick, icon }: { label: string; image: PickedImage | null; onPick: () => void; icon: string }) {
  return (
    <TouchableOpacity style={s.imageCard} onPress={onPick} activeOpacity={0.75}>
      {image ? (
        <>
          <Image source={{ uri: image.uri }} style={s.imagePreview} contentFit="cover" />
          <View style={s.imageOverlay}>
            <Ionicons name="pencil" size={14} color="#fff" />
            <Text style={s.imageOverlayTxt}>Change</Text>
          </View>
          <Text style={s.imageCardLabelAbsolute}>{label}</Text>
        </>
      ) : (
        <>
          <View style={s.imageUploadIcon}>
            <Ionicons name={icon as any} size={24} color={colors.muted} />
          </View>
          <Text style={s.imageCardLabel}>{label}</Text>
          <Text style={s.imageCardSub}>Tap to upload</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

function SubmitButton({ submitting, onPress, label }: { submitting: boolean; onPress: () => void; label: string }) {
  return (
    <TouchableOpacity style={[s.submitBtn, submitting && s.submitBtnDisabled]} onPress={onPress} disabled={submitting} activeOpacity={0.85}>
      {submitting ? (
        <ActivityIndicator color="#D4F542" size="small" />
      ) : (
        <>
          <Text style={s.submitBtnTxt}>{label}</Text>
          <Ionicons name="arrow-forward" size={16} color="#D4F542" />
        </>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.pageBg,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    ...cardShadow,
  },
  headerTitle: { fontSize: 16, fontWeight: "700", color: colors.navy },
  headerSub: { fontSize: 12, color: colors.muted, marginTop: 1 },
  stepChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.navy,
  },
  stepChipTxt: { fontSize: 12, fontWeight: "700", color: "#D4F542" },
  progressTrack: {
    height: 3,
    backgroundColor: colors.border,
    marginHorizontal: 16,
    borderRadius: 2,
  },
  progressFill: { height: 3, backgroundColor: colors.navy, borderRadius: 2 },
  stepDots: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  dotWrap: { alignItems: "center", gap: 4 },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  dotActive: { backgroundColor: colors.navy },
  dotDone: { backgroundColor: colors.navy },
  dotIdle: { backgroundColor: colors.border },
  dotNum: { fontSize: 11, fontWeight: "700", color: colors.muted },
  dotLabel: { fontSize: 10, color: colors.muted },
  dotLine: { flex: 1, height: 1.5, backgroundColor: colors.border, marginBottom: 14 },
  dotLineDone: { backgroundColor: colors.navy },
  scroll: { paddingHorizontal: 16, paddingTop: 8 },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  bannerSuccess: { backgroundColor: "#F0FDF4" },
  bannerPending: { backgroundColor: "#FEF3C7" },
  bannerError: { backgroundColor: "#FEF2F2" },
  bannerTxt: { fontSize: 13, fontWeight: "500", flex: 1 },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: colors.surfaceGray,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  infoTxt: { fontSize: 13, color: colors.muted, flex: 1, lineHeight: 18 },
  label: { fontSize: 13, fontWeight: "600", color: colors.navy, marginTop: 16, marginBottom: 8 },
  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  typeChipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  typeChipTxt: { fontSize: 13, fontWeight: "500", color: colors.navy },
  typeChipTxtActive: { color: "#D4F542" },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.input,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: colors.navy,
  },
  imageRow: { flexDirection: "row", gap: 12, marginTop: 4 },
  imageCard: {
    flex: 1,
    height: 140,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: "dashed",
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  imageUploadIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceGray,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  imageCardLabel: { fontSize: 13, fontWeight: "600", color: colors.navy, marginBottom: 2 },
  imageCardSub: { fontSize: 11, color: colors.muted },
  imagePreview: { width: "100%", height: "100%", position: "absolute" },
  imageOverlay: {
    position: "absolute",
    bottom: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  imageOverlayTxt: { fontSize: 11, color: "#fff", fontWeight: "600" },
  imageCardLabelAbsolute: {
    position: "absolute",
    top: 8,
    left: 8,
    fontSize: 11,
    fontWeight: "600",
    color: "#fff",
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  // Step 2 — selfie
  selfieArea: { alignItems: "center", gap: 16 },
  selfiePlaceholder: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.surfaceGray,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  selfiePreviewWrap: {
    width: 140,
    height: 140,
    borderRadius: 70,
    overflow: "hidden",
    borderWidth: 3,
    borderColor: colors.navy,
  },
  selfiePreview: { width: "100%", height: "100%" },
  selfieActions: { width: "100%", gap: 10 },
  selfieBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.navy,
    borderRadius: radii.pill,
    paddingVertical: 13,
  },
  selfieBtnAlt: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  selfieBtnTxt: { fontSize: 14, fontWeight: "600", color: colors.white },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.navy,
    borderRadius: radii.pill,
    paddingVertical: 16,
    marginTop: 32,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnTxt: { fontSize: 15, fontWeight: "700", color: "#D4F542" },
  // Step 3
  detailCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailCardHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  detailCardTitle: { fontSize: 14, fontWeight: "700", color: colors.navy },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 6,
    gap: 12,
  },
  detailLabel: { fontSize: 13, color: colors.muted, flex: 1 },
  detailValue: { fontSize: 13, fontWeight: "500", color: colors.navy, flex: 2, textAlign: "right" },
  detailDivider: { height: 1, backgroundColor: colors.border, marginVertical: 8 },
  detailSectionHead: { fontSize: 12, fontWeight: "600", color: colors.muted, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.4 },
  pdfBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  pdfBtnLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  pdfIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  pdfBtnTitle: { fontSize: 14, fontWeight: "600", color: colors.navy },
  pdfBtnSub: { fontSize: 12, color: colors.muted, marginTop: 1 },
  noPdfBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surfaceGray,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  noPdfTxt: { fontSize: 13, color: colors.muted },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginTop: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    flexShrink: 0,
  },
  checkboxChecked: {
    backgroundColor: colors.navy,
    borderColor: colors.navy,
  },
  checkboxTxt: { fontSize: 14, color: colors.navy, flex: 1, lineHeight: 20 },
  signatureWrap: { gap: 12 },
  signatureInput: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.input,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: colors.navy,
  },
  signaturePreview: {
    backgroundColor: "#FAFBFF",
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  signaturePreviewLabel: { fontSize: 10, fontWeight: "600", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  signaturePreviewName: { fontSize: 22, fontStyle: "italic", color: colors.navy, fontWeight: "300" },
  signatureLine: { height: 1, backgroundColor: colors.navy, marginTop: 4 },
});
