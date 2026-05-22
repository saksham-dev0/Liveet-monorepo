import React from "react";
import { View, Text, ScrollView, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

export default function DashboardScreen() {
  const router = useRouter();

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.greetingRow}>
          <View style={styles.greeting}>
            <Text style={styles.greetingLabel}>Good Morning</Text>
            <Text style={styles.greetingName}>Operator</Text>
          </View>
          <View style={styles.headerRight}>
            <Pressable style={styles.notificationButton}>
              <Ionicons name="notifications-outline" size={18} color="#1E293B" />
            </Pressable>
            <Pressable style={styles.profileButton}>
              <Ionicons name="person-outline" size={16} color="#fff" />
            </Pressable>
          </View>
        </View>

        {/* Hero Card */}
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>This Year</Text>
          <Text style={styles.heroAmount}>₹0.00</Text>
          <View style={styles.heroStatsRow}>
            {["Occupants", "Vacant", "Pending", "Received"].map((label, i) => (
              <React.Fragment key={label}>
                {i > 0 && <View style={styles.heroStatDivider} />}
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatLabel}>{label}</Text>
                  <Text style={styles.heroStatValue}>—</Text>
                </View>
              </React.Fragment>
            ))}
          </View>
        </View>

        {/* Placeholder cards */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Collection</Text>
          <Text style={styles.emptyText}>No data yet.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recent Transactions</Text>
          <Text style={styles.emptyText}>No transactions yet.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Upcoming Move-Ins</Text>
          <Text style={styles.emptyText}>No upcoming move-ins yet.</Text>
        </View>

        <View style={styles.footer}>
          <View style={styles.footerDividerRow}>
            <View style={styles.footerLine} />
            <Text style={styles.footerBrand}>Liveet</Text>
            <View style={styles.footerLine} />
          </View>
          <Text style={styles.footerTagline}>
            Manage your property operations with ease
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#EEF2F6" },
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 120 },
  greetingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  greeting: { flex: 1, marginRight: 12 },
  greetingLabel: { fontSize: 13, color: "#9CA3AF" },
  greetingName: { fontSize: 22, fontWeight: "bold", color: "#1a1a1a", marginTop: 2 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  notificationButton: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: "#fff", justifyContent: "center", alignItems: "center",
  },
  profileButton: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: "#1E293B", justifyContent: "center", alignItems: "center",
  },
  heroCard: {
    backgroundColor: "#1E293B", borderRadius: 20, padding: 20, marginBottom: 16,
  },
  heroLabel: { fontSize: 13, fontWeight: "600", color: "rgba(255,255,255,0.5)", marginBottom: 6 },
  heroAmount: {
    fontSize: 34, fontWeight: "600", color: "#fff",
    letterSpacing: -1.2, marginBottom: 16,
  },
  heroStatsRow: {
    flexDirection: "row", alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.15)", paddingTop: 14,
  },
  heroStat: { flex: 1 },
  heroStatDivider: {
    width: 1, height: 28,
    backgroundColor: "rgba(255,255,255,0.15)", marginHorizontal: 12,
  },
  heroStatLabel: { fontSize: 11, fontWeight: "500", color: "rgba(255,255,255,0.45)", marginBottom: 2 },
  heroStatValue: { fontSize: 15, fontWeight: "600", color: "#fff" },
  card: { backgroundColor: "#fff", borderRadius: 20, padding: 20, marginBottom: 16 },
  cardTitle: { fontSize: 18, fontWeight: "bold", color: "#1a1a1a", marginBottom: 12 },
  emptyText: { fontSize: 14, color: "#9CA3AF" },
  footer: { alignItems: "center", marginTop: 32, paddingVertical: 24, opacity: 0.45, gap: 10 },
  footerDividerRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  footerLine: { width: 32, height: 1, borderRadius: 1, backgroundColor: "#9CA3AF" },
  footerBrand: {
    fontSize: 20, fontWeight: "900", letterSpacing: 5,
    textTransform: "uppercase", color: "#6B7280",
  },
  footerTagline: {
    fontSize: 13, fontStyle: "italic", letterSpacing: 1.5,
    textTransform: "lowercase", color: "#6B7280",
  },
});
