import { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useConvex } from "convex/react";
import { useRouter } from "expo-router";
import { StepHeader } from "../../../components/StepHeader";
import { colors, radii } from "../../../constants/theme";
import { useOnboarding } from "../../../context/OnboardingContext";

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

export default function AgreementScreen() {
  const router = useRouter();
  const { data } = useOnboarding();
  const convex = useConvex();
  const [submitting, setSubmitting] = useState(false);

  const [agreementDuration, setAgreementDuration] = useState("");
  const [roomPricings, setRoomPricings] = useState<RoomPricing[]>([
    { id: "1", roomType: "", rent: "", deposit: "" },
  ]);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [noticePeriod, setNoticePeriod] = useState<string | null>(null);
  const [chargeAmounts, setChargeAmounts] = useState<Record<string, string>>({});

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

  const setChargeAmount = (id: string, value: string) => {
    setChargeAmounts((prev) => ({ ...prev, [id]: value }));
  };

  const isValid =
    agreementDuration.trim().length > 0 &&
    roomPricings.some((r) => r.roomType.trim().length > 0 && r.rent.trim().length > 0);

  return (
    <ScrollView
      contentContainerStyle={s.container}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <StepHeader
        step={5}
        showSkip={false}
        onBack={() => router.back()}
      />

      <Text style={s.heading}>Agreement & rent</Text>
      <Text style={s.sub}>Last step — set up your rent and agreement terms.</Text>

      <Text style={s.label}>Agreement duration</Text>
      <TextInput
        style={s.input}
        placeholder="e.g. 11 months, 1 year"
        placeholderTextColor={colors.muted}
        value={agreementDuration}
        onChangeText={setAgreementDuration}
      />

      <Text style={[s.label, { marginTop: 28 }]}>Rent & deposit by room type</Text>
      <Text style={s.hint}>Add pricing for each room type you offer</Text>

      {roomPricings.map((item, index) => (
        <View key={item.id} style={s.roomCard}>
          <View style={s.roomCardHeader}>
            <Text style={s.roomCardTitle}>Room type {index + 1}</Text>
            {roomPricings.length > 1 && (
              <TouchableOpacity onPress={() => removeRoomPricing(item.id)} activeOpacity={0.7}>
                <Text style={s.removeBtn}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={[s.input, s.dropdownTrigger, { marginBottom: openDropdownId === item.id ? 0 : 10 }]}
            onPress={() => setOpenDropdownId(openDropdownId === item.id ? null : item.id)}
            activeOpacity={0.7}
          >
            <Text style={item.roomType ? s.dropdownValue : s.dropdownPlaceholder}>
              {item.roomType || "Select room type"}
            </Text>
            <Text style={s.dropdownArrow}>{openDropdownId === item.id ? "▲" : "▼"}</Text>
          </TouchableOpacity>
          {openDropdownId === item.id && (
            <View style={s.dropdownList}>
              {ROOM_TYPE_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.id}
                  style={[s.dropdownOption, item.roomType === opt.label && s.dropdownOptionActive]}
                  onPress={() => {
                    updateRoomPricing(item.id, "roomType", opt.label);
                    setOpenDropdownId(null);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[s.dropdownOptionText, item.roomType === opt.label && s.dropdownOptionTextActive]}>
                    {opt.label}
                  </Text>
                  {item.roomType === opt.label && <Text style={s.dropdownCheck}>✓</Text>}
                </TouchableOpacity>
              ))}
            </View>
          )}
          <View style={s.rowInputs}>
            <TextInput
              style={[s.input, s.halfInput]}
              placeholder="Monthly rent (₹)"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              value={item.rent}
              onChangeText={(v) => updateRoomPricing(item.id, "rent", v)}
            />
            <TextInput
              style={[s.input, s.halfInput]}
              placeholder="Security deposit (₹)"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              value={item.deposit}
              onChangeText={(v) => updateRoomPricing(item.id, "deposit", v)}
            />
          </View>
        </View>
      ))}

      <TouchableOpacity style={s.addBtn} onPress={addRoomPricing} activeOpacity={0.7}>
        <Text style={s.addBtnText}>+ Add room type</Text>
      </TouchableOpacity>

      <Text style={[s.label, { marginTop: 28 }]}>Notice period</Text>
      <View style={s.noticePills}>
        {NOTICE_PERIODS.map((p) => (
          <TouchableOpacity
            key={p}
            style={[s.noticePill, noticePeriod === p && s.noticePillActive]}
            onPress={() => setNoticePeriod(p)}
            activeOpacity={0.7}
          >
            <Text style={[s.noticePillText, noticePeriod === p && s.noticePillTextActive]}>
              {p}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[s.label, { marginTop: 28 }]}>Additional charges</Text>
      <Text style={s.hint}>{"What's included in or added to the rent?"}</Text>
      <View style={s.chargeChips}>
        {CHARGES.map((c) => {
          const active = c.id in chargeAmounts;
          return (
            <TouchableOpacity
              key={c.id}
              style={[s.chargeChip, active && s.chargeChipActive]}
              onPress={() => toggleCharge(c.id)}
              activeOpacity={0.7}
            >
              <Text style={s.chargeEmoji}>{c.emoji}</Text>
              <Text style={[s.chargeLabel, active && s.chargeLabelActive]}>
                {c.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {CHARGES.filter((c) => c.id in chargeAmounts).map((c) => (
        <View key={c.id} style={s.chargeAmountRow}>
          <Text style={s.chargeAmountLabel}>
            {c.emoji} {c.label}
          </Text>
          <TextInput
            style={[s.input, s.chargeAmountInput]}
            placeholder="Amount (₹)"
            placeholderTextColor={colors.muted}
            keyboardType="number-pad"
            value={chargeAmounts[c.id]}
            onChangeText={(v) => setChargeAmount(c.id, v)}
          />
        </View>
      ))}

      <TouchableOpacity
        style={[s.btn, (!isValid || submitting) && s.btnDisabled]}
        onPress={async () => {
          if (!isValid || submitting) return;
          setSubmitting(true);
          try {
            const charges = Object.entries(chargeAmounts).map(([id, amount]) => ({ id, amount }));
            const pricings = roomPricings
              .filter((r) => r.roomType && r.rent)
              .map(({ roomType, rent, deposit }) => ({ roomType, rent, deposit }));
            await (convex as any).mutation("users:completeOnboarding", {
              name: data.fullName,
              property: {
                propertyType: data.propertyType,
                name: data.propertyName,
                addressLine1: data.addressLine1 || undefined,
                city: data.city || undefined,
                state: data.state || undefined,
                pincode: data.pincode || undefined,
                totalUnits: data.totalUnits || undefined,
                roomTypes: data.roomTypes.length ? data.roomTypes : undefined,
                amenities: data.amenities.length ? data.amenities : undefined,
                tenantGender: data.tenantGender ?? undefined,
                tenantFood: data.tenantFood ?? undefined,
                tenantOccupation: data.tenantOccupation ?? undefined,
                agreementDuration: agreementDuration || undefined,
                noticePeriod: noticePeriod ?? undefined,
                roomPricings: pricings.length ? pricings : undefined,
                additionalCharges: charges.length ? charges : undefined,
              },
            });
            router.push("/(onboarding)/success" as any);
          } catch (e) {
            console.error(e);
          } finally {
            setSubmitting(false);
          }
        }}
        disabled={!isValid || submitting}
        activeOpacity={0.8}
      >
        {submitting ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={s.btnText}>Finish setup</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
    backgroundColor: colors.white,
  },
  heading: {
    fontSize: 32,
    fontWeight: "800",
    color: colors.navy,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  sub: {
    fontSize: 15,
    color: colors.muted,
    marginBottom: 32,
    lineHeight: 22,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.navy,
    marginBottom: 10,
    marginTop: 8,
  },
  hint: {
    fontSize: 12,
    color: colors.muted,
    marginBottom: 12,
    marginTop: -6,
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.input,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 16,
    backgroundColor: colors.inputBg,
    color: colors.navy,
  },
  dropdownTrigger: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dropdownPlaceholder: {
    fontSize: 16,
    color: colors.muted,
  },
  dropdownValue: {
    fontSize: 16,
    color: colors.navy,
    fontWeight: "500",
  },
  dropdownArrow: {
    fontSize: 11,
    color: colors.muted,
  },
  dropdownList: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.input,
    backgroundColor: colors.white,
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
    borderBottomColor: colors.border,
  },
  dropdownOptionActive: {
    backgroundColor: colors.inputBg,
  },
  dropdownOptionText: {
    fontSize: 15,
    color: colors.navy,
  },
  dropdownOptionTextActive: {
    fontWeight: "600",
  },
  dropdownCheck: {
    fontSize: 14,
    color: colors.navy,
    fontWeight: "700",
  },
  roomCard: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.card,
    padding: 14,
    backgroundColor: colors.inputBg,
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
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  removeBtn: {
    fontSize: 14,
    color: colors.muted,
    fontWeight: "600",
    paddingHorizontal: 4,
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
    borderColor: colors.border,
    borderStyle: "dashed",
    borderRadius: radii.card,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 4,
  },
  addBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.navy,
  },
  noticePills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  noticePill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
  },
  noticePillActive: {
    borderColor: colors.navy,
    backgroundColor: colors.navy,
  },
  noticePillText: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.navy,
  },
  noticePillTextActive: {
    color: colors.white,
  },
  chargeChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chargeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
  },
  chargeChipActive: {
    borderColor: colors.navy,
    backgroundColor: colors.navy,
  },
  chargeEmoji: {
    fontSize: 14,
  },
  chargeLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.navy,
  },
  chargeLabelActive: {
    color: colors.white,
  },
  chargeAmountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 10,
  },
  chargeAmountLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.navy,
    width: 130,
  },
  chargeAmountInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
  },
  btn: {
    borderRadius: radii.pill,
    paddingVertical: 17,
    alignItems: "center",
    backgroundColor: colors.navy,
    marginTop: 40,
  },
  btnDisabled: {
    backgroundColor: colors.primaryLight,
  },
  btnText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.white,
  },
});
