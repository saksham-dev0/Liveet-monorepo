import React, { useCallback, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Text,
  TouchableOpacity,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { useConvex } from "convex/react";
import { useFocusEffect } from "@react-navigation/native";

const SPENDING_DATA = [
  { week: "Week 1", value: 200 },
  { week: "Week 2", value: 120 },
  { week: "Week 3", value: 380 },
  { week: "Week 4", value: 220 },
];

/** Placeholder until rent collection is modeled in Convex */
const SAMPLE_PENDING_COLLECTION = "₹8,200";
const SAMPLE_RECEIVED_COLLECTION = "₹5,800";

const DASHBOARD_STAT_CARDS = [
  { label: "Occupants" },
  { label: "Vacant" },
  { label: "Pending" },
  { label: "Received" },
] as const;

type RecentKycTenantItem = {
  applicationId: string;
  legalNameAsOnId: string;
  imageUrl?: string;
  phone: string;
  moveInDate?: string;
};

type RecentCreditedTransactionItem = {
  applicationId: string;
  tenantName: string;
  amount: number;
  createdAt: number;
  type: "credit";
};

function getGreetingLabel(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

function getFirstName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";
  const [first] = trimmed.split(/\s+/);
  return first ?? "";
}

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

function formatInrAmount(amount: number): string {
  return `₹${Math.round(amount).toLocaleString("en-IN")}.00`;
}

export default function TestScreen() {
  const router = useRouter();
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const convex = useConvex();
  const maxBarValue = Math.max(...SPENDING_DATA.map((d) => d.value));

  const [listingChecklistComplete, setListingChecklistComplete] = useState<
    boolean | null
  >(null);
  const [dashboardStats, setDashboardStats] = useState<{
    occupiedUnits: number;
    vacantUnits: number;
    occupantsWithKyc: number;
    totalPaidRentAmount: number;
  } | null>(null);
  const [recentKycTenants, setRecentKycTenants] = useState<
    RecentKycTenantItem[] | null
  >(null);
  const [greetingName, setGreetingName] = useState("user");
  const [recentTransactions, setRecentTransactions] = useState<
    RecentCreditedTransactionItem[] | null
  >(null);

  const refreshListingStatus = useCallback(async () => {
    try {
      const data = await (convex as any).query(
        "onboarding:getPropertyListingEditorData",
        {},
      );
      setListingChecklistComplete(data?.listingChecklistComplete === true);
      const maybeName =
        typeof data?.user?.name === "string" ? data.user.name.trim() : "";
      setGreetingName(getFirstName(maybeName) || "user");
    } catch {
      setListingChecklistComplete(false);
      setGreetingName("user");
    }
  }, [convex]);

  const refreshDashboardStats = useCallback(async () => {
    try {
      await (convex as any).mutation("properties:syncVacantUnitsForDashboard", {});
      const data = await (convex as any).query(
        "properties:getDashboardPropertyStats",
        {},
      );
      setDashboardStats(
        data
          ? {
              occupiedUnits: data.occupiedUnits,
              vacantUnits: data.vacantUnits,
              occupantsWithKyc: data.occupantsWithKyc ?? 0,
              totalPaidRentAmount: data.totalPaidRentAmount ?? 0,
            }
          : {
              occupiedUnits: 0,
              vacantUnits: 0,
              occupantsWithKyc: 0,
              totalPaidRentAmount: 0,
            },
      );
    } catch {
      setDashboardStats({
        occupiedUnits: 0,
        vacantUnits: 0,
        occupantsWithKyc: 0,
        totalPaidRentAmount: 0,
      });
    }
  }, [convex]);

  const refreshRecentKycTenants = useCallback(async () => {
    try {
      const data = await (convex as any).query(
        "properties:getRecentKycTenantsForDashboard",
        { limit: 8 },
      );
      const items = data?.items;
      setRecentKycTenants(Array.isArray(items) ? items : []);
    } catch {
      setRecentKycTenants([]);
    }
  }, [convex]);

  const refreshRecentTransactions = useCallback(async () => {
    try {
      const data = await (convex as any).query(
        "properties:getRecentCreditedTransactionsForDashboard",
        { limit: 6 },
      );
      const items = data?.items;
      setRecentTransactions(Array.isArray(items) ? items : []);
    } catch {
      setRecentTransactions([]);
    }
  }, [convex]);

  useFocusEffect(
    useCallback(() => {
      if (!authLoaded || !isSignedIn) return;
      void refreshListingStatus();
      void refreshDashboardStats();
      void refreshRecentKycTenants();
      void refreshRecentTransactions();
    }, [
      authLoaded,
      isSignedIn,
      refreshListingStatus,
      refreshDashboardStats,
      refreshRecentKycTenants,
      refreshRecentTransactions,
    ]),
  );

  const showListPropertyCard = listingChecklistComplete !== true;

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
            <Text style={styles.greetingLabel}>{getGreetingLabel()}</Text>
            <Text style={styles.greetingName}>{greetingName}</Text>
          </View>
          <View style={styles.headerRight}>
            <Pressable style={styles.orgPill}>
              <View style={styles.orgDot} />
              <Text style={styles.orgText}>Acme Inc</Text>
              <Ionicons name="chevron-down" size={12} color="#9CA3AF" />
            </Pressable>
            <Pressable
              style={styles.profileButton}
              onPress={() =>
                router.push("/(app)/profile" as Href)
              }
              accessibilityRole="button"
              accessibilityLabel="Open profile"
            >
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

          <Text style={styles.heroAmount}>
            {formatInrAmount(dashboardStats?.totalPaidRentAmount ?? 0)}
          </Text>

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

          {/* Stats row — occupied/vacant from Convex; collection amounts sample */}
          <View style={styles.heroStatsRow}>
            {DASHBOARD_STAT_CARDS.map((card, index) => {
              const amount =
                index === 0
                  ? String(dashboardStats?.occupantsWithKyc ?? 0)
                  : index === 1
                    ? String(dashboardStats?.vacantUnits ?? 0)
                    : index === 2
                      ? SAMPLE_PENDING_COLLECTION
                      : SAMPLE_RECEIVED_COLLECTION;
              return (
                <React.Fragment key={card.label}>
                  {index > 0 && <View style={styles.heroStatDivider} />}
                  <View style={styles.heroStat}>
                    <Text style={styles.heroStatLabel}>{card.label}</Text>
                    <Text style={styles.heroStatValue}>{amount}</Text>
                  </View>
                </React.Fragment>
              );
            })}
          </View>
        </View>

        {/* List property CTA — hidden once listing checklist is complete; edit from Profile */}
        {showListPropertyCard && (
          <View style={styles.card}>
            <View style={styles.listPropertyHeader}>
              <View style={styles.listPropertyIconWrap}>
                <Ionicons name="home-outline" size={22} color="#1E293B" />
              </View>
              <Text style={styles.listPropertyBody}>
                Add complete details of the property to list your property for the
                tenants.
              </Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.listPropertyButton}
              onPress={() => router.push("/(app)/list-property")}
            >
              <Text style={styles.listPropertyButtonText}>List your property</Text>
              <Ionicons name="arrow-forward" size={18} color="#1a1a1a" />
            </TouchableOpacity>
          </View>
        )}

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
              {["₹400", "₹300", "₹200", "₹100"].map((label) => (
                <Text key={label} style={styles.yAxisLabel}>
                  {label}
                </Text>
              ))}
            </View>
          </View>
        </View>

        {/* Recent E-KYC tenants */}
        <View style={styles.card}>
          <Text style={[styles.cardTitle, styles.kycCardTitle]}>Upcoming Move-Ins</Text>
          <Text style={styles.cardSubtitle}>
            Tenants who have completed E-KYC and are scheduled to move in soon
          </Text>
          {recentKycTenants === null ? (
            <Text style={styles.kycEmptyText}>Loading…</Text>
          ) : recentKycTenants.length === 0 ? (
            <Text style={styles.kycEmptyText}>
              No completed move-in applications yet. Tenants who finish E-KYC in
              the tenant app will appear here.
            </Text>
          ) : (
            recentKycTenants.map((item) => (
              <View key={item.applicationId} style={styles.transactionRow}>
                {item.imageUrl ? (
                  <Image
                    source={{ uri: item.imageUrl }}
                    style={styles.kycTenantAvatar}
                  />
                ) : (
                  <View style={styles.transactionIcon}>
                    <Ionicons name="person" size={20} color="#374151" />
                  </View>
                )}
                <View style={styles.transactionInfo}>
                  <Text style={styles.transactionName} numberOfLines={1}>
                    {item.legalNameAsOnId}
                  </Text>
                  <Text style={styles.transactionDate} numberOfLines={1}>
                    {item.phone}
                  </Text>
                </View>
                <Text style={styles.kycMoveInDate} numberOfLines={2}>
                  {item.moveInDate?.trim() ? item.moveInDate : "—"}
                </Text>
              </View>
            ))
          )}
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
          {recentTransactions === null ? (
            <Text style={styles.kycEmptyText}>Loading…</Text>
          ) : recentTransactions.length === 0 ? (
            <Text style={styles.kycEmptyText}>
              No credited transactions yet. Paid single sharing move-ins will
              appear here.
            </Text>
          ) : (
            recentTransactions.map((tx) => (
              <View key={tx.applicationId} style={styles.transactionRow}>
                <View style={styles.transactionIcon}>
                  <Ionicons name="cash-outline" size={20} color="#16A34A" />
                </View>
                <View style={styles.transactionInfo}>
                  <Text style={styles.transactionName}>{tx.tenantName}</Text>
                  <Text style={styles.transactionDate}>
                    {formatTransactionDate(tx.createdAt)}
                  </Text>
                </View>
                <Text style={[styles.transactionAmount, { color: "#16A34A" }]}>
                  {formatCreditAmount(tx.amount)}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* Footer */}
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
  kycCardTitle: {
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: "#6B7280",
    marginBottom: 16,
  },
  kycEmptyText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#9CA3AF",
  },
  kycTenantAvatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    marginRight: 12,
    backgroundColor: "#F3F4F6",
  },
  kycMoveInDate: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1a1a1a",
    textAlign: "right",
    marginLeft: 10,
    maxWidth: "32%",
  },
  listPropertyHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 18,
  },
  listPropertyIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  listPropertyBody: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: "#6B7280",
  },
  listPropertyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "stretch",
    minHeight: 52,
    backgroundColor: "#D4F542",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 14,
  },
  listPropertyButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
    marginRight: 8,
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
