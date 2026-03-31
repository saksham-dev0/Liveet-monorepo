import React, { useCallback, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { useConvex } from "convex/react";
import { useFocusEffect } from "@react-navigation/native";
import { BottomSheet } from "../../components/BottomSheet";

type NotificationItem = {
  _id: string;
  title: string;
  body: string;
  createdAt: number;
  read: boolean;
  type?: string;
  refId?: string | null;
};

type LateEntryDetail = {
  lateEntryRequestId: string;
  entryTime: string;
  reason: string;
  emergencyContact: string;
  status: string;
  tenantName: string;
  tenantEmail: string | null;
  propertyName: string;
  createdAt: number;
};

function formatNotificationDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function getNotificationIcon(type?: string) {
  switch (type) {
    case "complaint":
      return { name: "warning-outline" as const, color: "#F59E0B", bg: "#FEF3C7", accent: "#F59E0B" };
    case "rent":
      return { name: "cash-outline" as const, color: "#16A34A", bg: "#DCFCE7", accent: "#16A34A" };
    case "kyc":
      return { name: "person-outline" as const, color: "#3B82F6", bg: "#DBEAFE", accent: "#3B82F6" };
    case "maintenance":
      return { name: "construct-outline" as const, color: "#8B5CF6", bg: "#EDE9FE", accent: "#8B5CF6" };
    case "late_entry":
      return { name: "time-outline" as const, color: "#8B5CF6", bg: "#EDE9FE", accent: "#8B5CF6" };
    default:
      return { name: "notifications-outline" as const, color: "#6B7280", bg: "#F3F4F6", accent: "#6B7280" };
  }
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const convex = useConvex();
  const [notifications, setNotifications] = useState<NotificationItem[] | null>(null);
  const [detailSheet, setDetailSheet] = useState<{ type: string; refId: string } | null>(null);
  const [lateEntryDetail, setLateEntryDetail] = useState<LateEntryDetail | null | undefined>(undefined);

  const refreshNotifications = useCallback(async (): Promise<NotificationItem[] | null> => {
    try {
      const data = await (convex as any).query(
        "notifications:getOperatorNotifications",
        { limit: 30 },
      );
      const items = data?.items;
      const list: NotificationItem[] = Array.isArray(items) ? items : [];
      setNotifications(list);
      return list;
    } catch {
      setNotifications((prev) => prev ?? []);
      return null;
    }
  }, [convex]);

  const markAllRead = useCallback(async (snapshot: NotificationItem[]) => {
    try {
      const ids = snapshot.filter((n) => !n.read).map((n) => n._id);
      if (ids.length === 0) return;
      await (convex as any).mutation(
        "notifications:markAllOperatorNotificationsRead",
        { notificationIds: ids },
      );
      setNotifications((prev) =>
        prev?.map((n) => (ids.includes(n._id) ? { ...n, read: true } : n)) ?? prev,
      );
    } catch {
      // silent — will retry on next focus
    }
  }, [convex]);

  useFocusEffect(
    useCallback(() => {
      if (!authLoaded || !isSignedIn) return;
      void (async () => {
        const snapshot = await refreshNotifications();
        if (snapshot !== null) void markAllRead(snapshot);
      })();
    }, [authLoaded, isSignedIn, refreshNotifications, markAllRead]),
  );

  const unreadCount = notifications?.filter((n) => !n.read).length ?? 0;

  function handleNotificationPress(item: NotificationItem) {
    if (item.type === "late_entry" && item.refId) {
      setLateEntryDetail(undefined);
      setDetailSheet({ type: item.type, refId: item.refId });
      void (async () => {
        try {
          const detail = await (convex as any).query(
            "lateEntryRequests:getLateEntryRequestById",
            { lateEntryRequestId: item.refId },
          );
          setLateEntryDetail(detail ?? null);
        } catch {
          setLateEntryDetail(null);
        }
      })();
    }
  }

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={20} color="#1E293B" />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {notifications === null ? (
          <View style={styles.emptyWrap}>
            <ActivityIndicator size="small" color="#9CA3AF" />
          </View>
        ) : notifications.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="notifications-off-outline" size={32} color="#9CA3AF" />
            </View>
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptySubtitle}>
              When tenants send you messages or updates, they will appear here.
            </Text>
          </View>
        ) : (
          notifications.map((item) => {
            const icon = getNotificationIcon(item.type);
            const tappable = item.type === "late_entry" && !!item.refId;
            return (
              <Pressable
                key={item._id}
                style={({ pressed }) => [
                  styles.card,
                  !item.read && styles.cardUnread,
                  pressed && tappable && { opacity: 0.8 },
                ]}
                onPress={tappable ? () => handleNotificationPress(item) : undefined}
              >
                {!item.read && <View style={[styles.unreadAccent, { backgroundColor: icon.accent }]} />}
                <View style={styles.cardInner}>
                  <View style={[styles.iconWrap, { backgroundColor: icon.bg }]}>
                    <Ionicons name={icon.name} size={18} color={icon.color} />
                  </View>
                  <View style={styles.cardContent}>
                    <View style={styles.cardTitleRow}>
                      <Text style={[styles.cardTitle, !item.read && styles.cardTitleUnread]} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={styles.cardTime}>{formatNotificationDate(item.createdAt)}</Text>
                    </View>
                    <Text style={styles.cardBody} numberOfLines={2}>
                      {item.body}
                    </Text>
                    {tappable && (
                      <View style={styles.cardFooter}>
                        <View style={styles.viewChip}>
                          <Text style={styles.viewChipText}>View details</Text>
                          <Ionicons name="chevron-forward" size={11} color="#8B5CF6" />
                        </View>
                      </View>
                    )}
                  </View>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      {/* Late Entry Request Detail Sheet */}
      <BottomSheet
        visible={detailSheet?.type === "late_entry"}
        onClose={() => setDetailSheet(null)}
        title="Late Entry Request"
        showCloseButton
        maxHeight="65%"
      >
        {lateEntryDetail === undefined ? (
          <View style={styles.detailLoading}>
            <ActivityIndicator size="small" color="#1E293B" />
          </View>
        ) : lateEntryDetail === null ? (
          <View style={styles.detailLoading}>
            <Text style={styles.detailErrorText}>Could not load request details.</Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailContent}>
            <View style={styles.detailStatusRow}>
              <View style={[
                styles.detailStatusChip,
                lateEntryDetail.status === "open" && { backgroundColor: "#FEF3C7" },
                lateEntryDetail.status === "approved" && { backgroundColor: "#DCFCE7" },
                lateEntryDetail.status === "rejected" && { backgroundColor: "#FEE2E2" },
              ]}>
                <Text style={[
                  styles.detailStatusText,
                  lateEntryDetail.status === "open" && { color: "#92400E" },
                  lateEntryDetail.status === "approved" && { color: "#166534" },
                  lateEntryDetail.status === "rejected" && { color: "#991B1B" },
                ]}>
                  {lateEntryDetail.status.charAt(0).toUpperCase() + lateEntryDetail.status.slice(1)}
                </Text>
              </View>
              <Text style={styles.detailDate}>{formatNotificationDate(lateEntryDetail.createdAt)}</Text>
            </View>

            <View style={styles.detailCard}>
              <View style={styles.detailRow}>
                <Ionicons name="person-outline" size={16} color="#6B7280" style={styles.detailRowIcon} />
                <View style={styles.detailRowContent}>
                  <Text style={styles.detailLabel}>Tenant</Text>
                  <Text style={styles.detailValue}>{lateEntryDetail.tenantName}</Text>
                  {lateEntryDetail.tenantEmail && (
                    <Text style={styles.detailSub}>{lateEntryDetail.tenantEmail}</Text>
                  )}
                </View>
              </View>
              <View style={styles.detailDivider} />
              <View style={styles.detailRow}>
                <Ionicons name="home-outline" size={16} color="#6B7280" style={styles.detailRowIcon} />
                <View style={styles.detailRowContent}>
                  <Text style={styles.detailLabel}>Property</Text>
                  <Text style={styles.detailValue}>{lateEntryDetail.propertyName}</Text>
                </View>
              </View>
              <View style={styles.detailDivider} />
              <View style={styles.detailRow}>
                <Ionicons name="time-outline" size={16} color="#6B7280" style={styles.detailRowIcon} />
                <View style={styles.detailRowContent}>
                  <Text style={styles.detailLabel}>Requested Entry Time</Text>
                  <Text style={styles.detailValue}>{lateEntryDetail.entryTime}</Text>
                </View>
              </View>
              <View style={styles.detailDivider} />
              <View style={styles.detailRow}>
                <Ionicons name="chatbubble-outline" size={16} color="#6B7280" style={styles.detailRowIcon} />
                <View style={styles.detailRowContent}>
                  <Text style={styles.detailLabel}>Reason</Text>
                  <Text style={styles.detailValue}>{lateEntryDetail.reason}</Text>
                </View>
              </View>
              <View style={styles.detailDivider} />
              <View style={styles.detailRow}>
                <Ionicons name="call-outline" size={16} color="#6B7280" style={styles.detailRowIcon} />
                <View style={styles.detailRowContent}>
                  <Text style={styles.detailLabel}>Emergency Contact</Text>
                  <Text style={styles.detailValue}>{lateEntryDetail.emergencyContact}</Text>
                </View>
              </View>
            </View>
          </ScrollView>
        )}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F1F5F9",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: "#F1F5F9",
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0F172A",
    letterSpacing: -0.3,
  },
  unreadBadge: {
    backgroundColor: "#EF4444",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 5,
  },
  unreadBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fff",
  },
  headerSpacer: {
    width: 36,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 40,
  },
  emptyWrap: {
    alignItems: "center",
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    lineHeight: 20,
    color: "#94A3B8",
    textAlign: "center",
  },
  // Card
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    marginBottom: 10,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardUnread: {
    shadowOpacity: 0.09,
  },
  unreadAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
  },
  cardInner: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    paddingLeft: 18,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    flexShrink: 0,
  },
  cardContent: {
    flex: 1,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 3,
  },
  cardTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#475569",
  },
  cardTitleUnread: {
    color: "#0F172A",
    fontWeight: "700",
  },
  cardTime: {
    fontSize: 11,
    color: "#94A3B8",
    flexShrink: 0,
  },
  cardBody: {
    fontSize: 13,
    lineHeight: 18,
    color: "#64748B",
  },
  cardFooter: {
    marginTop: 8,
    flexDirection: "row",
  },
  viewChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: "#EDE9FE",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  viewChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#8B5CF6",
  },
  // Detail sheet
  detailLoading: {
    alignItems: "center",
    paddingVertical: 32,
  },
  detailErrorText: {
    fontSize: 14,
    color: "#9CA3AF",
  },
  detailContent: {
    paddingBottom: 16,
  },
  detailStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  detailStatusChip: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  detailStatusText: {
    fontSize: 13,
    fontWeight: "700",
  },
  detailDate: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  detailCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    paddingHorizontal: 16,
  },
  detailRow: {
    flexDirection: "row",
    paddingVertical: 14,
  },
  detailRowIcon: {
    marginTop: 2,
    marginRight: 12,
  },
  detailRowContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a1a",
    lineHeight: 20,
  },
  detailSub: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  detailDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#E2E8F0",
  },
});
