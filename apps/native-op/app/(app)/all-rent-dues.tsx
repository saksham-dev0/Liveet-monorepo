import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useConvex } from "convex/react";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "@clerk/clerk-expo";

type TenantWithDue = {
  applicationId: string;
  tenantName: string;
  imageUrl?: string;
  roomNumber?: string;
  dueAmount: number;
  overdueMonths: number;
};

export default function AllRentDuesScreen() {
  const router = useRouter();
  const convex = useConvex();
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const [tenantsWithDues, setTenantsWithDues] = useState<TenantWithDue[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!authLoaded || !isSignedIn) return;
      (async () => {
        try {
          const data = await (convex as any).query(
            "properties:getDashboardCollectionSummary",
            {},
          );
          setTenantsWithDues(data?.tenantsWithDues ?? []);
        } catch {
          setTenantsWithDues([]);
        }
      })();
    }, [authLoaded, isSignedIn, convex]),
  );

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color="#1E293B" />
        </Pressable>
        <Text style={styles.headerTitle}>Rent Dues</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {tenantsWithDues === null ? (
          <Text style={styles.emptyText}>Loading…</Text>
        ) : tenantsWithDues.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="checkmark-circle-outline" size={40} color="#34D399" />
            <Text style={styles.emptyText}>No pending rent dues!</Text>
          </View>
        ) : (
          <>
            <Text style={styles.subtitle}>
              {tenantsWithDues.length} tenant{tenantsWithDues.length !== 1 ? "s" : ""} with overdue rent
            </Text>
            {tenantsWithDues.map((t) => (
              <View key={t.applicationId} style={styles.row}>
                {t.imageUrl ? (
                  <Image source={{ uri: t.imageUrl }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Ionicons name="person" size={20} color="#DC2626" />
                  </View>
                )}
                <View style={styles.info}>
                  <Text style={styles.name} numberOfLines={1}>
                    {t.tenantName}
                  </Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {t.roomNumber ? `Room ${t.roomNumber} · ` : ""}
                    {t.overdueMonths} month{t.overdueMonths !== 1 ? "s" : ""} overdue
                  </Text>
                </View>
                <Text style={styles.amount}>
                  {`₹${Math.round(t.dueAmount).toLocaleString("en-IN")}`}
                </Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#EEF2F6",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: "#EEF2F6",
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1E293B",
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 12,
  },
  emptyWrap: {
    alignItems: "center",
    paddingVertical: 48,
    gap: 10,
  },
  emptyText: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
    paddingVertical: 24,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    marginRight: 12,
    backgroundColor: "#F3F4F6",
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  meta: {
    fontSize: 13,
    color: "#9CA3AF",
    marginTop: 2,
  },
  amount: {
    fontSize: 16,
    fontWeight: "600",
    color: "#DC2626",
  },
});
