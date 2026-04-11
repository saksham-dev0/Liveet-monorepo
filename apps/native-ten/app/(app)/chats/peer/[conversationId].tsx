import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useConvex } from "convex/react";
import { colors, radii } from "../../../../constants/theme";

// ─── Constants ────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 1500;

// ─── Types ────────────────────────────────────────────────────────────────────

type Message = {
  _id: string;
  senderUserId: string;
  isMe: boolean;
  body: string;
  createdAt: number;
};

type ListItem =
  | { kind: "date"; id: string; label: string }
  | { kind: "msg"; id: string; isMe: boolean; body: string; time: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateLabel(ms: number): string {
  const date = new Date(ms);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PeerChatScreen() {
  const { conversationId, otherName } = useLocalSearchParams<{
    conversationId: string;
    otherName?: string;
  }>();
  const insets = useSafeAreaInsets();
  const convex = useConvex();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const flatRef = useRef<FlatList>(null);
  const mountedRef = useRef(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const data = await (convex as any).query("peerChats:listMessages", {
        conversationId,
      });
      if (mountedRef.current && Array.isArray(data)) setMessages(data);
    } catch {
      // keep existing
    }
  }, [convex, conversationId]);

  const markRead = useCallback(async () => {
    try {
      await (convex as any).mutation("peerChats:markRead", { conversationId });
    } catch {
      // non-critical
    }
  }, [convex, conversationId]);

  useEffect(() => {
    mountedRef.current = true;
    void fetchMessages();
    void markRead();
    pollRef.current = setInterval(() => {
      void fetchMessages();
    }, POLL_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchMessages, markRead]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: false }), 50);
    }
  }, [messages.length]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setText("");
    try {
      await (convex as any).mutation("peerChats:sendMessage", {
        conversationId,
        body,
      });
      await fetchMessages();
      await markRead();
    } catch {
      setText(body);
    } finally {
      setSending(false);
    }
  };

  // Build flat list with date separators
  const listItems: ListItem[] = [];
  let lastDateLabel = "";
  for (const m of messages) {
    const label = formatDateLabel(m.createdAt);
    if (label !== lastDateLabel) {
      listItems.push({ kind: "date", id: `date-${m._id}`, label });
      lastDateLabel = label;
    }
    listItems.push({
      kind: "msg",
      id: m._id,
      isMe: m.isMe,
      body: m.body,
      time: formatTime(m.createdAt),
    });
  }

  const displayName = otherName ? decodeURIComponent(otherName) : "Chat";

  return (
    <KeyboardAvoidingView
      style={[s.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <View style={s.headerAvatar}>
          <Ionicons name="person" size={18} color={colors.muted} />
        </View>
        <Text style={s.headerName} numberOfLines={1}>
          {displayName}
        </Text>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatRef}
        data={listItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.msgList}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          if (item.kind === "date") {
            return (
              <View style={s.dateSep}>
                <Text style={s.dateSepText}>{item.label}</Text>
              </View>
            );
          }
          return (
            <View style={[s.bubble, item.isMe ? s.bubbleMe : s.bubbleThem]}>
              <Text style={[s.bubbleText, item.isMe && s.bubbleTextMe]}>
                {item.body}
              </Text>
              <Text style={[s.bubbleTime, item.isMe && s.bubbleTimeMe]}>
                {item.time}
              </Text>
            </View>
          );
        }}
      />

      {/* Input bar */}
      <View style={[s.inputRow, { paddingBottom: insets.bottom + 8 }]}>
        <TextInput
          style={s.input}
          placeholder="Message…"
          placeholderTextColor={colors.muted}
          value={text}
          onChangeText={setText}
          multiline
          returnKeyType="default"
        />
        <Pressable
          style={[s.sendBtn, (!text.trim() || sending) && s.sendBtnDisabled]}
          onPress={send}
          disabled={!text.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Ionicons name="send" size={18} color={colors.white} />
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.muted + "30",
    backgroundColor: colors.white,
  },
  backBtn: { width: 36, alignItems: "flex-start" },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.muted + "20",
    alignItems: "center",
    justifyContent: "center",
  },
  headerName: { flex: 1, fontSize: 16, fontWeight: "700", color: colors.text },
  msgList: { padding: 16, gap: 6, flexGrow: 1 },
  dateSep: { alignItems: "center", marginVertical: 8 },
  dateSepText: { fontSize: 12, color: colors.muted, fontWeight: "500" },
  bubble: {
    maxWidth: "78%",
    borderRadius: radii.card,
    padding: 10,
    marginBottom: 4,
  },
  bubbleMe: {
    backgroundColor: colors.primary,
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    backgroundColor: colors.white,
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.muted + "30",
  },
  bubbleText: { fontSize: 15, color: colors.text, lineHeight: 21 },
  bubbleTextMe: { color: colors.white },
  bubbleTime: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 3,
    alignSelf: "flex-end",
  },
  bubbleTimeMe: { color: "rgba(255,255,255,0.7)" },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.muted + "30",
    backgroundColor: colors.white,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: colors.pageBg,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.muted + "40",
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.4 },
});
