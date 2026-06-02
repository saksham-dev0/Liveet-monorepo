import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useConvex } from "convex/react";
import * as ImagePicker from "expo-image-picker";

const C = {
  navy: "#1E293B",
  muted: "#6B7280",
  border: "#E2E8F0",
  inputBg: "#F3F4F6",
  white: "#FFFFFF",
  error: "#DC2626",
  pageBg: "#EEF2F6",
  surfaceGray: "#F1F5F9",
  accent: "#D4F542",
  accentText: "#1A1A1A",
  positive: "#16A34A",
  subtle: "#94A3B8",
};

type Details = {
  accountName: string;
  accountNumber: string;
  ifscCode: string;
  upiId: string;
  qrImageId: string;
};

export default function CollectScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const convex = useConvex();

  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [saved, setSaved] = useState<Details | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingQr, setUploadingQr] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);

  const [loadError, setLoadError] = useState<string | null>(null);

  const [form, setForm] = useState<Details>({
    accountName: "",
    accountNumber: "",
    ifscCode: "",
    upiId: "",
    qrImageId: "",
  });

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const prop = await (convex as any).query("users:getMyProperty", {});
      if (!prop?._id) return;
      setPropertyId(prop._id);

      const det = await (convex as any).query("paymentDetails:get", {
        propertyId: prop._id,
      });
      if (det) {
        setSaved(det);
        setForm({
          accountName: det.accountName ?? "",
          accountNumber: det.accountNumber ?? "",
          ifscCode: det.ifscCode ?? "",
          upiId: det.upiId ?? "",
          qrImageId: det.qrImageId ?? "",
        });
        if (det.qrImageId) {
          const url = await (convex as any).query("paymentDetails:getQrUrl", {
            storageId: det.qrImageId,
          });
          setQrUrl(url);
        }
      } else {
        setEditing(true);
      }
    } catch (err: any) {
      console.error("Failed to load payment details:", err);
      setLoadError(err?.message ?? "Failed to load payment details");
    }
  }, [convex]);

  useEffect(() => {
    load();
  }, [load]);

  async function pickQr() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (res.canceled || !res.assets[0]) return;

    setUploadingQr(true);
    try {
      const uploadUrl = await (convex as any).mutation(
        "paymentDetails:generateUploadUrl",
        {}
      );
      const asset = res.assets[0];
      const blob = await fetch(asset.uri).then((r) => r.blob());
      const uploadRes = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": blob.type || "image/jpeg" },
        body: blob,
      });
      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        throw new Error(`Upload failed (${uploadRes.status}): ${errText}`);
      }
      const body = await uploadRes.json();
      const { storageId } = body;
      if (!storageId) throw new Error("Upload response missing storageId");
      setForm((f) => ({ ...f, qrImageId: storageId }));

      const url = await (convex as any).query("paymentDetails:getQrUrl", {
        storageId,
      });
      setQrUrl(url);
    } catch (e) {
      Alert.alert("Upload failed", "Could not upload QR image. Try again.");
    } finally {
      setUploadingQr(false);
    }
  }

  async function save() {
    if (!propertyId) return;
    if (!form.accountName.trim() && !form.upiId.trim()) {
      Alert.alert("Required", "Enter at least account name or UPI ID.");
      return;
    }
    setSaving(true);
    try {
      await (convex as any).mutation("paymentDetails:upsert", {
        propertyId,
        accountName: form.accountName || undefined,
        accountNumber: form.accountNumber || undefined,
        ifscCode: form.ifscCode || undefined,
        upiId: form.upiId || undefined,
        qrImageId: form.qrImageId || undefined,
      });
      await load();
      setEditing(false);
    } catch (e) {
      Alert.alert("Error", "Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const showForm = editing || !saved;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.root, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={C.navy} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Collect Payments</Text>
          {saved && !showForm && (
            <TouchableOpacity onPress={() => setEditing(true)} style={styles.editBtn}>
              <Ionicons name="pencil-outline" size={18} color={C.navy} />
            </TouchableOpacity>
          )}
        </View>

        {loadError && (
          <Text style={{ color: C.error, paddingHorizontal: 20, paddingVertical: 8 }}>
            {loadError}
          </Text>
        )}
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {!showForm && saved ? (
            // ── View mode ──
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>Bank Account</Text>
              <Row label="Account Name" value={saved.accountName} />
              <Row label="Account Number" value={saved.accountNumber} />
              <Row label="IFSC Code" value={saved.ifscCode} />

              <View style={styles.divider} />
              <Text style={styles.sectionLabel}>UPI</Text>
              <Row label="UPI ID" value={saved.upiId} />

              {qrUrl && (
                <>
                  <View style={styles.divider} />
                  <Text style={styles.sectionLabel}>QR Code</Text>
                  <Image source={{ uri: qrUrl }} style={styles.qrPreview} resizeMode="contain" />
                </>
              )}
            </View>
          ) : (
            // ── Edit mode ──
            <>
              <View style={styles.card}>
                <Text style={styles.sectionLabel}>Bank Account</Text>

                <Field
                  label="Account Holder Name"
                  value={form.accountName}
                  onChange={(v) => setForm((f) => ({ ...f, accountName: v }))}
                  placeholder="e.g. Rajesh Kumar"
                />
                <Field
                  label="Account Number"
                  value={form.accountNumber}
                  onChange={(v) => setForm((f) => ({ ...f, accountNumber: v }))}
                  placeholder="e.g. 012345678901"
                  keyboardType="number-pad"
                />
                <Field
                  label="IFSC Code"
                  value={form.ifscCode}
                  onChange={(v) => setForm((f) => ({ ...f, ifscCode: v.toUpperCase() }))}
                  placeholder="e.g. SBIN0001234"
                  autoCapitalize="characters"
                />
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionLabel}>UPI</Text>
                <Field
                  label="UPI ID"
                  value={form.upiId}
                  onChange={(v) => setForm((f) => ({ ...f, upiId: v }))}
                  placeholder="e.g. name@upi"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionLabel}>QR Code</Text>
                <TouchableOpacity style={styles.qrPicker} onPress={pickQr} disabled={uploadingQr}>
                  {uploadingQr ? (
                    <ActivityIndicator color={C.navy} />
                  ) : qrUrl ? (
                    <Image source={{ uri: qrUrl }} style={styles.qrPreview} resizeMode="contain" />
                  ) : (
                    <>
                      <Ionicons name="qr-code-outline" size={32} color={C.muted} />
                      <Text style={styles.qrPickerText}>Tap to upload QR image</Text>
                    </>
                  )}
                </TouchableOpacity>
                {qrUrl && (
                  <TouchableOpacity onPress={pickQr} style={styles.changeQrBtn}>
                    <Text style={styles.changeQrText}>Change QR</Text>
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={save}
                disabled={saving}
                activeOpacity={0.8}
              >
                {saving ? (
                  <ActivityIndicator color={C.accentText} />
                ) : (
                  <Text style={styles.saveBtnText}>Save Payment Details</Text>
                )}
              </TouchableOpacity>

              {saved && (
                <TouchableOpacity onPress={() => setEditing(false)} style={styles.cancelBtn}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: any;
  autoCapitalize?: any;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={C.subtle}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize ?? "words"}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.pageBg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: C.pageBg,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: C.white, borderWidth: 1, borderColor: C.border,
    alignItems: "center", justifyContent: "center", marginRight: 12,
  },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: "700", color: C.navy, letterSpacing: -0.4 },
  editBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: C.white, borderWidth: 1, borderColor: C.border,
    alignItems: "center", justifyContent: "center",
  },
  content: { paddingHorizontal: 20, paddingTop: 4, gap: 14 },

  card: {
    backgroundColor: C.white, borderRadius: 18, padding: 16, gap: 12,
  },
  sectionLabel: { fontSize: 11, fontWeight: "700", color: C.muted, letterSpacing: 0.8, textTransform: "uppercase" },
  divider: { height: 1, backgroundColor: C.border },

  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowLabel: { fontSize: 13, color: C.muted, fontWeight: "500" },
  rowValue: { fontSize: 13.5, fontWeight: "700", color: C.navy, letterSpacing: -0.2, maxWidth: "60%", textAlign: "right" },

  fieldWrap: { gap: 6 },
  fieldLabel: { fontSize: 12, fontWeight: "600", color: C.navy },
  input: {
    backgroundColor: C.inputBg, borderRadius: 12, paddingHorizontal: 14,
    paddingVertical: 12, fontSize: 14, color: C.navy,
    borderWidth: 1, borderColor: C.border,
  },

  qrPicker: {
    borderWidth: 1.5, borderColor: C.border, borderStyle: "dashed",
    borderRadius: 14, paddingVertical: 28,
    alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: C.surfaceGray,
  },
  qrPickerText: { fontSize: 13, color: C.muted, fontWeight: "500" },
  qrPreview: { width: "100%", height: 200, borderRadius: 10 },
  changeQrBtn: { alignItems: "center" },
  changeQrText: { fontSize: 12.5, fontWeight: "600", color: C.navy },

  saveBtn: {
    backgroundColor: C.accent, borderRadius: 14,
    paddingVertical: 15, alignItems: "center",
  },
  saveBtnText: { fontSize: 15, fontWeight: "700", color: C.accentText },
  cancelBtn: { alignItems: "center", paddingVertical: 10 },
  cancelBtnText: { fontSize: 13.5, color: C.muted, fontWeight: "600" },
});
