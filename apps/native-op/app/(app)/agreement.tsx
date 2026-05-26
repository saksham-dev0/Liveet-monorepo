import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useConvex } from "convex/react";
import * as DocumentPicker from "expo-document-picker";

const C = {
  navy: "#1E293B",
  muted: "#6B7280",
  border: "#E2E8F0",
  inputBg: "#F3F4F6",
  white: "#FFFFFF",
  error: "#DC2626",
  pageBg: "#EEF2F6",
  accent: "#D4F542",
  positive: "#16A34A",
  subtle: "#94A3B8",
};

const ROOM_TYPE_OPTIONS = [
  { id: "single", label: "Single" },
  { id: "double", label: "Double sharing" },
  { id: "triple", label: "Triple sharing" },
  { id: "dormitory", label: "Dormitory" },
  { id: "studio", label: "Studio / 1BHK" },
  { id: "2bhk", label: "2BHK" },
];

const NOTICE_PERIODS = ["15 days", "30 days", "45 days", "60 days", "90 days"];

const CHARGES = [
  { id: "electricity", label: "Electricity", emoji: "⚡" },
  { id: "water", label: "Water", emoji: "💧" },
  { id: "maintenance", label: "Maintenance", emoji: "🔧" },
  { id: "food", label: "Food charges", emoji: "🍽️" },
  { id: "cleaning", label: "Cleaning", emoji: "🧹" },
];

type RoomPricing = {
  id: string;
  roomType: string;
  rent: string;
  deposit: string;
};

type AgreementData = {
  propertyId: string;
  agreementDuration: string;
  noticePeriod: string | null;
  roomPricings: { roomType: string; rent: string; deposit: string }[];
  additionalCharges: { id: string; amount: string }[];
  agreementPdfId: string | null;
};

