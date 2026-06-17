import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { anyApi } from "convex/server";
import { colors, radii } from "@/constants/theme";

const getMyTenantDetailsRef = anyApi.tenants.getMyTenantDetails;
const submitMoveOutRef = anyApi.tenants.submitMoveOut;

export default function MoveOutScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const details = useQuery(getMyTenantDetailsRef);
  const submitMoveOut = useMutation(submitMoveOutRef);

  const [moveOutDate, setMoveOutDate] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!moveOutDate.trim()) {
      Alert.alert("Missing info", "Please enter your move-out date.");
      return;
    }
    if (!reason.trim()) {
      Alert.alert("Missing info", "Please enter your reason for moving out.");
      return;
    }

    setLoading(true);
    try {
      await submitMoveOut({ moveOutDate: moveOutDate.trim(), reason: reason.trim() });
      Alert.alert("Request sent", "Your move-out request has been submitted.", [
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
        <Text style={s.headerTitle}>Move Out</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Room details card */}
        {details ? (
          <View style={s.detailCard}>
            <View style={s.detailCardHeader}>
              <View style={s.detailIconWrap}>
                <Ionicons name="bed-outline" size={20} color={colors.navy} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.detailCardTitle}>{details.propertyName}</Text>
                {(details.propertyCity || details.propertyState) && (
                  <Text style={s.detailCardSub}>
                    {[details.propertyCity, details.propertyState].filter(Boolean).join(", ")}
                  </Text>
                )}
              </View>
            </View>

            <View style={s.divider} />

            <View style={s.detailRow}>
              <Text style={s.detailLabel}>Move-in date</Text>
              <Text style={s.detailValue}>{details.moveInDate}</Text>
            </View>

            {details.room && (
              <>
                <View style={s.detailRow}>
                  <Text style={s.detailLabel}>Room</Text>
                  <Text style={s.detailValue}>
                    {details.room.roomNumber} · {details.room.type}
                  </Text>
                </View>
                {details.room.rent && (
                  <View style={s.detailRow}>
                    <Text style={s.detailLabel}>Monthly rent</Text>
                    <Text style={s.detailValue}>₹{details.room.rent.toLocaleString("en-IN")}</Text>
                  </View>
                )}
              </>
            )}

            {!details.room && details.rent && (
              <View style={s.detailRow}>
                <Text style={s.detailLabel}>Monthly rent</Text>
                <Text style={s.detailValue}>₹{details.rent.toLocaleString("en-IN")}</Text>
              </View>
            )}
          </View>
        ) : details === undefined ? (
          <View style={s.loadWrap}>
            <ActivityIndicator size="small" color={colors.navy} />
          </View>
        ) : null}

        {/* Personal details card */}
        {details && (
          <View style={s.detailCard}>
            <View style={s.detailCardHeader}>
              <View style={s.detailIconWrap}>
                <Ionicons name="person-outline" size={20} color={colors.navy} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.detailCardTitle}>Personal details</Text>
              </View>
            </View>

            <View style={s.divider} />

            <View style={s.detailRow}>
              <Text style={s.detailLabel}>Name</Text>
              <Text style={s.detailValue}>{details.studentName}</Text>
            </View>
            {details.studentPhone && (
              <View style={s.detailRow}>
                <Text style={s.detailLabel}>Phone</Text>
                <Text style={s.detailValue}>{details.studentPhone}</Text>
              </View>
            )}
          </View>
        )}

        {/* Form card */}
        <View style={s.formCard}>
          <View style={s.detailCardHeader}>
            <View style={s.detailIconWrap}>
              <Ionicons name="log-out-outline" size={20} color={colors.navy} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.detailCardTitle}>Move-out details</Text>
            </View>
          </View>

          <View style={s.divider} />

          <View style={s.fieldWrap}>
            <Text style={s.fieldLabel}>Move-out date</Text>
            <TextInput
              style={s.input}
              placeholder="e.g. 15 July 2025"
              placeholderTextColor={colors.muted}
              value={moveOutDate}
              onChangeText={setMoveOutDate}
              returnKeyType="next"
            />
          </View>

          <View style={[s.fieldWrap, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
            <Text style={s.fieldLabel}>Reason for moving out</Text>
            <TextInput
              style={[s.input, s.textArea]}
              placeholder="Briefly describe why you're moving out..."
              placeholderTextColor={colors.muted}
              value={reason}
              onChangeText={setReason}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
        </View>

        <TouchableOpacity
          style={[s.btn, loading && s.btnDisabled]}
          activeOpacity={0.8}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <>
              <Ionicons name="log-out-outline" size={17} color={colors.white} />
              <Text style={s.btnText}>Submit move-out request</Text>
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
  loadWrap: { paddingVertical: 20, alignItems: "center" },
  detailCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
    overflow: "hidden",
  },
  formCard: {
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
  fieldWrap: { paddingHorizontal: 14, paddingVertical: 12 },
  fieldLabel: { fontSize: 12, color: colors.muted, fontWeight: "600", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.4 },
  input: {
    fontSize: 14,
    color: colors.navy,
    fontWeight: "500",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 11 : 8,
    backgroundColor: colors.pageBg,
  },
  textArea: { minHeight: 90, paddingTop: 11 },
  btn: {
    marginTop: 28,
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
