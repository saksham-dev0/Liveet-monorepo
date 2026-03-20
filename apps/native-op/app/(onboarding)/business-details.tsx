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
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { BottomSheet } from "../../components/BottomSheet";
import {
  colors,
  card as cardStyle,
  chip as chipStyle,
  chipActive as chipActiveStyle,
  chipRow as chipRowStyle,
  chipText as chipTextStyle,
  chipTextActive as chipTextActiveStyle,
  container as containerStyle,
  errorText as errorTextStyle,
  footerRow as footerRowStyle,
  input as inputStyle,
  label as labelStyle,
  loadingRow as loadingRowStyle,
  loadingText as loadingTextStyle,
  multilineInput as multilineInputStyle,
  primaryButton as primaryButtonStyle,
  primaryButtonDisabled as primaryButtonDisabledStyle,
  primaryButtonText as primaryButtonTextStyle,
  secondaryButton as secondaryButtonStyle,
  secondaryButtonText as secondaryButtonTextStyle,
  sectionHeader as sectionHeaderStyle,
  stepLabel as stepLabelStyle,
  subtitle as subtitleStyle,
  title as titleStyle,
} from "../../constants/theme";

const BUSINESS_TYPES = [
  "Sole proprietorship",
  "Partnership",
  "Private limited company",
  "LLP",
  "One person company",
  "Other",
] as const;

const REGISTRATION_DOC_TYPES = [
  "PAN",
  "GST certificate",
  "Trade licence",
  "Certificate of incorporation",
  "Partnership deed",
  "Other",
] as const;

