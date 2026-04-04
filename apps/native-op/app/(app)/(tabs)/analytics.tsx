import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useConvex } from "convex/react";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { colors } from "../../../constants/theme";

const TAB_BAR_CLEARANCE = 100;
const H_PAD = 20;

type ConversationRow = {
  _id: string;
  propertyId: string;
  propertyName: string;
  tenantName: string;
  tenantImageUrl: string | null;
  lastMessageAt: number | null;
  lastMessageText: string | null;
  lastMessageTimeLabel: string | null;
  unreadCount: number;
};

export default function ChatsTabScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const convex = useConvex();
  const [query, setQuery] = useState("");
  const [conversations, setConversations] = useState<ConversationRow[] | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await (convex as any).query("chats:listConversationsForOperator", {});
      if (Array.isArray(data)) {
        setConversations(data as ConversationRow[]);
      }
    } catch {
      // keep null (loading) state on transient failures
    }
  }, [convex]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const loading = conversations === null;

  const filtered = useMemo(() => {
    const list = conversations ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (c) =>
        c.tenantName.toLowerCase().includes(q) ||
        c.propertyName.toLowerCase().includes(q) ||
        (c.lastMessageText ?? "").toLowerCase().includes(q)
    );
  }, [conversations, query]);

  const showEmpty = !loading && (conversations ?? []).length === 0;

  return (
    <View style={[s.root, { paddingTop: insets.top + 8 }]}>

      {/* ── Header ── */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Chats</Text>
        <TouchableOpacity
          style={s.headerBtn}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="New message"
        >
          <Ionicons name="create-outline" size={20} color={colors.navy} />
        </TouchableOpacity>
      </View>

      {/* ── Search ── */}
      <View style={s.searchWrap}>
        <Ionicons name="search-outline" size={16} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search by name or property…"
          placeholderTextColor={colors.muted}
          style={s.searchInput}
          editable={!loading}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery("")} hitSlop={10}>
            <Ionicons name="close-circle" size={16} color={colors.muted} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Content ── */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : showEmpty ? (
        <View style={s.center}>
          <View style={s.emptyIcon}>
            <Ionicons name="chatbubble-ellipses-outline" size={40} color={colors.muted} />
          </View>
          <Text style={s.emptyTitle}>No conversations yet</Text>
          <Text style={s.emptySub}>
            Tenants who express interest in your properties will appear here.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={s.scroll}
          contentContainerStyle={{ paddingBottom: insets.bottom + TAB_BAR_CLEARANCE }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          {...(Platform.OS === "ios"
            ? { contentInsetAdjustmentBehavior: "never" as const }
            : {})}
        >
          {/* Section label */}
          <Text style={s.sectionLabel}>
            {query.trim()
              ? `${filtered.length} result${filtered.length !== 1 ? "s" : ""}`
              : `All messages · ${(conversations ?? []).length}`}
          </Text>

          {/* List card */}
          <View style={s.listCard}>
            {filtered.length === 0 ? (
              <View style={s.noResults}>
                <Text style={s.noResultsText}>No matches for "{query.trim()}"</Text>
              </View>
            ) : (
              filtered.map((item, index) => (
                <React.Fragment key={item._id}>
                  <TouchableOpacity
                    style={s.row}
                    activeOpacity={0.75}
                    onPress={() =>
                      router.push({
                        pathname: "/(app)/chats/[conversationId]",
                        params: {
                          conversationId: item._id,
                          tenantName: item.tenantName,
                          propertyName: item.propertyName,
                        },
                      } as any)
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`Chat with ${item.tenantName}`}
                  >
                    {/* Avatar */}
                    <View style={s.avatarWrap}>
                      {item.tenantImageUrl ? (
                        <Image
                          source={{ uri: item.tenantImageUrl }}
                          style={s.avatar}
                          contentFit="cover"
                          transition={150}
                        />
                      ) : (
                        <View style={s.avatarFallback}>
                          <Text style={s.avatarInitial}>
                            {item.tenantName.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      {item.unreadCount > 0 && <View style={s.onlineDot} />}
                    </View>

                    {/* Content */}
                    <View style={s.rowContent}>
                      <View style={s.rowTop}>
                        <Text style={s.rowName} numberOfLines={1}>
                          {item.tenantName}
                        </Text>
                        {item.lastMessageTimeLabel ? (
                          <Text style={s.rowTime}>{item.lastMessageTimeLabel}</Text>
                        ) : null}
                      </View>

                      <View style={s.rowMid}>
                        <Text
                          style={[s.rowPreview, item.unreadCount > 0 && s.rowPreviewBold]}
                          numberOfLines={1}
                        >
                          {item.lastMessageText ?? "No messages yet"}
                        </Text>
                        {item.unreadCount > 0 && (
                          <View style={s.badge}>
                            <Text style={s.badgeText}>
                              {item.unreadCount > 9 ? "9+" : item.unreadCount}
                            </Text>
                          </View>
                        )}
                      </View>

                      <Text style={s.rowProperty} numberOfLines={1}>
                        <Ionicons name="business-outline" size={10} color={colors.muted} />
                        {"  "}{item.propertyName}
                      </Text>
                    </View>
                  </TouchableOpacity>

                </React.Fragment>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.pageBg,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: H_PAD,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.navy,
    letterSpacing: -0.5,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },

  // Search
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: H_PAD,
    marginBottom: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    color: colors.navy,
    paddingVertical: 0,
  },

  // States
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingBottom: 60,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surfaceGray,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.navy,
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 14,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 20,
  },

  // Scroll
  scroll: { flex: 1 },

  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginHorizontal: H_PAD,
    marginBottom: 10,
  },

  // List card
  listCard: {
    marginHorizontal: H_PAD,
    gap: 10,
  },

  divider: {
    display: "none",
  },

  // Row
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },

  // Avatar
  avatarWrap: {
    position: "relative",
    width: 52,
    height: 52,
    flexShrink: 0,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontSize: 19,
    fontWeight: "700",
    color: colors.white,
  },
  onlineDot: {
    position: "absolute",
    bottom: 1,
    right: 1,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: "#22C55E",
    borderWidth: 2.5,
    borderColor: colors.cardBg,
  },

  // Row content
  rowContent: {
    flex: 1,
    minWidth: 0,
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 3,
    gap: 8,
  },
  rowName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: colors.navy,
  },
  rowTime: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.muted,
    flexShrink: 0,
  },
  rowMid: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 4,
  },
  rowPreview: {
    flex: 1,
    fontSize: 13,
    fontWeight: "400",
    color: colors.muted,
  },
  rowPreviewBold: {
    color: colors.navy,
    fontWeight: "600",
  },
  rowProperty: {
    fontSize: 11,
    fontWeight: "500",
    color: colors.muted,
    opacity: 0.8,
  },

  // Badge
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
    flexShrink: 0,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.white,
  },

  // No results
  noResults: {
    paddingVertical: 36,
    alignItems: "center",
  },
  noResultsText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.muted,
  },
});
