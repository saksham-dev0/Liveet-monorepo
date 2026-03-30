import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useConvex } from "convex/react";
import { colors, radii } from "../../../constants/theme";

const POLL_INTERVAL_MS = 1500;

const OB_PREFIX = "__OB__:";

type OnboardingInvite = { pid: string; aid: string; pname: string };

function parseOnboardingInvite(body: string): OnboardingInvite | null {
  if (!body.startsWith(OB_PREFIX)) return null;
  try {
    return JSON.parse(body.slice(OB_PREFIX.length)) as OnboardingInvite;
  } catch {
    return null;
  }
}

type Message = {
  _id: string;
  senderRole: "tenant" | "operator";
  body: string;
  createdAt: number;
};

type ListItem =
  | { kind: "date"; id: string; label: string }
  | { kind: "msg"; id: string; from: "host" | "me"; body: string; time: string }
  | { kind: "onboarding"; id: string; invite: OnboardingInvite; time: string; createdAt: number };

const OB_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

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
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function DateSeparator({ label }: { label: string }) {
  return (
    <View style={ds.wrap}>
      <View style={ds.pill}>
        <Text style={ds.pillText}>{label}</Text>
      </View>
    </View>
  );
}

const ds = StyleSheet.create({
  wrap: { alignItems: "center", marginVertical: 16 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceGray,
  },
  pillText: { fontSize: 12, fontWeight: "600", color: colors.muted },
});