export default function BusinessDetailsScreen() {
  const router = useRouter();
  const convex = useConvex();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isRegistered, setIsRegistered] = useState<boolean | null>(null);
  const [businessType, setBusinessType] = useState("");
  const [registeredName, setRegisteredName] = useState("");
  const [registeredAddress, setRegisteredAddress] = useState("");
  const [registrationDocType, setRegistrationDocType] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [registrationFileName, setRegistrationFileName] = useState<
    string | null
  >(null);

  const [businessTypeSheetOpen, setBusinessTypeSheetOpen] = useState(false);
  const [docTypeSheetOpen, setDocTypeSheetOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await (convex as any).query(
          "onboarding:getOnboardingStatus",
          {},
        );
        if (cancelled || !status?.businessProfile) return;
        const b = status.businessProfile;
        setIsRegistered(
          b.isRegistered === undefined ? null : Boolean(b.isRegistered),
        );
        setBusinessType(b.businessType ?? "");
        setRegisteredName(b.registeredName ?? "");
        setRegisteredAddress(b.registeredAddress ?? "");
        setRegistrationDocType(b.registrationDocType ?? "");
        setRegistrationNumber(b.registrationNumber ?? "");
        if (b.registrationFrontFileId) {
          setRegistrationFileName("Existing document");
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

  const handleUploadProof = async () => {
    try {
      setUploading(true);
      setError(null);

      const result = await (convex as any).mutation(
        "onboarding:generateRegistrationUploadUrl",
        {},
      );
      const uploadUrl: string | undefined = result?.uploadUrl;
      if (!uploadUrl) {
        throw new Error("Could not get upload URL. Please try again.");
      }

      const docResult = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (docResult.canceled || !docResult.assets?.length) {
        return;
      }

      const asset = docResult.assets[0];
      if (!asset.uri) {
        throw new Error("No file selected.");
      }

      const fileResponse = await fetch(asset.uri);
      const blob = await fileResponse.blob();
      const uploadRes = await fetch(uploadUrl, {
        method: "POST",
        body: blob,
        headers: {
          "Content-Type": asset.mimeType || "application/pdf",
        },
      });

      const body = await uploadRes.json();
      const storageId = body?.storageId;
      if (!storageId) {
        throw new Error("Upload failed. Please try again.");
      }

      await (convex as any).mutation("onboarding:setRegistrationProofFiles", {
        frontFileId: storageId,
        backFileId: undefined,
      });

      setRegistrationFileName(asset.name || "Registration document");
    } catch (err: any) {
      setError(
        err?.message ??
          "Failed to upload document. Please select a PDF and try again.",
      );
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (isRegistered === null) {
      setError("Please tell us if your business is registered.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await (convex as any).mutation("onboarding:upsertBusinessDetails", {
        isRegistered,
        businessType: businessType.trim() || undefined,
        registeredName: registeredName.trim() || undefined,
        registeredAddress: registeredAddress.trim() || undefined,
        registrationDocType: registrationDocType.trim() || undefined,
        registrationNumber: registrationNumber.trim() || undefined,
      });
      router.push("/(onboarding)/account");
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const showRegisteredFields = isRegistered === true;

  return (
    <ScrollView
      contentContainerStyle={containerStyle}
      keyboardShouldPersistTaps="handled"
    >
      <View style={cardStyle}>
        <Text style={stepLabelStyle}>Step 1 of 2 · Business details</Text>
        <Text style={titleStyle}>Business details</Text>
        <Text style={subtitleStyle}>
          These details will be reflected in the rent receipts sent to tenants.
        </Text>

        {loading && (
          <View style={loadingRowStyle}>
            <ActivityIndicator color={colors.primary} />
            <Text style={loadingTextStyle}>Loading your details...</Text>
          </View>
        )}

        {error ? <Text style={errorTextStyle}>{error}</Text> : null}

        <Text style={styles.question}>Is your business registered?</Text>
        <View style={[chipRowStyle, { marginBottom: 16 }]}>
          <TouchableOpacity
            style={[
              chipStyle,
              isRegistered === true && chipActiveStyle,
            ]}
            onPress={() => setIsRegistered(true)}
          >
            <Text
              style={[
                chipTextStyle,
                isRegistered === true && chipTextActiveStyle,
              ]}
            >
              Yes
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              chipStyle,
              isRegistered === false && chipActiveStyle,
            ]}
            onPress={() => setIsRegistered(false)}
          >
            <Text
              style={[
                chipTextStyle,
                isRegistered === false && chipTextActiveStyle,
              ]}
            >
              No
            </Text>
          </TouchableOpacity>
        </View>

        {showRegisteredFields && (
          <>
            <Text style={labelStyle}>Business type</Text>
            <TouchableOpacity
              style={styles.selector}
              onPress={() => setBusinessTypeSheetOpen(true)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.selectorText,
                  !businessType && styles.selectorPlaceholder,
                ]}
              >
                {businessType || "Select business type"}
              </Text>
              <Ionicons
                name="chevron-down"
                size={16}
                color={colors.muted}
              />
            </TouchableOpacity>

            <Text style={labelStyle}>Registered name</Text>
            <TextInput
              style={inputStyle}
              placeholder="Registered name"
              placeholderTextColor={colors.muted}
              value={registeredName}
              onChangeText={setRegisteredName}
            />

            <Text style={labelStyle}>Registered address</Text>
            <TextInput
              style={[inputStyle, multilineInputStyle]}
              placeholder="Registered address"
              placeholderTextColor={colors.muted}
              value={registeredAddress}
              onChangeText={setRegisteredAddress}
              multiline
            />

            <Text style={sectionHeaderStyle}>Add registration proof</Text>

            <Text style={labelStyle}>Select document type</Text>
            <TouchableOpacity
              style={styles.selector}
              onPress={() => setDocTypeSheetOpen(true)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.selectorText,
                  !registrationDocType && styles.selectorPlaceholder,
                ]}
              >
                {registrationDocType || "Select document type"}
              </Text>
              <Ionicons
                name="chevron-down"
                size={16}
                color={colors.muted}
              />
            </TouchableOpacity>

            <View style={styles.uploadRow}>
              <TouchableOpacity
                style={styles.uploadButton}
                onPress={handleUploadProof}
                activeOpacity={0.7}
                disabled={uploading}
              >
                <Text style={styles.uploadButtonText}>
                  {uploading ? "Uploading..." : "Upload PDF"}
                </Text>
              </TouchableOpacity>
              {registrationFileName ? (
                <Text
                  style={styles.uploadFileLabel}
                  numberOfLines={1}
                >
                  {registrationFileName}
                </Text>
              ) : null}
            </View>

            <Text style={labelStyle}>Enter registration number</Text>
            <TextInput
              style={inputStyle}
              placeholder="Registration number"
              placeholderTextColor={colors.muted}
              value={registrationNumber}
              onChangeText={setRegistrationNumber}
            />
          </>
        )}

        <View style={footerRowStyle}>
          <TouchableOpacity
            style={secondaryButtonStyle}
            onPress={handleSave}
          >
            <Text style={secondaryButtonTextStyle}>Save as draft</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              primaryButtonStyle,
              (isRegistered === null || saving) && primaryButtonDisabledStyle,
            ]}
            disabled={isRegistered === null || saving}
            onPress={handleSave}
          >
            <Text style={primaryButtonTextStyle}>
              {saving ? "Saving..." : "Next"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <BottomSheet
        visible={businessTypeSheetOpen}
        onClose={() => setBusinessTypeSheetOpen(false)}
        title="Business type"
        dismissOnBackdrop
      >
        <View style={styles.sheetContent}>
          {BUSINESS_TYPES.map((type) => (
            <TouchableOpacity
              key={type}
              style={styles.sheetOption}
              onPress={() => {
                setBusinessType(type);
                setBusinessTypeSheetOpen(false);
              }}
            >
              <Text style={styles.sheetOptionText}>{type}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </BottomSheet>

      <BottomSheet
        visible={docTypeSheetOpen}
        onClose={() => setDocTypeSheetOpen(false)}
        title="Document type"
        dismissOnBackdrop
      >
        <View style={styles.sheetContent}>
          {REGISTRATION_DOC_TYPES.map((type) => (
            <TouchableOpacity
              key={type}
              style={styles.sheetOption}
              onPress={() => {
                setRegistrationDocType(type);
                setDocTypeSheetOpen(false);
              }}
            >
              <Text style={styles.sheetOptionText}>{type}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </BottomSheet>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  question: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 10,
    color: colors.navy,
  },
  selector: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.inputBg,
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectorText: {
    fontSize: 15,
    color: colors.navy,
  },
  selectorPlaceholder: {
    color: colors.muted,
  },
  uploadRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    gap: 8,
  },
  uploadButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  uploadButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.white,
  },
  uploadFileLabel: {
    flex: 1,
    fontSize: 12,
    color: colors.muted,
  },
  sheetContent: {
    paddingBottom: 8,
  },
  sheetOption: {
    paddingVertical: 10,
  },
  sheetOptionText: {
    fontSize: 15,
    color: colors.navy,
  },
});