export default function AgreementScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const convex = useConvex();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [editing, setEditing] = useState(false);

  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [agreementDuration, setAgreementDuration] = useState("");
  const [noticePeriod, setNoticePeriod] = useState<string | null>(null);
  const [roomPricings, setRoomPricings] = useState<RoomPricing[]>([
    { id: "1", roomType: "", rent: "", deposit: "" },
  ]);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [chargeAmounts, setChargeAmounts] = useState<Record<string, string>>({});
  const [pdfId, setPdfId] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data: AgreementData | null = await (convex as any).query(
        "agreement:getAgreement",
        {}
      );
      if (!data) return;

      setPropertyId(data.propertyId);
      setAgreementDuration(data.agreementDuration);
      setNoticePeriod(data.noticePeriod);
      setRoomPricings(
        data.roomPricings.length
          ? data.roomPricings.map((r, i) => ({ ...r, id: String(i + 1) }))
          : [{ id: "1", roomType: "", rent: "", deposit: "" }]
      );
      const amounts: Record<string, string> = {};
      data.additionalCharges.forEach(({ id, amount }) => {
        amounts[id] = amount;
      });
      setChargeAmounts(amounts);
      setPdfId(data.agreementPdfId);

      if (data.agreementPdfId) {
        const url = await (convex as any).query("agreement:getPdfUrl", {
          storageId: data.agreementPdfId,
        });
        setPdfUrl(url);
      }
    } catch (_) {}
    setLoading(false);
  }, [convex]);

  useEffect(() => {
    load();
  }, [load]);

  const addRoomPricing = () => {
    setRoomPricings((prev) => [
      ...prev,
      { id: Date.now().toString(), roomType: "", rent: "", deposit: "" },
    ]);
  };

  const removeRoomPricing = (id: string) => {
    setRoomPricings((prev) => prev.filter((r) => r.id !== id));
  };

  const updateRoomPricing = (id: string, field: keyof RoomPricing, value: string) => {
    setRoomPricings((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const toggleCharge = (id: string) => {
    setChargeAmounts((prev) => {
      if (id in prev) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return { ...prev, [id]: "" };
    });
  };

  async function pickPdf() {
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;

    setUploadingPdf(true);
    try {
      const uploadUrl = await (convex as any).mutation(
        "agreement:generateUploadUrl",
        {}
      );
      const asset = result.assets[0];
      const blob = await fetch(asset.uri).then((r) => r.blob());
      const uploadRes = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "application/pdf" },
        body: blob,
      });
      const { storageId } = await uploadRes.json();
      setPdfId(storageId);
      const url = await (convex as any).query("agreement:getPdfUrl", {
        storageId,
      });
      setPdfUrl(url);
    } catch (e) {
      Alert.alert("Upload failed", "Could not upload PDF. Try again.");
    } finally {
      setUploadingPdf(false);
    }
  }

  async function save() {
    if (!propertyId) return;
    setSaving(true);
    try {
      const charges = Object.entries(chargeAmounts).map(([id, amount]) => ({
        id,
        amount,
      }));
      const pricings = roomPricings
        .filter((r) => r.roomType && r.rent)
        .map(({ roomType, rent, deposit }) => ({ roomType, rent, deposit }));

      await (convex as any).mutation("agreement:updateAgreement", {
        propertyId,
        agreementDuration: agreementDuration || undefined,
        noticePeriod: noticePeriod ?? undefined,
        roomPricings: pricings.length ? pricings : undefined,
        additionalCharges: charges.length ? charges : undefined,
        agreementPdfId: pdfId ?? undefined,
      });
      setEditing(false);
    } catch (e) {
      Alert.alert("Error", "Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.root, { paddingTop: insets.top, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color={C.navy} />
      </View>
    );
  }

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
          <Text style={styles.headerTitle}>Agreement</Text>
          {!editing ? (
            <TouchableOpacity onPress={() => setEditing(true)} style={styles.editBtn}>
              <Ionicons name="pencil-outline" size={18} color={C.navy} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 36 }} />
          )}
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Agreement Duration */}
          <Text style={styles.sectionTitle}>Agreement duration</Text>
          {editing ? (
            <TextInput
              style={styles.input}
              placeholder="e.g. 11 months, 1 year"
              placeholderTextColor={C.muted}
              value={agreementDuration}
              onChangeText={setAgreementDuration}
            />
          ) : (
            <View style={styles.displayBox}>
              <Text style={styles.displayText}>
                {agreementDuration || "Not set"}
              </Text>
            </View>
          )}

          {/* Notice Period */}
          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Notice period</Text>
          {editing ? (
            <View style={styles.pills}>
              {NOTICE_PERIODS.map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.pill, noticePeriod === p && styles.pillActive]}
                  onPress={() => setNoticePeriod(p)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pillText, noticePeriod === p && styles.pillTextActive]}>
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.displayBox}>
              <Text style={styles.displayText}>{noticePeriod ?? "Not set"}</Text>
            </View>
          )}

          {/* Room Pricings */}
          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
            Rent & deposit by room type
          </Text>
          {editing ? (
            <>
              {roomPricings.map((item, index) => (
                <View key={item.id} style={styles.roomCard}>
                  <View style={styles.roomCardHeader}>
                    <Text style={styles.roomCardTitle}>Room type {index + 1}</Text>
                    {roomPricings.length > 1 && (
                      <TouchableOpacity onPress={() => removeRoomPricing(item.id)}>
                        <Text style={styles.removeBtn}>✕</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <TouchableOpacity
                    style={[styles.input, styles.dropdownTrigger]}
                    onPress={() =>
                      setOpenDropdownId(openDropdownId === item.id ? null : item.id)
                    }
                    activeOpacity={0.7}
                  >
                    <Text
                      style={item.roomType ? styles.dropdownValue : styles.dropdownPlaceholder}
                    >
                      {item.roomType || "Select room type"}
                    </Text>
                    <Text style={styles.dropdownArrow}>
                      {openDropdownId === item.id ? "▲" : "▼"}
                    </Text>
                  </TouchableOpacity>
                  {openDropdownId === item.id && (
                    <View style={styles.dropdownList}>
                      {ROOM_TYPE_OPTIONS.map((opt) => (
                        <TouchableOpacity
                          key={opt.id}
                          style={[
                            styles.dropdownOption,
                            item.roomType === opt.label && styles.dropdownOptionActive,
                          ]}
                          onPress={() => {
                            updateRoomPricing(item.id, "roomType", opt.label);
                            setOpenDropdownId(null);
                          }}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.dropdownOptionText,
                              item.roomType === opt.label && styles.dropdownOptionTextActive,
                            ]}
                          >
                            {opt.label}
                          </Text>
                          {item.roomType === opt.label && (
                            <Text style={styles.dropdownCheck}>✓</Text>
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  <View style={styles.rowInputs}>
                    <TextInput
                      style={[styles.input, styles.halfInput]}
                      placeholder="Monthly rent (₹)"
                      placeholderTextColor={C.muted}
                      keyboardType="number-pad"
                      value={item.rent}
                      onChangeText={(v) => updateRoomPricing(item.id, "rent", v)}
                    />
                    <TextInput
                      style={[styles.input, styles.halfInput]}
                      placeholder="Security deposit (₹)"
                      placeholderTextColor={C.muted}
                      keyboardType="number-pad"
                      value={item.deposit}
                      onChangeText={(v) => updateRoomPricing(item.id, "deposit", v)}
                    />
                  </View>
                </View>
              ))}
              <TouchableOpacity
                style={styles.addBtn}
                onPress={addRoomPricing}
                activeOpacity={0.7}
              >
                <Text style={styles.addBtnText}>+ Add room type</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {roomPricings.filter((r) => r.roomType).length === 0 ? (
                <View style={styles.displayBox}>
                  <Text style={styles.displayText}>Not set</Text>
                </View>
              ) : (
                roomPricings
                  .filter((r) => r.roomType)
                  .map((r, i) => (
                    <View key={i} style={styles.pricingRow}>
                      <Text style={styles.pricingType}>{r.roomType}</Text>
                      <Text style={styles.pricingDetail}>
                        ₹{r.rent}/mo · ₹{r.deposit} deposit
                      </Text>
                    </View>
                  ))
              )}
            </>
          )}

          {/* Additional Charges */}
          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Additional charges</Text>
          {editing ? (
            <>
              <View style={styles.chips}>
                {CHARGES.map((c) => {
                  const active = c.id in chargeAmounts;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => toggleCharge(c.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.chipEmoji}>{c.emoji}</Text>
                      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                        {c.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {CHARGES.filter((c) => c.id in chargeAmounts).map((c) => (
                <View key={c.id} style={styles.chargeAmountRow}>
                  <Text style={styles.chargeAmountLabel}>
                    {c.emoji} {c.label}
                  </Text>
                  <TextInput
                    style={[styles.input, styles.chargeAmountInput]}
                    placeholder="Amount (₹)"
                    placeholderTextColor={C.muted}
                    keyboardType="number-pad"
                    value={chargeAmounts[c.id]}
                    onChangeText={(v) =>
                      setChargeAmounts((prev) => ({ ...prev, [c.id]: v }))
                    }
                  />
                </View>
              ))}
            </>
          ) : (
            <View style={styles.displayBox}>
              {Object.keys(chargeAmounts).length === 0 ? (
                <Text style={styles.displayText}>None</Text>
              ) : (
                CHARGES.filter((c) => c.id in chargeAmounts).map((c) => (
                  <Text key={c.id} style={styles.displayText}>
                    {c.emoji} {c.label}
                    {chargeAmounts[c.id] ? ` — ₹${chargeAmounts[c.id]}` : ""}
                  </Text>
                ))
              )}
            </View>
          )}

          {/* Agreement PDF */}
          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Agreement PDF</Text>
          {pdfUrl ? (
            <View style={styles.pdfCard}>
              <Ionicons name="document-text" size={24} color={C.navy} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.pdfName}>Agreement document</Text>
                <TouchableOpacity onPress={() => Linking.openURL(pdfUrl)}>
                  <Text style={styles.pdfView}>View PDF</Text>
                </TouchableOpacity>
              </View>
              {editing && (
                <TouchableOpacity onPress={pickPdf} disabled={uploadingPdf}>
                  {uploadingPdf ? (
                    <ActivityIndicator size="small" color={C.navy} />
                  ) : (
                    <Ionicons name="refresh-outline" size={20} color={C.navy} />
                  )}
                </TouchableOpacity>
              )}
            </View>
          ) : (
            editing ? (
              <TouchableOpacity
                style={styles.pdfUploadBtn}
                onPress={pickPdf}
                disabled={uploadingPdf}
                activeOpacity={0.7}
              >
                {uploadingPdf ? (
                  <ActivityIndicator color={C.navy} />
                ) : (
                  <>
                    <Ionicons name="cloud-upload-outline" size={20} color={C.navy} />
                    <Text style={styles.pdfUploadText}>Upload agreement PDF</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <View style={styles.displayBox}>
                <Text style={styles.displayText}>No PDF uploaded</Text>
              </View>
            )
          )}

          {/* Save button */}
          {editing && (
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={save}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator color={C.white} />
              ) : (
                <Text style={styles.saveBtnText}>Save changes</Text>
              )}
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.pageBg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: C.white,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: C.navy,
  },
  editBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    padding: 20,
    paddingBottom: 48,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: C.navy,
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 16,
    backgroundColor: C.white,
    color: C.navy,
    marginBottom: 10,
  },
  displayBox: {
    backgroundColor: C.white,
    borderRadius: 12,
    padding: 16,
    gap: 6,
  },
  displayText: {
    fontSize: 15,
    color: C.navy,
  },
  pills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 100,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.white,
  },
  pillActive: {
    borderColor: C.navy,
    backgroundColor: C.navy,
  },
  pillText: {
    fontSize: 14,
    fontWeight: "500",
    color: C.navy,
  },
  pillTextActive: {
    color: C.white,
  },
  roomCard: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    padding: 14,
    backgroundColor: C.white,
    marginBottom: 12,
  },
  roomCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  roomCardTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: C.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  removeBtn: {
    fontSize: 14,
    color: C.muted,
    fontWeight: "600",
    paddingHorizontal: 4,
  },
  dropdownTrigger: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dropdownPlaceholder: {
    fontSize: 16,
    color: C.muted,
  },
  dropdownValue: {
    fontSize: 16,
    color: C.navy,
    fontWeight: "500",
  },
  dropdownArrow: {
    fontSize: 11,
    color: C.muted,
  },
  dropdownList: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    backgroundColor: C.white,
    marginBottom: 10,
    overflow: "hidden",
  },
  dropdownOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  dropdownOptionActive: {
    backgroundColor: "#F3F4F6",
  },
  dropdownOptionText: {
    fontSize: 15,
    color: C.navy,
  },
  dropdownOptionTextActive: {
    fontWeight: "600",
  },
  dropdownCheck: {
    fontSize: 14,
    color: C.navy,
    fontWeight: "700",
  },
  rowInputs: {
    flexDirection: "row",
    gap: 10,
  },
  halfInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 13,
  },
  addBtn: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderStyle: "dashed",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 4,
  },
  addBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: C.navy,
  },
  pricingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: C.white,
    borderRadius: 10,
    marginBottom: 8,
  },
  pricingType: {
    fontSize: 15,
    fontWeight: "600",
    color: C.navy,
  },
  pricingDetail: {
    fontSize: 13,
    color: C.muted,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 100,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.white,
  },
  chipActive: {
    borderColor: C.navy,
    backgroundColor: C.navy,
  },
  chipEmoji: {
    fontSize: 14,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: C.navy,
  },
  chipLabelActive: {
    color: C.white,
  },
  chargeAmountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  chargeAmountLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: C.navy,
    width: 130,
  },
  chargeAmountInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 0,
  },
  pdfCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1.5,
    borderColor: C.border,
  },
  pdfName: {
    fontSize: 15,
    fontWeight: "600",
    color: C.navy,
  },
  pdfView: {
    fontSize: 13,
    color: "#2563EB",
    marginTop: 2,
  },
  pdfUploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 1.5,
    borderColor: C.border,
    borderStyle: "dashed",
    borderRadius: 12,
    paddingVertical: 18,
    backgroundColor: C.white,
  },
  pdfUploadText: {
    fontSize: 15,
    fontWeight: "600",
    color: C.navy,
  },
  saveBtn: {
    borderRadius: 100,
    paddingVertical: 17,
    alignItems: "center",
    backgroundColor: C.navy,
    marginTop: 32,
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: C.white,
  },
});
