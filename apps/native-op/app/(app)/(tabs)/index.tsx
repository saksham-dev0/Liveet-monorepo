import React, { useCallback, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Text,
  TouchableOpacity,
  Image,
  Modal,
  Animated,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { useConvex } from "convex/react";
import { useFocusEffect } from "@react-navigation/native";

const WEEK_LABELS = ["Week 1", "Week 2", "Week 3", "Week 4"];

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
  breakdown: string;
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

function compactNumber(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(abs >= 10_000 ? 0 : 1).replace(/\.0$/, "")}k`;
  return String(Math.round(n));
}

function compactInr(amount: number): string {
  return `₹${compactNumber(Math.round(amount))}`;
}

export default function TestScreen() {
  const router = useRouter();
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const convex = useConvex();

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
  const [propertyName, setPropertyName] = useState<string | null>(null);
  const [propertyDropdownVisible, setPropertyDropdownVisible] = useState(false);
  const [operatorProperties, setOperatorProperties] = useState<
    Array<{ id: string; name: string | null; city: string | null }>
  >([]);
  const [activePrimaryPropertyId, setActivePrimaryPropertyId] = useState<string | null>(null);
  const [switchingPropertyId, setSwitchingPropertyId] = useState<string | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<
    RecentCreditedTransactionItem[] | null
  >(null);
  const [monthlyChartData, setMonthlyChartData] = useState<number[] | null>(null);
  const [collectionSummary, setCollectionSummary] = useState<{
    pendingAmount: number;
    receivedLast24h: number;
  } | null>(null);
  const [monthlyGrowth, setMonthlyGrowth] = useState<{
    currentMonth: number;
    previousMonth: number;
  } | null>(null);

  // Remind modal
  const [remindModalVisible, setRemindModalVisible] = useState(false);
  const [overdueTenants, setOverdueTenants] = useState<Array<{
    applicationId: string;
    tenantName: string;
    tenantImageUrl?: string;
    phone?: string;
    roomNumber?: string;
    propertyName?: string;
    monthlyRent: number;
    daysOverdue: number;
  }> | null>(null);

  // More dropdown
  const [moreDropdownVisible, setMoreDropdownVisible] = useState(false);
  const moreAnim = useRef(new Animated.Value(0)).current;
  const [yearlyTotal, setYearlyTotal] = useState<number | null>(null);

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
      const maybePropName =
        typeof data?.property?.name === "string" ? data.property.name.trim() : "";
      setPropertyName(maybePropName || null);
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

  const refreshOperatorProperties = useCallback(async () => {
    try {
      const data = await (convex as any).query(
        "properties:getOperatorProperties",
        {},
      );
      if (data) {
        setOperatorProperties(data.properties ?? []);
        setActivePrimaryPropertyId(data.primaryPropertyId ?? null);
      }
    } catch {
      // ignore
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

  const refreshMonthlyChartData = useCallback(async () => {
    try {
      const data = await (convex as any).query(
        "properties:getMonthlyRentChartData",
        {},
      );
      setMonthlyChartData(Array.isArray(data?.weeks) ? data.weeks : [0, 0, 0, 0]);
    } catch {
      setMonthlyChartData([0, 0, 0, 0]);
    }
  }, [convex]);

  const openRemindModal = useCallback(async () => {
    setRemindModalVisible(true);
    try {
      const data = await (convex as any).query(
        "properties:getOverdueTenantsForReminder",
        {},
      );
      setOverdueTenants(data?.tenants ?? []);
    } catch {
      setOverdueTenants([]);
    }
  }, [convex]);

  const toggleMoreDropdown = useCallback(() => {
    const toValue = moreDropdownVisible ? 0 : 1;
    setMoreDropdownVisible(!moreDropdownVisible);
    Animated.spring(moreAnim, {
      toValue,
      useNativeDriver: false,
      tension: 60,
      friction: 10,
    }).start();
    if (!moreDropdownVisible) {
      (convex as any)
        .query("properties:getYearlyCollectionTotal", {})
        .then((d: any) => setYearlyTotal(d?.total ?? 0))
        .catch(() => setYearlyTotal(0));
    }
  }, [convex, moreDropdownVisible, moreAnim]);

  const refreshMonthlyGrowth = useCallback(async () => {
    try {
      const data = await (convex as any).query("properties:getMonthlyGrowth", {});
      setMonthlyGrowth(
        data
          ? { currentMonth: data.currentMonth ?? 0, previousMonth: data.previousMonth ?? 0 }
          : { currentMonth: 0, previousMonth: 0 },
      );
    } catch {
      setMonthlyGrowth({ currentMonth: 0, previousMonth: 0 });
    }
  }, [convex]);

  const refreshCollectionSummary = useCallback(async () => {
    try {
      const data = await (convex as any).query(
        "properties:getDashboardCollectionSummary",
        {},
      );
      setCollectionSummary(
        data
          ? { pendingAmount: data.pendingAmount ?? 0, receivedLast24h: data.receivedLast24h ?? 0 }
          : { pendingAmount: 0, receivedLast24h: 0 },
      );
    } catch {
      setCollectionSummary({ pendingAmount: 0, receivedLast24h: 0 });
    }
  }, [convex]);

  const handleSwitchProperty = useCallback(
    async (propertyId: string) => {
      if (switchingPropertyId) return;
      setSwitchingPropertyId(propertyId);
      try {
        await (convex as any).mutation("properties:setPrimaryProperty", {
          propertyId,
        });
        setPropertyDropdownVisible(false);
        // Clear stale data immediately before fetching new property's data
        setDashboardStats(null);
        setRecentKycTenants(null);
        setRecentTransactions(null);
        setPropertyName(null);
        setListingChecklistComplete(null);
        setMonthlyChartData(null);
        setCollectionSummary(null);
        setMonthlyGrowth(null);
        setOverdueTenants(null);
        setYearlyTotal(null);
        // Refresh all dashboard data for the new active property
        void refreshListingStatus();
        void refreshDashboardStats();
        void refreshRecentKycTenants();
        void refreshRecentTransactions();
        void refreshOperatorProperties();
        void refreshMonthlyChartData();
        void refreshCollectionSummary();
        void refreshMonthlyGrowth();
      } catch {
        // ignore
      } finally {
        setSwitchingPropertyId(null);
      }
    },
    [
      convex,
      switchingPropertyId,
      refreshListingStatus,
      refreshDashboardStats,
      refreshRecentKycTenants,
      refreshRecentTransactions,
      refreshOperatorProperties,
      refreshMonthlyChartData,
      refreshCollectionSummary,
      refreshMonthlyGrowth,
    ],
  );

  useFocusEffect(
    useCallback(() => {
      if (!authLoaded || !isSignedIn) return;
      void refreshListingStatus();
      void refreshDashboardStats();
      void refreshRecentKycTenants();
      void refreshRecentTransactions();
      void refreshOperatorProperties();
      void refreshMonthlyChartData();
      void refreshCollectionSummary();
      void refreshMonthlyGrowth();
    }, [
      authLoaded,
      isSignedIn,
      refreshListingStatus,
      refreshDashboardStats,
      refreshRecentKycTenants,
      refreshRecentTransactions,
      refreshOperatorProperties,
      refreshMonthlyChartData,
      refreshCollectionSummary,
      refreshMonthlyGrowth,
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
            <Pressable
              style={styles.orgPill}
              onPress={() => setPropertyDropdownVisible(true)}
            >
              <View style={styles.orgDot} />
              <Text style={styles.orgText} numberOfLines={1}>
                {propertyName ?? "My Property"}
              </Text>
              <Ionicons name="chevron-down" size={12} color="#9CA3AF" />
            </Pressable>
            <Pressable
              style={styles.notificationButton}
              onPress={() => router.push("/(app)/notifications" as Href)}
              accessibilityRole="button"
              accessibilityLabel="View notifications"
            >
              <Ionicons name="notifications-outline" size={18} color="#1E293B" />
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
            {monthlyGrowth !== null && monthlyGrowth.previousMonth > 0 && (() => {
              const pct = ((monthlyGrowth.currentMonth - monthlyGrowth.previousMonth) / monthlyGrowth.previousMonth) * 100;
              const up = pct >= 0;
              return (
                <View style={[styles.changeBadge, !up && styles.changeBadgeDown]}>
                  <Ionicons name={up ? "arrow-up" : "arrow-down"} size={11} color={up ? "#1a1a1a" : "#fff"} />
                  <Text style={[styles.changeText, !up && styles.changeTextDown]}>
                    {up ? "+" : ""}{pct.toFixed(1)}%
                  </Text>
                </View>
              );
            })()}
          </View>

          <Text style={styles.heroAmount}>
            {formatInrAmount(dashboardStats?.totalPaidRentAmount ?? 0)}
          </Text>

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            <Pressable style={styles.actionButton} onPress={openRemindModal}>
              <Ionicons name="notifications-outline" size={14} color="#fff" />
              <Text style={styles.actionButtonText}>Remind</Text>
            </Pressable>
            <Pressable style={styles.actionButton}>
              <Ionicons name="trending-up" size={14} color="#fff" />
              <Text style={styles.actionButtonText} numberOfLines={1}>
                {monthlyGrowth && monthlyGrowth.previousMonth > 0
                  ? `${monthlyGrowth.currentMonth >= monthlyGrowth.previousMonth ? "+" : ""}${compactInr(monthlyGrowth.currentMonth - monthlyGrowth.previousMonth)}`
                  : "Increased by"}
              </Text>
            </Pressable>
            <Pressable style={styles.actionButton} onPress={toggleMoreDropdown}>
              <Ionicons
                name={moreDropdownVisible ? "chevron-up" : "ellipsis-horizontal"}
                size={14}
                color="#fff"
              />
              <Text style={styles.actionButtonText}>More</Text>
            </Pressable>
          </View>

          {/* More dropdown */}
          <Animated.View
            style={[
              styles.moreDropdown,
              {
                maxHeight: moreAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 120],
                }),
                opacity: moreAnim,
              },
            ]}
          >
            <View style={styles.moreDropdownInner}>
              <View style={styles.moreDropdownItem}>
                <View>
                  <Text style={styles.moreDropdownLabel}>Pending dues</Text>
                  <Text style={styles.moreDropdownValue}>
                    {collectionSummary === null
                      ? "—"
                      : compactInr(collectionSummary.pendingAmount)}
                  </Text>
                </View>
                <View style={styles.moreDropdownDivider} />
                <View>
                  <Text style={styles.moreDropdownLabel}>Collected this year</Text>
                  <Text style={styles.moreDropdownValue}>
                    {yearlyTotal === null ? "—" : compactInr(yearlyTotal)}
                  </Text>
                </View>
              </View>
            </View>
          </Animated.View>

          {/* Stats row */}
          <View style={styles.heroStatsRow}>
            {DASHBOARD_STAT_CARDS.map((card, index) => {
              const amount =
                index === 0
                  ? compactNumber(dashboardStats?.occupantsWithKyc ?? 0)
                  : index === 1
                    ? compactNumber(dashboardStats?.vacantUnits ?? 0)
                    : index === 2
                      ? collectionSummary === null
                        ? "—"
                        : compactInr(collectionSummary.pendingAmount)
                      : collectionSummary === null
                        ? "—"
                        : compactInr(collectionSummary.receivedLast24h);
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
          <Text style={styles.cardTitle}>Collection this month</Text>
          {monthlyChartData === null ? (
            <Text style={styles.kycEmptyText}>Loading…</Text>
          ) : monthlyChartData.every((v) => v === 0) ? (
            <Text style={styles.kycEmptyText}>
              No rent collected this month yet.
            </Text>
          ) : (() => {
            const chartMax = Math.max(...monthlyChartData, 1);
            const ySteps = [
              Math.round(chartMax),
              Math.round(chartMax * 0.75),
              Math.round(chartMax * 0.5),
              Math.round(chartMax * 0.25),
            ];
            return (
              <View style={styles.chartContainer}>
                <View style={styles.chartBars}>
                  {WEEK_LABELS.map((label, i) => {
                    const value = monthlyChartData[i] ?? 0;
                    return (
                      <View key={label} style={styles.barGroup}>
                        <View style={styles.barWrapper}>
                          <View
                            style={[
                              styles.bar,
                              { height: Math.max((value / chartMax) * 120, value > 0 ? 4 : 0) },
                            ]}
                          />
                        </View>
                        <Text style={styles.barLabel}>{label}</Text>
                      </View>
                    );
                  })}
                </View>
                <View style={styles.chartYAxis}>
                  {ySteps.map((step) => (
                    <Text key={step} style={styles.yAxisLabel}>
                      {step >= 1000 ? `₹${Math.round(step / 1000)}k` : `₹${step}`}
                    </Text>
                  ))}
                </View>
              </View>
            );
          })()}
        </View>

        {/* Recent E-KYC tenants */}
        <View style={styles.card}>
          <Text style={[styles.cardTitle, styles.kycCardTitle]}>Upcoming Move-Ins</Text>
          <Text style={styles.cardSubtitle}>
            Tenants who have completed payment and are scheduled to move in
          </Text>
          {recentKycTenants === null ? (
            <Text style={styles.kycEmptyText}>Loading…</Text>
          ) : recentKycTenants.length === 0 ? (
            <Text style={styles.kycEmptyText}>
              No upcoming move-ins yet. Tenants who complete payment will appear here.
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
              No credited transactions yet. Paid move-ins will appear here.
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

        {/* Property switcher modal */}
        <Modal
          visible={propertyDropdownVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setPropertyDropdownVisible(false)}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setPropertyDropdownVisible(false)}
          >
            <Pressable style={styles.propertyDropdown} onPress={() => {}}>
              <Text style={styles.propertyDropdownTitle}>Your Properties</Text>
              {operatorProperties.map((p) => {
                const isActive = p.id === activePrimaryPropertyId;
                return (
                  <Pressable
                    key={p.id}
                    style={[
                      styles.propertyDropdownItem,
                      isActive && styles.propertyDropdownItemActive,
                    ]}
                    disabled={!!switchingPropertyId}
                    onPress={() => handleSwitchProperty(p.id)}
                  >
                    <View style={styles.propertyDropdownItemLeft}>
                      <View
                        style={[
                          styles.propertyDropdownDot,
                          isActive && styles.propertyDropdownDotActive,
                        ]}
                      />
                      <View>
                        <Text
                          style={[
                            styles.propertyDropdownName,
                            isActive && styles.propertyDropdownNameActive,
                          ]}
                          numberOfLines={1}
                        >
                          {p.name ?? "Unnamed property"}
                        </Text>
                        {p.city ? (
                          <Text style={styles.propertyDropdownCity}>
                            {p.city}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    {isActive && (
                      <Ionicons name="checkmark" size={16} color="#1E293B" />
                    )}
                  </Pressable>
                );
              })}
              <Pressable
                style={styles.addPropertyButton}
                onPress={() => {
                  setPropertyDropdownVisible(false);
                  router.push("/(app)/add-property");
                }}
              >
                <Ionicons name="add" size={18} color="#1a1a1a" />
                <Text style={styles.addPropertyButtonText}>
                  Add new property
                </Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Remind modal */}
        <Modal
          visible={remindModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setRemindModalVisible(false)}
        >
          <View style={styles.remindBackdrop}>
            <View style={styles.remindSheet}>
              <View style={styles.remindHandle} />
              <View style={styles.remindHeader}>
                <Text style={styles.remindTitle}>Send Reminder</Text>
                <Pressable onPress={() => setRemindModalVisible(false)} hitSlop={12}>
                  <Ionicons name="close" size={22} color="#1E293B" />
                </Pressable>
              </View>
              <Text style={styles.remindSubtitle}>
                Tenants with overdue rent
              </Text>
              {overdueTenants === null ? (
                <Text style={styles.remindEmpty}>Loading…</Text>
              ) : overdueTenants.length === 0 ? (
                <View style={styles.remindEmptyWrap}>
                  <Ionicons name="checkmark-circle-outline" size={40} color="#34D399" />
                  <Text style={styles.remindEmpty}>All tenants are up to date!</Text>
                </View>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false} style={styles.remindList}>
                  {overdueTenants.map((t) => (
                    <View key={t.applicationId} style={styles.remindRow}>
                      {t.tenantImageUrl ? (
                        <Image source={{ uri: t.tenantImageUrl }} style={styles.remindAvatar} />
                      ) : (
                        <View style={styles.remindAvatarPlaceholder}>
                          <Ionicons name="person" size={20} color="#6B7280" />
                        </View>
                      )}
                      <View style={styles.remindInfo}>
                        <Text style={styles.remindTenantName} numberOfLines={1}>
                          {t.tenantName}
                        </Text>
                        <Text style={styles.remindTenantMeta} numberOfLines={1}>
                          {[t.roomNumber, t.propertyName].filter(Boolean).join(" · ")}
                        </Text>
                        <Text style={styles.remindOverdue}>
                          {t.daysOverdue}d overdue · ₹{Math.round(t.monthlyRent).toLocaleString("en-IN")}/mo
                        </Text>
                      </View>
                      <View style={styles.remindActions}>
                        {t.phone ? (
                          <Pressable
                            style={styles.remindCallBtn}
                            onPress={() => Linking.openURL(`tel:${t.phone}`)}
                          >
                            <Ionicons name="call-outline" size={16} color="#1E293B" />
                          </Pressable>
                        ) : null}
                        {t.phone ? (
                          <Pressable
                            style={[styles.remindCallBtn, styles.remindWaBtn]}
                            onPress={() =>
                              Linking.openURL(
                                `whatsapp://send?phone=${t.phone}&text=${encodeURIComponent(`Hi ${t.tenantName}, this is a reminder that your rent of ₹${Math.round(t.monthlyRent).toLocaleString("en-IN")} is overdue by ${t.daysOverdue} days. Please make the payment at the earliest. Thank you.`)}`,
                              )
                            }
                          >
                            <Ionicons name="logo-whatsapp" size={16} color="#fff" />
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
                  ))}
                  <View style={{ height: 24 }} />
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>

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
  notificationButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
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
  changeBadgeDown: {
    backgroundColor: "#EF4444",
  },
  changeTextDown: {
    color: "#fff",
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
  // Property switcher modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
    paddingTop: 104,
    paddingRight: 20,
  },
  propertyDropdown: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 8,
    minWidth: 220,
    maxWidth: 300,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  propertyDropdownTitle: {
    fontSize: 11,
    fontWeight: "600",
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  propertyDropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  propertyDropdownItemActive: {
    backgroundColor: "#F3F4F6",
  },
  propertyDropdownItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  propertyDropdownDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#D1D5DB",
  },
  propertyDropdownDotActive: {
    backgroundColor: "#34D399",
  },
  propertyDropdownName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
  },
  propertyDropdownNameActive: {
    color: "#1a1a1a",
  },
  propertyDropdownCity: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 1,
  },
  addPropertyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E7EB",
    marginTop: 4,
  },
  addPropertyButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  // More dropdown inside hero card
  moreDropdown: {
    overflow: "hidden",
    marginTop: 4,
    marginBottom: 8,
  },
  moreDropdownInner: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.15)",
    paddingTop: 14,
  },
  moreDropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 0,
  },
  moreDropdownLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: "rgba(255,255,255,0.45)",
    marginBottom: 3,
  },
  moreDropdownValue: {
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
  },
  moreDropdownDivider: {
    width: 1,
    height: 36,
    backgroundColor: "rgba(255,255,255,0.15)",
    marginHorizontal: 20,
  },
  // Remind modal
  remindBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  remindSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 20,
    maxHeight: "80%",
  },
  remindHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D1D5DB",
    alignSelf: "center",
    marginBottom: 16,
  },
  remindHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  remindTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1E293B",
  },
  remindSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 16,
  },
  remindList: {
    flexGrow: 0,
  },
  remindEmptyWrap: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 10,
  },
  remindEmpty: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
    paddingVertical: 24,
  },
  remindRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
    gap: 12,
  },
  remindAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F3F4F6",
  },
  remindAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  remindInfo: {
    flex: 1,
  },
  remindTenantName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 2,
  },
  remindTenantMeta: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 3,
  },
  remindOverdue: {
    fontSize: 12,
    color: "#DC2626",
    fontWeight: "600",
  },
  remindActions: {
    flexDirection: "row",
    gap: 8,
  },
  remindCallBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  remindWaBtn: {
    backgroundColor: "#25D366",
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
