import React, { useCallback, useMemo, useRef, useState } from "react";
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
import { colors } from "../../constants/theme";

const TAB_BAR_CLEARANCE = 100;
const H_PAD = 20;

type ChatRow = {
  propertyId: string;
  propertyName: string;
  propertyCity: string | null;
  coverImageUrl: string | null;
  conversationId: string | null;
  lastMessageAt: number | null;
  lastMessageText: string | null;
  lastMessageTimeLabel: string | null;
  unreadCount: number;
};

type PeerChatRow = {
  conversationId: string;
  otherUserId: string;
  otherName: string;
  otherImageUrl: string | null;
  lastMessageAt: number | null;
  lastMessageText: string | null;
  lastMessageTimeLabel: string | null;
  unread: number;
};

export default function ChatsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const convex = useConvex();
  const [query, setQuery] = useState("");
  const [chats, setChats] = useState<ChatRow[] | null>(null);
  const [peerChats, setPeerChats] = useState<PeerChatRow[]>([]);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const data = await (convex as any).query("chats:listChatsForTenant", {});
      if (mountedRef.current) {
        setChats((prev) => {
          if (!Array.isArray(data)) return prev;
          if (data.length === 0 && prev !== null && prev.length > 0) return prev;
          return data as ChatRow[];
        });
      }
    } catch {
      // keep last known list on error
    }
  }, [convex]);

  const refreshPeer = useCallback(async () => {
    try {
      const data = await (convex as any).query("peerChats:listMyChats", {});
      if (mountedRef.current && Array.isArray(data)) setPeerChats(data as PeerChatRow[]);
    } catch {
      // keep existing
    }
  }, [convex]);

  useFocusEffect(
    useCallback(() => {
      mountedRef.current = true;
      void refresh();
      void refreshPeer();
      return () => {
        mountedRef.current = false;
      };
    }, [refresh, refreshPeer])
  );

  const loading = chats === null;

  const filtered = useMemo(() => {
    const list = chats ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (c) =>
        c.propertyName.toLowerCase().includes(q) ||
        (c.lastMessageText ?? "").toLowerCase().includes(q)
    );
  }, [chats, query]);

  const showEmpty = !loading && (chats ?? []).length === 0;

  return (
    <View style={[s.root, { paddingTop: insets.top + 8 }]}>

      {/* ── Header ── */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Messages</Text>
      </View>

      {/* ── Search ── */}
      <View style={s.searchWrap}>
        <Ionicons name="search-outline" size={16} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search by property or message…"
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
            Save properties on Discover to start chatting with hosts.
          </Text>
          <TouchableOpacity
            style={s.cta}
            activeOpacity={0.82}
            onPress={() => router.navigate("/(app)" as any)}
            accessibilityRole="button"
            accessibilityLabel="Go to Discover"
          >
            <Text style={s.ctaText}>Browse Discover</Text>
            <Ionicons name="arrow-forward" size={15} color={colors.white} />
          </TouchableOpacity>
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
              : `All messages · ${(chats ?? []).length}`}
          </Text>

          {/* List card */}
          <View style={s.listCard}>
            {filtered.length === 0 ? (
              <View style={s.noResults}>
                <Text style={s.noResultsText}>No matches for "{query.trim()}"</Text>
              </View>
            ) : (
              filtered.map((item) => (
                <TouchableOpacity
                  key={item.propertyId}
                  style={s.row}
                  activeOpacity={0.75}
                  onPress={() =>
                    router.push({
                      pathname: "/(app)/chats/[propertyId]",
                      params: { propertyId: item.propertyId, title: item.propertyName },
                    } as any)
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`Open chat with ${item.propertyName}`}
                >
                  {/* Avatar */}
                  <View style={s.avatarWrap}>
                    {item.coverImageUrl ? (
                      <Image
                        source={{ uri: item.coverImageUrl }}
                        style={s.avatar}
                        contentFit="cover"
                        transition={150}
                      />
                    ) : (
                      <View style={s.avatarFallback}>
                        <Text style={s.avatarInitial}>
                          {item.propertyName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    {item.unreadCount > 0 && <View style={s.onlineDot} />}
                  </View>

                  {/* Content */}
                  <View style={s.rowContent}>
                    <View style={s.rowTop}>
                      <Text style={s.rowName} numberOfLines={1}>
                        {item.propertyName}
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
                        {item.lastMessageText ?? "Tap to start chatting with the host."}
                      </Text>
                      {item.unreadCount > 0 && (
                        <View style={s.badge}>
                          <Text style={s.badgeText}>
                            {item.unreadCount > 9 ? "9+" : item.unreadCount}
                          </Text>
                        </View>
                      )}
                    </View>

                    {item.propertyCity ? (
                      <Text style={s.rowProperty} numberOfLines={1}>
                        <Ionicons name="location-outline" size={10} color={colors.muted} />
                        {"  "}{item.propertyCity}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>

          {/* Direct Messages (peer chats) */}
          {peerChats.length > 0 ? (
            <View style={{ marginTop: 20 }}>
              <Text style={s.sectionLabel}>Direct Messages · {peerChats.length}</Text>
              <View style={s.listCard}>
                {peerChats.map((p) => (
                  <TouchableOpacity
                    key={p.conversationId}
                    style={s.row}
                    activeOpacity={0.75}
                    onPress={() =>
                      router.push(
                        `/(app)/chats/peer/${p.conversationId}?otherName=${encodeURIComponent(p.otherName)}` as any,
                      )
                    }
                  >
                    <View style={s.avatarWrap}>
                      <View style={s.avatarFallback}>
                        <Ionicons name="person" size={22} color={colors.white} />
                      </View>
                      {p.unread > 0 ? <View style={s.onlineDot} /> : null}
                    </View>
                    <View style={s.rowContent}>
                      <View style={s.rowTop}>
                        <Text style={s.rowName} numberOfLines={1}>{p.otherName}</Text>
                        {p.lastMessageTimeLabel ? (
                          <Text style={s.rowTime}>{p.lastMessageTimeLabel}</Text>
                        ) : null}
                      </View>
                      <View style={s.rowMid}>
                        <Text
                          style={[s.rowPreview, p.unread > 0 && s.rowPreviewBold]}
                          numberOfLines={1}
                        >
                          {p.lastMessageText ?? "Tap to start chatting."}
                        </Text>
                        {p.unread > 0 ? (
                          <View style={s.badge}>
                            <Text style={s.badgeText}>{p.unread > 9 ? "9+" : p.unread}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}
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
    marginBottom: 24,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 999,
  },
  ctaText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.white,
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
