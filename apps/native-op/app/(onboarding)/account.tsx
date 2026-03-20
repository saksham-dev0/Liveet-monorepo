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
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import {
  colors,
  card as cardStyle,
  container as containerStyle,
  input as inputStyle,
  label as labelStyle,
  stepLabel as stepLabelStyle,
  title as titleStyle,
  subtitle as subtitleStyle,
  errorText as errorTextStyle,
  loadingRow as loadingRowStyle,
  loadingText as loadingTextStyle,
  primaryButton,
  primaryButtonDisabled,
  primaryButtonText,
  secondaryButton,
  secondaryButtonText,
  footerRow,
  chip,
  chipActive,
  chipText,
  chipTextActive,
  multilineInput as multilineInputStyle,
} from "../../constants/theme";

type AccountType = "bank" | "upi";

export default function AccountScreen() {
  const router = useRouter();
  const convex = useConvex();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState<AccountType>("bank");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [confirmAccountNumber, setConfirmAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [address, setAddress] = useState("");
  const [upiId, setUpiId] = useState("");
  const [upiQrFileName, setUpiQrFileName] = useState<string | null>(null);
  const [uploadingQr, setUploadingQr] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await (convex as any).query(
          "onboarding:getOnboardingStatus",
          {},
        );
        if (cancelled || !status?.account) return;
        const a = status.account;
        setType((a.accountType as AccountType) ?? "bank");
        setAccountHolderName(a.accountHolderName ?? "");
        setAccountNumber(a.accountNumber ?? "");
        setConfirmAccountNumber(a.accountNumber ?? "");
        setIfscCode(a.ifscCode ?? "");
        setAddress(a.address ?? "");
        setUpiId(a.upiId ?? "");
        if (a.upiQrCodeFileId) {
          setUpiQrFileName("QR code added");
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

  const handleSave = async (isSkip: boolean) => {
    setSaving(true);
    setError(null);
    try {
      await (convex as any).mutation("onboarding:upsertAccount", {
        accountType: type,
        accountHolderName: accountHolderName.trim() || undefined,
        accountNumber: accountNumber.trim() || undefined,
        ifscCode: ifscCode.trim() || undefined,
        address: address.trim() || undefined,
        upiId: upiId.trim() || undefined,
        isSkipped: isSkip || undefined,
      });
      router.push("/(onboarding)");
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const isBank = type === "bank";

  const showNextDisabled =
    saving ||
    (isBank &&
      (!!accountNumber && confirmAccountNumber !== accountNumber.trim()));

  const uploadQrFile = async (
    uri: string,
    mimeType: string,
    fileName: string,
  ) => {
    const result = await (convex as any).mutation(
      "onboarding:generateAccountUploadUrl",
      {},
    );
    const uploadUrl: string | undefined = result?.uploadUrl;
    if (!uploadUrl) {
      throw new Error("Could not get upload URL. Please try again.");
    }
    const fileResponse = await fetch(uri);
    const blob = await fileResponse.blob();
    const uploadRes = await fetch(uploadUrl, {
      method: "POST",
      body: blob,
      headers: { "Content-Type": mimeType || "image/jpeg" },
    });
    const body = await uploadRes.json();
    const storageId = body?.storageId;
    if (!storageId) {
      throw new Error("Upload failed. Please try again.");
    }
    await (convex as any).mutation("onboarding:setUpiQrCodeFile", {
      fileId: storageId,
    });
    setUpiQrFileName(fileName);
  };

  const handleAddQrCode = async (source: "gallery" | "documents") => {
    setUploadingQr(true);
    setError(null);
    try {
      await (convex as any).mutation("onboarding:upsertAccount", {
        accountType: type,
        accountHolderName: accountHolderName.trim() || undefined,
        accountNumber: accountNumber.trim() || undefined,
        ifscCode: ifscCode.trim() || undefined,
        address: address.trim() || undefined,
        upiId: upiId.trim() || undefined,
        isSkipped: undefined,
      });

      if (source === "gallery") {
        const { status } =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          throw new Error("Permission to access photos is required.");
        }
        const pickResult = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: false,
          quality: 1,
        });
        if (pickResult.canceled || !pickResult.assets?.length) {
          return;
        }
        const asset = pickResult.assets[0];
        const uri = asset.uri;
        if (!uri) throw new Error("No image selected.");
        const fileName =
          asset.fileName ?? asset.uri?.split("/").pop() ?? "QR code image";
        await uploadQrFile(
          uri,
          asset.mimeType ?? "image/jpeg",
          fileName,
        );
      } else {
        const docResult = await DocumentPicker.getDocumentAsync({
          type: ["image/jpeg", "image/png", "image/jpg"],
          copyToCacheDirectory: true,
          multiple: false,
        });
        if (docResult.canceled || !docResult.assets?.length) return;
        const asset = docResult.assets[0];
        if (!asset.uri) throw new Error("No image selected.");
        await uploadQrFile(
          asset.uri,
          asset.mimeType || "image/jpeg",
          asset.name ?? asset.uri?.split("/").pop() ?? "QR code image",
        );
      }
    } catch (err: any) {
      setError(
        err?.message ??
          "Failed to add QR code. Please choose a JPEG, PNG or JPG image.",
      );
    } finally {
      setUploadingQr(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={containerStyle}
      keyboardShouldPersistTaps="handled"
    >
      <View style={cardStyle}>
        <View style={styles.headerRow}>
          <Text style={stepLabelStyle}>Step 2 of 2 · Add an account</Text>
          <TouchableOpacity onPress={() => handleSave(true)}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>

        <Text style={titleStyle}>Add an account</Text>
        <Text style={subtitleStyle}>
          Payments made by tenants via UPI, Debit Card, Credit Card etc. will
          reflect in this account.
        </Text>

        {loading && (
          <View style={loadingRowStyle}>
            <ActivityIndicator color={colors.primary} />
            <Text style={loadingTextStyle}>Loading your account...</Text>
          </View>
        )}

        {error ? <Text style={errorTextStyle}>{error}</Text> : null}

        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[chip, isBank && chipActive]}
            onPress={() => setType("bank")}
          >
            <Text style={[chipText, isBank && chipTextActive]}>Bank</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[chip, !isBank && chipActive]}
            onPress={() => setType("upi")}
          >
            <Text style={[chipText, !isBank && chipTextActive]}>UPI</Text>
          </TouchableOpacity>
        </View>

        {isBank ? (
          <>
            <Text style={labelStyle}>Account holder name</Text>
            <TextInput
              style={inputStyle}
              placeholder="Account holder name"
              placeholderTextColor={colors.muted}
              value={accountHolderName}
              onChangeText={setAccountHolderName}
            />

            <Text style={labelStyle}>Account number</Text>
            <TextInput
              style={inputStyle}
              placeholder="Account number"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              value={accountNumber}
              onChangeText={setAccountNumber}
            />

            <Text style={labelStyle}>Re-enter account number</Text>
            <TextInput
              style={inputStyle}
              placeholder="Re-enter account number"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              value={confirmAccountNumber}
              onChangeText={setConfirmAccountNumber}
            />

            <Text style={labelStyle}>IFSC code</Text>
            <TextInput
              style={inputStyle}
              placeholder="IFSC code"
              placeholderTextColor={colors.muted}
              autoCapitalize="characters"
              value={ifscCode}
              onChangeText={setIfscCode}
            />

            <Text style={labelStyle}>Address</Text>
            <TextInput
              style={[inputStyle, multilineInputStyle]}
              placeholder="Address"
              placeholderTextColor={colors.muted}
              value={address}
              onChangeText={setAddress}
              multiline
            />
          </>
        ) : (
          <>
            <Text style={labelStyle}>Account holder name</Text>
            <TextInput
              style={inputStyle}
              placeholder="Account holder name"
              placeholderTextColor={colors.muted}
              value={accountHolderName}
              onChangeText={setAccountHolderName}
            />

            <Text style={labelStyle}>UPI ID</Text>
            <TextInput
              style={inputStyle}
              placeholder="yourname@bank"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              value={upiId}
              onChangeText={setUpiId}
            />

            <Text style={labelStyle}>Add QR code for payment (optional)</Text>
            <View style={styles.qrSection}>
              <View style={styles.qrButtonRow}>
                <TouchableOpacity
                  style={[styles.qrButton, uploadingQr && styles.qrButtonDisabled]}
                  onPress={() => handleAddQrCode("gallery")}
                  disabled={uploadingQr}
                >
                  <Text style={styles.qrButtonText}>
                    {uploadingQr ? "Uploading..." : "From gallery"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.qrButton, uploadingQr && styles.qrButtonDisabled]}
                  onPress={() => handleAddQrCode("documents")}
                  disabled={uploadingQr}
                >
                  <Text style={styles.qrButtonText}>
                    {uploadingQr ? "Uploading..." : "From documents"}
                  </Text>
                </TouchableOpacity>
              </View>
              {upiQrFileName ? (
                <Text style={styles.qrFileName} numberOfLines={1}>
                  {upiQrFileName}
                </Text>
              ) : null}
            </View>
          </>
        )}

        <View style={footerRow}>
          <TouchableOpacity
            style={secondaryButton}
            onPress={() => handleSave(false)}
          >
            <Text style={secondaryButtonText}>Save as draft</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              primaryButton,
              showNextDisabled && primaryButtonDisabled,
            ]}
            disabled={showNextDisabled}
            onPress={() => handleSave(false)}
          >
            <Text style={primaryButtonText}>
              {saving ? "Saving..." : "Next"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  skipText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: "600",
  },
  toggleRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  qrSection: {
    marginTop: 4,
    gap: 8,
  },
  qrButtonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  qrButton: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  qrButtonDisabled: {
    opacity: 0.7,
  },
  qrButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.white,
    textAlign: "center",
  },
  qrFileName: {
    fontSize: 13,
    color: colors.muted,
  },
});
