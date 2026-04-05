import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useConvex } from "convex/react";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "@clerk/clerk-expo";

type TransactionItem = {
  applicationId: string;
  tenantName: string;
  amount: number;
  breakdown: string;
  createdAt: number;
  type: "credit";
};

function formatTransactionDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCreditAmount(amount: number): string {
  return `+₹${Math.round(amount).toLocaleString("en-IN")}`;
}

export default function AllTransactionsScreen() {
  const router = useRouter();
  const convex = useConvex();
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const [transactions, setTransactions] = useState<TransactionItem[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!authLoaded || !isSignedIn) return;
      (async () => {
        try {
          const data = await (convex as any).query(
            "properties:getRecentCreditedTransactionsForDashboard",
            { limit: 50 },
          );
          const items = data?.items;
          setTransactions(Array.isArray(items) ? items : []);
        } catch {
          setTransactions([]);
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
        <Text style={styles.headerTitle}>Recent Transactions</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {transactions === null ? (
          <Text style={styles.emptyText}>Loading…</Text>
        ) : transactions.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="receipt-outline" size={40} color="#9CA3AF" />
            <Text style={styles.emptyText}>No transactions yet.</Text>
          </View>
        ) : (
          transactions.map((tx, index) => (
            <View key={`${tx.applicationId}-${index}`} style={styles.row}>
              <View style={styles.iconWrap}>
                <Ionicons name="cash-outline" size={20} color="#16A34A" />
              </View>
              <View style={styles.info}>
                <Text style={styles.name}>{tx.tenantName}</Text>
                <Text style={styles.date}>
                  {formatTransactionDate(tx.createdAt)}
                </Text>
              </View>
              <Text style={styles.amount}>
                {formatCreditAmount(tx.amount)}
              </Text>
            </View>
          ))
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
  iconWrap: {
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
  date: {
    fontSize: 13,
    color: "#9CA3AF",
    marginTop: 2,
  },
  amount: {
    fontSize: 16,
    fontWeight: "600",
    color: "#16A34A",
  },
});
