import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../packages/backend/convex/_generated/api";
import { colors, radii } from "@/constants/theme";

const getMyTenantDetailsRef = api.tenants.getMyTenantDetails;
const submitRoomChangeRef = api.tenants.submitRoomChange;

export default function RoomChangeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const details = useQuery(getMyTenantDetailsRef);
  const submitRoomChange = useMutation(submitRoomChangeRef);

  const [anyRoom, setAnyRoom] = useState(false);
  const [roomNumber, setRoomNumber] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit = (anyRoom || roomNumber.trim().length > 0) && reason.trim().length > 0;

  async function handleSubmit() {
    if (!canSubmit || loading) return;
    setLoading(true);
    try {
      await submitRoomChange({
        preferredRoomNumber: anyRoom ? undefined : roomNumber.trim(),
        reason: reason.trim(),
      });
      Alert.alert("Request sent", "Your room change request has been submitted.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to submit request.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={s.root}>
      <View style={[s.header, { paddingTop: insets.top + 14 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={colors.navy} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Room Change</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Current room card */}
        {details ? (
          <View style={s.detailCard}>
            <View style={s.detailCardHeader}>
              <View style={s.detailIconWrap}>
                <Ionicons name="bed-outline" size={20} color={colors.navy} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.detailCardTitle}>Current Room</Text>
                <Text style={s.detailCardSub}>{details.propertyName}</Text>
              </View>
            </View>
            <View style={s.divider} />
            {details.room ? (
              <>
                <View style={s.detailRow}>
                  <Text style={s.detailLabel}>Room</Text>
                  <Text style={s.detailValue}>
                    {details.room.roomNumber} · {details.room.type}
                  </Text>
                </View>
                {details.room.rent != null && (
                  <View style={s.detailRow}>
                    <Text style={s.detailLabel}>Monthly rent</Text>
                    <Text style={s.detailValue}>₹{details.room.rent.toLocaleString("en-IN")}</Text>
                  </View>
                )}
              </>
            ) : (
              <View style={s.detailRow}>
                <Text style={s.detailLabel}>Room</Text>
                <Text style={s.detailValue}>Not assigned</Text>
              </View>
            )}
          </View>
        ) : details === undefined ? (
          <View style={s.loadWrap}>
            <ActivityIndicator size="small" color={colors.navy} />
          </View>
        ) : null}

        {/* Preferred room */}
        <View style={s.sectionCard}>
          <Text style={s.sectionTitle}>Preferred Room</Text>
          <Text style={s.sectionSub}>Enter a room number or let the operator decide</Text>

          <TextInput
            style={[s.input, anyRoom && s.inputDisabled]}
            placeholder="e.g. 204"
            placeholderTextColor={colors.muted}
            value={roomNumber}
            onChangeText={(t) => {
              setRoomNumber(t);
              if (t.trim().length > 0) setAnyRoom(false);
            }}
            editable={!anyRoom}
          />

          <TouchableOpacity
            style={s.anyToggle}
            activeOpacity={0.7}
            onPress={() => {
              setAnyRoom((v) => {
                if (!v) setRoomNumber("");
                return !v;
              });
            }}
          >
            <View style={[s.checkbox, anyRoom && s.checkboxChecked]}>
              {anyRoom && <Ionicons name="checkmark" size={13} color={colors.white} />}
            </View>
            <Text style={s.anyToggleLabel}>Any available room</Text>
          </TouchableOpacity>
        </View>

        {/* Reason */}
        <View style={s.sectionCard}>
          <Text style={s.sectionTitle}>Reason for Change</Text>
          <TextInput
            style={s.textarea}
            placeholder="Describe why you'd like to change rooms..."
            placeholderTextColor={colors.muted}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            value={reason}
            onChangeText={setReason}
          />
        </View>

        <TouchableOpacity
          style={[s.btn, (!canSubmit || loading) && s.btnDisabled]}
          activeOpacity={0.8}
          onPress={handleSubmit}
          disabled={!canSubmit || loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <>
              <Ionicons name="swap-horizontal-outline" size={17} color={colors.white} />
              <Text style={s.btnText}>Submit Request</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceGray,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: colors.navy },
  body: { paddingHorizontal: 20, paddingTop: 20 },
  loadWrap: { paddingVertical: 16, alignItems: "center" },
  detailCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
    overflow: "hidden",
  },
  detailCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
  },
  detailIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: colors.surfaceGray,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  detailCardTitle: { fontSize: 14.5, fontWeight: "700", color: colors.navy, letterSpacing: -0.2 },
  detailCardSub: { fontSize: 12, color: colors.muted, marginTop: 1 },
  divider: { height: 1, backgroundColor: colors.border },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  detailLabel: { fontSize: 13, color: colors.muted, fontWeight: "500" },
  detailValue: { fontSize: 13, color: colors.navy, fontWeight: "600" },
  sectionCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
    padding: 16,
  },
  sectionTitle: { fontSize: 14.5, fontWeight: "700", color: colors.navy, marginBottom: 2 },
  sectionSub: { fontSize: 12, color: colors.muted, marginBottom: 12 },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.navy,
  },
  inputDisabled: { backgroundColor: colors.surfaceGray, color: colors.muted },
  anyToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: { backgroundColor: colors.navy, borderColor: colors.navy },
  anyToggleLabel: { fontSize: 13.5, color: colors.navy, fontWeight: "500" },
  textarea: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: colors.navy,
    minHeight: 100,
    marginTop: 10,
  },
  btn: {
    marginTop: 10,
    borderRadius: radii.pill,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    backgroundColor: colors.navy,
  },
  btnDisabled: { opacity: 0.35 },
  btnText: { fontSize: 15, fontWeight: "700", color: colors.white },
});
