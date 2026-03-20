import React from "react";
import { View, StyleSheet, ScrollView, Pressable, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const SPENDING_DATA = [
  { week: "Week 1", value: 200 },
  { week: "Week 2", value: 120 },
  { week: "Week 3", value: 380 },
  { week: "Week 4", value: 220 },
];

const TRANSACTIONS = [
  {
    id: 1,
    name: "Grocery Store",
    date: "Today, 9:14 AM",
    amount: "-$42.00",
    icon: "cart-outline" as const,
    color: "#DC2626",
  },
  {
    id: 2,
    name: "Savings",
    date: "Yesterday",
    amount: "+$60.00",
    icon: "wallet-outline" as const,
    color: "#16A34A",
  },
  {
    id: 3,
    name: "Netflix",
    date: "Mar 17",
    amount: "-$15.99",
    icon: "play-outline" as const,
    color: "#DC2626",
  },
  {
    id: 4,
    name: "Salary Deposit",
    date: "Mar 15",
    amount: "+$4,200.00",
    icon: "cash-outline" as const,
    color: "#16A34A",
  },
  {
    id: 5,
    name: "Coffee Shop",
    date: "Mar 14",
    amount: "-$6.50",
    icon: "cafe-outline" as const,
    color: "#DC2626",
  },
];

const SUMMARY_CARDS = [
  {
    label: "Spent",
    amount: "$1,240",
    dotColor: "#F87171",
    bgColor: "#1E293B",
    icon: "receipt-outline" as const,
  },
  {
    label: "Saved",
    amount: "$3,500",
    dotColor: "#34D399",
    bgColor: "#1E293B",
    icon: "briefcase-outline" as const,
  },
  {
    label: "Invested",
    amount: "$8,200",
    dotColor: "#60A5FA",
    bgColor: "#1E293B",
    icon: "trending-up-outline" as const,
  },
  {
    label: "Income",
    amount: "$5,800",
    dotColor: "#A78BFA",
    bgColor: "#1E293B",
    icon: "cash-outline" as const,
  },
];

export default function TestScreen() {
  const maxBarValue = Math.max(...SPENDING_DATA.map((d) => d.value));

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
            <Text style={styles.greetingName}>Maya</Text>
          </View>
          <View style={styles.headerRight}>
            <Pressable style={styles.orgPill}>
              <View style={styles.orgDot} />
              <Text style={styles.orgText}>Acme Inc</Text>
              <Ionicons name="chevron-down" size={12} color="#9CA3AF" />
            </Pressable>
            <Pressable style={styles.profileButton}>
              <Ionicons name="person-outline" size={16} color="#fff" />
            </Pressable>
          </View>
        </View>

        {/* Balance Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <Text style={styles.heroLabel}>Total Balance</Text>
            <View style={styles.changeBadge}>
              <Ionicons name="arrow-up" size={11} color="#1a1a1a" />
              <Text style={styles.changeText}>+2.4%</Text>
            </View>
          </View>

          <Text style={styles.heroAmount}>$24,830.00</Text>

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            <Pressable style={styles.actionButton}>
              <Ionicons name="send" size={14} color="#fff" />
              <Text style={styles.actionButtonText}>Send</Text>
            </Pressable>
            <Pressable style={styles.actionButton}>
              <Ionicons name="arrow-up" size={14} color="#fff" />
              <Text style={styles.actionButtonText}>Top Up</Text>
            </Pressable>
            <Pressable style={styles.actionButton}>
              <Ionicons name="ellipsis-horizontal" size={14} color="#fff" />
              <Text style={styles.actionButtonText}>More</Text>
            </Pressable>
          </View>

          {/* Stats row */}
          <View style={styles.heroStatsRow}>
            {SUMMARY_CARDS.map((card, index) => (
              <React.Fragment key={card.label}>
                {index > 0 && <View style={styles.heroStatDivider} />}
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatLabel}>{card.label}</Text>
                  <Text style={styles.heroStatValue}>{card.amount}</Text>
                </View>
              </React.Fragment>
            ))}
          </View>
        </View>

        {/* Spending Chart */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Spending this month</Text>
          <View style={styles.chartContainer}>
            <View style={styles.chartBars}>
              {SPENDING_DATA.map((item) => (
                <View key={item.week} style={styles.barGroup}>
                  <View style={styles.barWrapper}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: (item.value / maxBarValue) * 120,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.barLabel}>{item.week}</Text>
                </View>
              ))}
            </View>
            <View style={styles.chartYAxis}>
              {["$400", "$300", "$200", "$100"].map((label) => (
                <Text key={label} style={styles.yAxisLabel}>
                  {label}
                </Text>
              ))}
            </View>
          </View>
        </View>

        {/* Recent Transactions */}
        <View style={styles.card}>
          <View style={styles.transactionsHeader}>
            <Text style={styles.cardTitle}>
              Recent Transactions
            </Text>
            <Pressable style={styles.seeAllButton}>
              <Text style={styles.seeAllText}>See all</Text>
              <Ionicons name="arrow-forward" size={14} color="#6B7280" />
            </Pressable>
          </View>
          {TRANSACTIONS.map((tx) => (
            <View key={tx.id} style={styles.transactionRow}>
              <View style={styles.transactionIcon}>
                <Ionicons name={tx.icon} size={20} color="#374151" />
              </View>
              <View style={styles.transactionInfo}>
                <Text style={styles.transactionName}>
                  {tx.name}
                </Text>
                <Text style={styles.transactionDate}>
                  {tx.date}
                </Text>
              </View>
              <Text
                style={[styles.transactionAmount, { color: tx.color }]}
              >
                {tx.amount}
              </Text>
            </View>
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerDividerRow}>
            <View style={styles.footerLine} />
            <Text style={styles.footerBrand}>SoyFin</Text>
            <View style={styles.footerLine} />
          </View>
          <Text style={styles.footerTagline}>
            your money, finally making sense
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#EEF2F6",
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 120,
  },
  greetingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  greeting: {
    flex: 1,
    marginRight: 12,
  },
  greetingLabel: {
    fontSize: 13,
    color: "#9CA3AF",
  },
  greetingName: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginTop: 2,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  orgPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 5,
  },
  orgDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#34D399",
  },
  orgText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  profileButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#1E293B",
    justifyContent: "center",
    alignItems: "center",
  },
  heroCard: {
    backgroundColor: "#1E293B",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  heroHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  heroLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.5)",
  },
  changeBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#D4F542",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 3,
  },
  changeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  heroAmount: {
    fontSize: 34,
    fontWeight: "600",
    color: "#fff",
    letterSpacing: -1.2,
    marginBottom: 16,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#fff",
  },
  heroStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.15)",
    paddingTop: 14,
  },
  heroStat: {
    flex: 1,
  },
  heroStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: "rgba(255,255,255,0.15)",
    marginHorizontal: 12,
  },
  heroStatLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: "rgba(255,255,255,0.45)",
    marginBottom: 2,
  },
  heroStatValue: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginBottom: 16,
  },
  chartContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  chartBars: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-end",
  },
  barGroup: {
    alignItems: "center",
  },
  barWrapper: {
    height: 120,
    justifyContent: "flex-end",
  },
  bar: {
    width: 40,
    backgroundColor: "#1E293B",
    borderRadius: 6,
  },
  barLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 8,
  },
  chartYAxis: {
    justifyContent: "space-between",
    height: 120,
    marginLeft: 8,
  },
  yAxisLabel: {
    fontSize: 11,
    color: "#9CA3AF",
  },
  transactionsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  seeAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  seeAllText: {
    fontSize: 14,
    color: "#6B7280",
  },
  transactionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  transactionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  transactionDate: {
    fontSize: 13,
    color: "#9CA3AF",
    marginTop: 2,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: "600",
  },
  // Footer
  footer: {
    alignItems: "center",
    marginTop: 32,
    paddingVertical: 24,
    opacity: 0.45,
    gap: 10,
  },
  footerDividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  footerLine: {
    width: 32,
    height: 1,
    borderRadius: 1,
    backgroundColor: "#9CA3AF",
  },
  footerBrand: {
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 5,
    textTransform: "uppercase",
    color: "#6B7280",
  },
  footerTagline: {
    fontSize: 13,
    fontStyle: "italic",
    letterSpacing: 1.5,
    textTransform: "lowercase",
    color: "#6B7280",
  },
});
