import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../packages/backend/convex/_generated/api";
import { colors, radii } from "@/constants/theme";

const getMyTenantDetailsRef = api.tenants.getMyTenantDetails;
const submitExtendStayRef = api.tenants.submitExtendStay;

export default function ExtendStayScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const details = useQuery(getMyTenantDetailsRef);
  const submitExtendStay = useMutation(submitExtendStayRef);

  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!details) return;
    setLoading(true);
    try {
      await submitExtendStay({});
      Alert.alert("Request sent", "Your extend stay request has been submitted.", [
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
        <Text style={s.headerTitle}>Extend Stay</Text>
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
                {details.room.rent != null && (
                  <View style={s.detailRow}>
                    <Text style={s.detailLabel}>Monthly rent</Text>
                    <Text style={s.detailValue}>₹{details.room.rent.toLocaleString("en-IN")}</Text>
                  </View>
                )}
              </>
            )}

            {!details.room && details.rent != null && (
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
            {details.course && (
              <View style={s.detailRow}>
                <Text style={s.detailLabel}>Course</Text>
                <Text style={s.detailValue}>{details.course}</Text>
              </View>
            )}
          </View>
        )}

        <TouchableOpacity
          style={[s.btn, loading && s.btnDisabled]}
          activeOpacity={0.8}
          onPress={handleSubmit}
          disabled={loading || !details}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <>
              <Ionicons name="calendar-outline" size={17} color={colors.white} />
              <Text style={s.btnText}>Request extension</Text>
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