export default function ChatThreadScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const convex = useConvex();
  const params = useLocalSearchParams<{ propertyId: string; title?: string }>();
  const propertyId = typeof params.propertyId === "string" ? params.propertyId : "";
  const title =
    typeof params.title === "string" && params.title.length > 0
      ? params.title
      : "Property host";

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  // null = initial load not done yet, Message[] = loaded (may be empty)
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [kycStatus, setKycStatus] = useState<{ status: string | null } | null>(null);
  const listRef = useRef<FlatList<ListItem>>(null);
  const mountedRef = useRef(true);
  // Cursor: _creationTime of the last message received. Undefined triggers a
  // full fetch; after that only newer messages are requested on each poll.
  const afterTimeRef = useRef<number | undefined>(undefined);
  // Track the latest operator message ID already marked read to avoid
  // redundant markReadByProperty mutation calls on every poll tick.
  const lastMarkedReadOperatorMsgIdRef = useRef<string | null>(null);

  const fetchMessages = useCallback(async () => {
    if (!propertyId) return;
    const afterTime = afterTimeRef.current;
    try {
      const result = await (convex as any).query(
        "chats:listMessagesByProperty",
        { propertyId, afterTime }
      );
      if (!mountedRef.current || !Array.isArray(result)) return;

      if (afterTime === undefined) {
        // Initial full load — replace state entirely.
        setMessages(result as Message[]);
      } else if (result.length > 0) {
        // Incremental poll — append only the new messages (deduplicate to guard
        // against the race between the polling interval and post-send fetch).
        setMessages((prev) => {
          const existingIds = new Set((prev ?? []).map((m) => m._id));
          const newMsgs = (result as Message[]).filter((m) => !existingIds.has(m._id));
          return newMsgs.length > 0 ? [...(prev ?? []), ...newMsgs] : (prev ?? []);
        });
      }

      // Advance the cursor to the latest message we've now seen.
      if (result.length > 0) {
        afterTimeRef.current = (result as Message[])[result.length - 1].createdAt;
      }

      // Mark as read whenever new operator messages have arrived.
      const latestOperatorMsg = (result as Message[])
        .slice()
        .reverse()
        .find((m) => m.senderRole === "operator");
      if (
        latestOperatorMsg &&
        latestOperatorMsg._id !== lastMarkedReadOperatorMsgIdRef.current
      ) {
        lastMarkedReadOperatorMsgIdRef.current = latestOperatorMsg._id;
        (convex as any)
          .mutation("chats:markReadByProperty", { propertyId })
          .catch(() => {});
      }
    } catch {
      // keep last known messages on error
    }
  }, [convex, propertyId]);

  useEffect(() => {
    mountedRef.current = true;
    // Reset cursor so remounting the screen triggers a fresh full fetch.
    afterTimeRef.current = undefined;

    if (!propertyId) return;

    const fetchKycStatus = async () => {
      try {
        const res = await (convex as any).query("moveIn:getTenantMoveInForProperty", { propertyId });
        if (mountedRef.current && res) setKycStatus({ status: res.status ?? null });
      } catch {
        // ignore
      }
    };

    // Initial load
    void fetchMessages();
    void fetchKycStatus();

    // Poll for new messages; only messages newer than afterTimeRef are fetched
    // after the initial load, so cost stays constant regardless of history length.
    const interval = setInterval(() => {
      void fetchMessages();
      void fetchKycStatus();
    }, POLL_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [convex, propertyId, fetchMessages]);

  const listData = useMemo((): ListItem[] => {
    const msgs = messages ?? [];
    if (msgs.length === 0) return [];

    const items: ListItem[] = [];
    let lastDateStr = "";

    for (const msg of msgs) {
      const dateStr = new Date(msg.createdAt).toDateString();
      if (dateStr !== lastDateStr) {
        items.push({
          kind: "date",
          id: `date-${dateStr}`,
          label: formatDateLabel(msg.createdAt),
        });
        lastDateStr = dateStr;
      }
      const invite = parseOnboardingInvite(msg.body);
      if (invite) {
        items.push({ kind: "onboarding", id: msg._id, invite, time: formatTime(msg.createdAt), createdAt: msg.createdAt });
      } else {
        items.push({
          kind: "msg",
          id: msg._id,
          from: msg.senderRole === "tenant" ? "me" : "host",
          body: msg.body,
          time: formatTime(msg.createdAt),
        });
      }
    }
    return items;
  }, [messages]);

  // Scroll to end when new messages arrive
  useEffect(() => {
    if (listData.length > 0) {
      const t = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
      return () => clearTimeout(t);
    }
  }, [listData.length]);

  const send = async () => {
    const trimmed = input.trim();
    if (!trimmed || sending || !propertyId) return;
    setSending(true);
    setInput("");
    try {
      await (convex as any).mutation("chats:sendMessageByProperty", {
        propertyId,
        body: trimmed,
      });
      // Fetch immediately after send instead of waiting for the next poll tick
      await fetchMessages();
    } catch (e) {
      console.error("Failed to send message:", e);
      setInput(trimmed);
    } finally {
      setSending(false);
    }
  };

  const loading = messages === null;

  return (
    <View style={s.root}>
      <View style={[s.header, { paddingTop: insets.top + 6 }]}>
        <Pressable
          style={s.headerIconBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={22} color={colors.navy} />
        </Pressable>
        <Text style={s.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        <Pressable
          style={s.headerIconBtn}
          accessibilityRole="button"
          accessibilityLabel="More options"
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.navy} />
        </Pressable>
      </View>

      {loading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : listData.length === 0 ? (
        <View style={s.emptyWrap}>
          <Ionicons name="chatbubble-outline" size={44} color={colors.muted} />
          <Text style={s.emptyText}>No messages yet — say hello!</Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          style={s.list}
          data={listData}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.listContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          renderItem={({ item }) => {
            if (item.kind === "date") {
              return <DateSeparator label={item.label} />;
            }

            if (item.kind === "onboarding") {
              const isExpired = Date.now() - item.createdAt > OB_EXPIRY_MS;
              const isCompleted =
                kycStatus?.status === "submitted" || kycStatus?.status === "onboarded";
              const isDisabled = isExpired || isCompleted;

              return (
                <View style={s.obCardWrap}>
                  <View style={s.obCard}>
                    <View style={s.obIconRow}>
                      <View style={[s.obIconCircle, isDisabled && s.obIconCircleDim]}>
                        <Ionicons
                          name={isCompleted ? "checkmark-circle-outline" : "document-text-outline"}
                          size={22}
                          color={colors.white}
                        />
                      </View>
                      <View style={s.obCardTextWrap}>
                        <Text style={s.obCardTitle}>Complete your onboarding</Text>
                        <Text style={s.obCardSub} numberOfLines={1}>
                          {item.invite.pname}
                        </Text>
                      </View>
                    </View>
                    <Text style={s.obCardBody}>
                      Your landlord has reviewed your move-in request. Complete your
                      KYC and set up payment to confirm your stay.
                    </Text>
                    <Pressable
                      style={[s.obBtn, isDisabled && s.obBtnDisabled]}
                      disabled={isDisabled}
                      onPress={() =>
                        router.push({
                          pathname: "/(app)/kyc/[propertyId]",
                          params: {
                            propertyId: item.invite.pid,
                            applicationId: item.invite.aid,
                            title: item.invite.pname,
                          },
                        } as any)
                      }
                    >
                      {isCompleted ? (
                        <>
                          <Ionicons name="checkmark-circle" size={16} color={colors.white} style={{ marginRight: 6 }} />
                          <Text style={s.obBtnText}>KYC Completed</Text>
                        </>
                      ) : isExpired ? (
                        <>
                          <Ionicons name="lock-closed-outline" size={16} color={colors.white} style={{ marginRight: 6 }} />
                          <Text style={s.obBtnText}>Link Expired</Text>
                        </>
                      ) : (
                        <>
                          <Text style={s.obBtnText}>Start E-KYC & Payment</Text>
                          <Ionicons name="arrow-forward" size={16} color={colors.white} style={{ marginLeft: 6 }} />
                        </>
                      )}
                    </Pressable>
                    {isExpired && !isCompleted && (
                      <Text style={s.obExpiredNote}>This link was valid for 24 hours.</Text>
                    )}
                    <Text style={s.obTime}>{item.time}</Text>
                  </View>
                </View>
              );
            }

            const incoming = item.from === "host";
            return (
              <View style={[s.bubbleRow, incoming ? s.bubbleRowIn : s.bubbleRowOut]}>
                <View style={[s.bubble, incoming ? s.bubbleIn : s.bubbleOut]}>
                  <Text
                    style={[s.bubbleText, incoming ? s.bubbleTextIn : s.bubbleTextOut]}
                  >
                    {item.body}
                  </Text>
                </View>
                <View style={[s.metaRow, incoming ? s.metaIn : s.metaOut]}>
                  <Text style={s.metaTime}>{item.time}</Text>
                  {!incoming ? (
                    <Ionicons
                      name="checkmark-done"
                      size={14}
                      color={colors.muted}
                      style={{ marginLeft: 4 }}
                    />
                  ) : null}
                </View>
              </View>
            );
          }}
        />
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={[s.composerWrap, { paddingBottom: Math.max(insets.bottom, 6) }]}>
          <View style={s.quickRow}>
            <Pressable style={s.quickBtn} accessibilityLabel="Video call">
              <Ionicons name="videocam-outline" size={17} color={colors.navy} />
            </Pressable>
            <Pressable style={s.quickBtn} accessibilityLabel="Voice call">
              <Ionicons name="call-outline" size={17} color={colors.navy} />
            </Pressable>
            <Pressable style={s.quickBtn} accessibilityLabel="Voice message">
              <Ionicons name="mic-outline" size={17} color={colors.navy} />
            </Pressable>
          </View>

          <View style={s.inputRow}>
            <TextInput
              style={s.input}
              placeholder="Type a message..."
              placeholderTextColor="rgba(107,114,128,0.85)"
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={2000}
              returnKeyType="send"
              editable={!sending}
            />
            <Pressable
              style={[s.sendBtn, (!input.trim() || sending) && s.sendBtnDisabled]}
              onPress={send}
              disabled={!input.trim() || sending}
              accessibilityRole="button"
              accessibilityLabel="Send message"
            >
              {sending ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Ionicons name="send" size={17} color={colors.white} />
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 8,
    backgroundColor: colors.pageBg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.cardBg,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0A1929",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  headerTitle: {
    flex: 1,
    marginHorizontal: 10,
    fontSize: 17,
    fontWeight: "800",
    color: colors.navy,
    textAlign: "center",
  },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingBottom: 40,
  },
  emptyText: { fontSize: 15, fontWeight: "500", color: colors.muted },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  bubbleRow: { marginBottom: 14, maxWidth: "100%" },
  bubbleRowIn: { alignSelf: "flex-start", alignItems: "flex-start" },
  bubbleRowOut: { alignSelf: "flex-end", alignItems: "flex-end" },
  bubble: {
    maxWidth: "82%",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
  },
  bubbleIn: {
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  bubbleOut: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleText: { fontSize: 15, lineHeight: 21 },
  bubbleTextIn: { color: colors.navy, fontWeight: "500" },
  bubbleTextOut: { color: colors.white, fontWeight: "500" },
  metaRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  metaIn: { alignSelf: "flex-start", paddingLeft: 4 },
  metaOut: { alignSelf: "flex-end", paddingRight: 4 },
  metaTime: { fontSize: 11, fontWeight: "500", color: colors.muted },
  composerWrap: {
    paddingHorizontal: 12,
    paddingTop: 4,
    backgroundColor: colors.pageBg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  quickRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  quickBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.cardBg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.inputBg,
    borderRadius: radii.pill,
    paddingLeft: 12,
    paddingRight: 4,
    paddingVertical: 4,
    minHeight: 40,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
    color: colors.navy,
    maxHeight: 96,
    paddingVertical: Platform.OS === "ios" ? 6 : 4,
    lineHeight: 20,
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.35 },

  // Onboarding invite card
  obCardWrap: { paddingVertical: 6, alignItems: "flex-start" },
  obCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    maxWidth: "88%",
    shadowColor: "#0A1929",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  obIconRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  obIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  obCardTextWrap: { flex: 1 },
  obCardTitle: { fontSize: 14, fontWeight: "800", color: colors.navy },
  obCardSub: { fontSize: 12, color: colors.muted, fontWeight: "500", marginTop: 1 },
  obCardBody: {
    fontSize: 13,
    color: colors.muted,
    lineHeight: 19,
    marginBottom: 12,
  },
  obBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: 11,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  obBtnText: { fontSize: 13, fontWeight: "700", color: colors.white },
  obBtnDisabled: { backgroundColor: colors.muted, opacity: 0.6 },
  obIconCircleDim: { backgroundColor: colors.muted },
  obExpiredNote: { fontSize: 11, color: colors.error, marginBottom: 4, marginTop: -4 },
  obTime: { fontSize: 11, color: colors.muted, textAlign: "right" },
});
