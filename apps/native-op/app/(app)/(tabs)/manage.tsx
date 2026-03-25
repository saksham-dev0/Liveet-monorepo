import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useConvex } from "convex/react";
import { colors, cardShadow, radii } from "../../../constants/theme";

type OnboardedTenantRow = {
  applicationId: string;
  propertyId: string;
  propertyName: string;
  legalNameAsOnId: string;
  imageUrl?: string;
  phone: string;
  moveInDate?: string;
  paymentStatus?: "paid" | "pending";
};

export default function ManageTabScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const convex = useConvex();
  const [items, setItems] = useState<OnboardedTenantRow[] | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await (convex as any).query(
        "properties:listOnboardedTenantsForManage",
        { limit: 200 },
      );
      const list = data?.items;
      setItems(Array.isArray(list) ? list : []);
    } catch {
      setItems([]);
    }
  }, [convex]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Manage</Text>
        <Text style={styles.subtitle}>
          Tenants who completed move-in onboarding
        </Text>
      </View>

      {items === null ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading tenants…</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons
            name="people-outline"
            size={40}
            color={colors.muted}
            style={styles.emptyIcon}
          />
          <Text style={styles.emptyTitle}>No onboarded tenants yet</Text>
          <Text style={styles.emptyBody}>
            When tenants submit their move-in application on your properties, they
            will appear here.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {items.map((row) => (
            <Pressable
              key={row.applicationId}
              onPress={() =>
                router.push({
                  pathname: "/(app)/tenant/[applicationId]",
                  params: { applicationId: row.applicationId },
                } as Href)
              }
              style={({ pressed }) => [
                styles.cardPressable,
                pressed && styles.cardPressablePressed,
              ]}
            >
              <View style={styles.cardInner}>
                {row.imageUrl ? (
                  <Image source={{ uri: row.imageUrl }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Ionicons name="person" size={22} color="#374151" />
                  </View>
                )}
                <View style={styles.rowBody}>
                  <Text style={styles.name} numberOfLines={1}>
                    {row.legalNameAsOnId}
                  </Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {row.propertyName}
                  </Text>
                  <Text style={styles.metaMuted} numberOfLines={1}>
                    {row.phone}
                  </Text>
                  {row.moveInDate?.trim() ? (
                    <Text style={styles.moveIn} numberOfLines={1}>
                      Move-in: {row.moveInDate}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.pillWrap}>
                  <PaymentPill status={row.paymentStatus} />
                </View>
              </View>
            </Pressable>
          ))}
          <View style={styles.listBottomSpacer} />
        </ScrollView>
      )}
    </View>
  );
}

function PaymentPill({
  status,
}: {
  status?: "paid" | "pending";
}) {
  if (status === "paid") {
    return (
      <View style={[styles.pill, styles.pillPaid]}>
        <Text style={styles.pillTextPaid}>Paid</Text>
      </View>
    );
  }
  if (status === "pending") {
    return (
      <View style={[styles.pill, styles.pillPending]}>
        <Text style={styles.pillTextPending}>Pending</Text>
      </View>
    );
  }
  return (
    <View style={[styles.pill, styles.pillNeutral]}>
      <Text style={styles.pillTextNeutral}>—</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.pageBg,
    paddingHorizontal: 20,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.black,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.muted,
    lineHeight: 20,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.muted,
  },
  emptyCard: {
    backgroundColor: colors.white,
    borderRadius: radii.card,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    ...cardShadow,
  },
  emptyIcon: {
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: colors.black,
    marginBottom: 8,
    textAlign: "center",
  },
  emptyBody: {
    fontSize: 14,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 21,
  },
  cardPressable: {
    marginBottom: 12,
    borderRadius: 16,
  },
  cardPressablePressed: {
    opacity: 0.88,
  },
  cardInner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    ...cardShadow,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 12,
    marginRight: 12,
    backgroundColor: colors.inputBg,
    flexShrink: 0,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 12,
    marginRight: 12,
    backgroundColor: colors.inputBg,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
  },
  name: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.black,
  },
  meta: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
  },
  metaMuted: {
    fontSize: 13,
    color: "#9CA3AF",
    marginTop: 2,
  },
  moveIn: {
    fontSize: 12,
    color: colors.black,
    marginTop: 4,
    fontWeight: "500",
  },
  pillWrap: {
    flexShrink: 0,
    marginLeft: 8,
    justifyContent: "center",
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  pillPaid: {
    backgroundColor: "#DCFCE7",
  },
  pillTextPaid: {
    fontSize: 12,
    fontWeight: "700",
    color: "#166534",
  },
  pillPending: {
    backgroundColor: "#FEF3C7",
  },
  pillTextPending: {
    fontSize: 12,
    fontWeight: "700",
    color: "#92400E",
  },
  pillNeutral: {
    backgroundColor: colors.inputBg,
  },
  pillTextNeutral: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.muted,
  },
  listBottomSpacer: {
    height: 100,
  },
});
