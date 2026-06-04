import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ScrollView,
  TextInput,
  Modal,
  Pressable,
  SectionList,
  ActivityIndicator,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useConvex, useConvexAuth } from "convex/react";
import { useFocusEffect } from "expo-router";

// ─── Design tokens ────────────────────────────────────────────
const C = {
  navy: "#1E293B",
  muted: "#6B7280",
  border: "#E2E8F0",
  white: "#FFFFFF",
  error: "#DC2626",
  pageBg: "#EEF2F6",
  surfaceGray: "#F1F5F9",
  accent: "#D4F542",
  accentText: "#1A1A1A",
  positive: "#16A34A",
  subtle: "#94A3B8",
};

// ─── Types ────────────────────────────────────────────────────
type Priority = "High" | "Med" | "Low";
type TaskStatus = "todo" | "doing" | "done";
type Bucket = "overdue" | "today" | "week" | "later";
type FilterKey = "all" | "todo" | "doing" | "overdue" | "done";

interface Subtask {
  t: string;
  done: boolean;
}

interface Task {
  _id: string;
  title: string;
  kind: string;
  priority: Priority;
  status: TaskStatus;
  bucket: Bucket;
  due?: string;
  linkedType?: string;
  linkedLabel?: string;
  linkedSub?: string;
  assigneeName?: string;
  assigneeRole?: string;
  desc?: string;
  subtasks?: Subtask[];
  createdAt: number;
}

// ─── Taxonomies ───────────────────────────────────────────────
const PRIORITY_MAP: Record<Priority, { label: string; fg: string; bg: string; dot: string }> = {
  High: { label: "High", fg: "#991B1B", bg: "#FEE2E2", dot: "#DC2626" },
  Med:  { label: "Med",  fg: "#92400E", bg: "#FEF3C7", dot: "#D97706" },
  Low:  { label: "Low",  fg: "#475569", bg: "#F1F5F9", dot: "#94A3B8" },
};

const KIND_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  plumbing:   "water-outline",
  electrical: "flash-outline",
  appliance:  "settings-outline",
  internet:   "wifi-outline",
  cleaning:   "sparkles-outline",
  agreement:  "document-text-outline",
  reminder:   "mail-outline",
  payment:    "cash-outline",
  inspection: "shield-checkmark-outline",
  movein:     "key-outline",
  pest:       "bug-outline",
};

const KIND_LABEL: Record<string, string> = {
  plumbing:   "Plumbing",
  electrical: "Electrical",
  appliance:  "Appliance",
  internet:   "Internet",
  cleaning:   "Cleaning",
  agreement:  "Agreement",
  reminder:   "Reminder",
  payment:    "Payment",
  inspection: "Inspection",
  movein:     "Move-in",
  pest:       "Pest control",
};

const BUCKETS = [
  { key: "overdue" as Bucket, label: "Overdue",    tint: "#DC2626" },
  { key: "today"   as Bucket, label: "Today",      tint: C.navy },
  { key: "week"    as Bucket, label: "This week",  tint: C.navy },
  { key: "later"   as Bucket, label: "Later",      tint: "#94A3B8" },
];

// ─── Mock data ────────────────────────────────────────────────

// ─── Atoms ────────────────────────────────────────────────────
function PriorityPill({ priority }: { priority: Priority }) {
  const p = PRIORITY_MAP[priority];
  return (
    <View style={[styles.pill, { backgroundColor: p.bg }]}>
      <View style={[styles.pillDot, { backgroundColor: p.dot }]} />
      <Text style={[styles.pillText, { color: p.fg }]}>{p.label}</Text>
    </View>
  );
}

function KindIcon({ kind, accent = false, size = 38 }: { kind: string; accent?: boolean; size?: number }) {
  const icon = KIND_ICON[kind] ?? "document-outline";
  return (
    <View style={[
      styles.kindIcon,
      { width: size, height: size, borderRadius: 11, backgroundColor: accent ? C.navy : C.surfaceGray },
    ]}>
      <Ionicons name={icon} size={size * 0.44} color={accent ? C.accent : C.navy} />
    </View>
  );
}

function CheckCircle({ done, doing, onToggle }: { done: boolean; doing: boolean; onToggle: () => void }) {
  return (
    <TouchableOpacity
      onPress={onToggle}
      style={[
        styles.checkCircle,
        done
          ? { backgroundColor: C.navy, borderWidth: 0 }
          : { borderColor: doing ? C.navy : "#CBD5E1" },
      ]}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      {done && <Ionicons name="checkmark" size={14} color={C.accent} />}
      {!done && doing && <View style={styles.doingDot} />}
    </TouchableOpacity>
  );
}

// ─── Task card ────────────────────────────────────────────────
const TaskCard = memo(function TaskCard({
  task,
  onOpen,
  onToggle,
}: {
  task: Task;
  onOpen: (t: Task) => void;
  onToggle: (id: string) => void;
}) {
  const done = task.status === "done";
  const isOverdue = task.bucket === "overdue" && !done;

  const handleToggle = useCallback(() => onToggle(task._id), [task._id, onToggle]);
  const handleOpen = useCallback(() => onOpen(task), [task, onOpen]);

  return (
    <View style={[
      styles.card,
      isOverdue && { borderColor: "#FECACA" },
      done && { opacity: 0.62 },
    ]}>
      <CheckCircle done={done} doing={task.status === "doing"} onToggle={handleToggle} />
      <TouchableOpacity style={styles.cardBody} onPress={handleOpen} activeOpacity={0.7}>
        <KindIcon kind={task.kind} size={38} accent={isOverdue} />
        <View style={styles.cardText}>
          <Text
            style={[styles.cardTitle, done && styles.cardTitleDone]}
            numberOfLines={1}
          >
            {task.title}
          </Text>
          <Text style={styles.cardSub} numberOfLines={1}>
            {task.linkedLabel ?? ""}
            {task.due ? ` · ` : ""}
            <Text style={{ color: isOverdue ? C.error : C.muted, fontWeight: isOverdue ? "700" : "500" }}>
              {task.due ?? ""}
            </Text>
          </Text>
        </View>
        <View style={styles.cardRight}>
          {done ? (
            <View style={styles.doneLabel}>
              <Ionicons name="checkmark" size={11} color={C.positive} />
              <Text style={styles.doneLabelText}>Done</Text>
            </View>
          ) : (
            <PriorityPill priority={task.priority} />
          )}
          {task.status === "doing" && !done && (
            <Text style={styles.inProgressLabel}>IN PROGRESS</Text>
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
});

// ─── Section header ───────────────────────────────────────────
function SectionHeader({ label, count, tint }: { label: string; count: number; tint: string }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={[styles.sectionDot, { backgroundColor: tint }]} />
      <Text style={styles.sectionLabel}>{label.toUpperCase()}</Text>
      <View style={styles.sectionLine} />
      <Text style={styles.sectionCount}>{count}</Text>
    </View>
  );
}

// ─── Stats strip ──────────────────────────────────────────────
function StatsStrip({ tasks }: { tasks: Task[] }) {
  const open = tasks.filter((t) => t.status !== "done").length;
  const today = tasks.filter((t) => t.bucket === "today" && t.status !== "done").length;
  const overdue = tasks.filter((t) => t.bucket === "overdue" && t.status !== "done").length;
  const done = tasks.filter((t) => t.status === "done").length;

  const stats = [
    { label: "Open",    val: open,    sub: "tasks",   tint: C.navy },
    { label: "Today",   val: today,   sub: "due",     tint: "#0F766E" },
    { label: "Overdue", val: overdue, sub: "tasks",   tint: "#991B1B" },
    { label: "Done",    val: done,    sub: "this wk", tint: "#15803D" },
  ];

  return (
    <View style={styles.statsRow}>
      {stats.map((s) => (
        <View key={s.label} style={styles.statCard}>
          <View style={[styles.statBar, { backgroundColor: s.tint }]} />
          <Text style={styles.statLabel}>{s.label.toUpperCase()}</Text>
          <Text style={styles.statVal}>{s.val}</Text>
          <Text style={styles.statSub}>{s.sub}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Filter chips ─────────────────────────────────────────────
function FilterChips({
  value,
  onChange,
  counts,
}: {
  value: FilterKey;
  onChange: (k: FilterKey) => void;
  counts: Record<FilterKey, number>;
}) {
  const tabs: { key: FilterKey; label: string }[] = [
    { key: "all",     label: "All" },
    { key: "todo",    label: "To do" },
    { key: "doing",   label: "In progress" },
    { key: "overdue", label: "Overdue" },
    { key: "done",    label: "Done" },
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0, marginBottom: 14 }}
      contentContainerStyle={{ paddingLeft: 20, paddingRight: 20, alignItems: "center" }}
    >
      {tabs.map((tab, i) => {
        const active = value === tab.key;
        const isOverdue = tab.key === "overdue";
        const cnt = counts[tab.key];
        const badgeBg = active
          ? "rgba(212,245,66,0.2)"
          : isOverdue && cnt > 0 ? "#FEE2E2" : C.surfaceGray;
        const badgeColor = active
          ? C.accent
          : isOverdue && cnt > 0 ? "#991B1B" : C.muted;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.chip,
              active && styles.chipActive,
              i < tabs.length - 1 && { marginRight: 6 },
            ]}
            onPress={() => onChange(tab.key)}
            activeOpacity={0.75}
          >
            <Text style={[styles.chipText, active && { color: C.white }]}>{tab.label}</Text>
            <View style={[styles.chipBadge, { backgroundColor: badgeBg }]}>
              <Text style={[styles.chipBadgeText, { color: badgeColor }]}>{cnt}</Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// ─── Detail sheet ─────────────────────────────────────────────
function DetailSheet({
  task,
  onClose,
  onToggleStatus,
}: {
  task: Task;
  onClose: () => void;
  onToggleStatus: (id: string) => void;
}) {
  const [subs, setSubs] = useState<Subtask[]>(() => (task.subtasks ?? []).map((s) => ({ ...s })));
  const done = task.status === "done";
  const isOverdue = task.bucket === "overdue" && !done;
  const subsDone = subs.filter((s) => s.done).length;
  const isTenant = task.linkedType === "tenant";
  const createdDate = new Date(task.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  const toggleSub = useCallback((i: number) => {
    setSubs((xs) => xs.map((s, j) => j === i ? { ...s, done: !s.done } : s));
  }, []);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetOverlay} onPress={onClose} />
      <View style={styles.sheet}>
        {/* drag handle */}
        <View style={styles.sheetHandle} />

        {/* header */}
        <View style={styles.sheetHeader}>
          <KindIcon kind={task.kind} size={48} accent />
          <View style={styles.sheetHeaderText}>
            <Text style={styles.sheetTitle} numberOfLines={2}>{task.title}</Text>
            <View style={styles.sheetMeta}>
              <Text style={styles.sheetKind}>{KIND_LABEL[task.kind] ?? "Task"}</Text>
              <Text style={styles.sheetMetaDot}>·</Text>
              <PriorityPill priority={task.priority} />
            </View>
          </View>
          <TouchableOpacity style={styles.sheetClose} onPress={onClose}>
            <Ionicons name="close" size={16} color={C.navy} />
          </TouchableOpacity>
        </View>

        {/* quick actions */}
        <View style={styles.quickActions}>
          {[
            { icon: "calendar-outline" as keyof typeof Ionicons.glyphMap, label: "Snooze" },
            { icon: "person-outline" as keyof typeof Ionicons.glyphMap, label: "Reassign" },
            { icon: "chatbubble-outline" as keyof typeof Ionicons.glyphMap, label: "Message" },
          ].map((a) => (
            <TouchableOpacity key={a.label} style={styles.quickAction}>
              <Ionicons name={a.icon} size={16} color={C.navy} />
              <Text style={styles.quickActionLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[styles.quickAction, { backgroundColor: C.accent }]}>
            <Ionicons name="checkmark" size={16} color={C.accentText} />
            <Text style={[styles.quickActionLabel, { color: C.accentText }]}>
              {done ? "Reopen" : "Complete"}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetScrollContent} showsVerticalScrollIndicator={false}>
          {/* status banner */}
          <View style={styles.statusBanner}>
            <View>
              <Text style={styles.bannerCaption}>{done ? "STATUS" : "DUE"}</Text>
              <Text style={[
                styles.bannerValue,
                { color: done ? C.accent : isOverdue ? "#FCA5A5" : C.white },
              ]}>
                {done ? "Completed" : task.due}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.bannerCaption}>STATUS</Text>
              <Text style={styles.bannerStatus}>
                {done ? "Done" : task.status === "doing" ? "In progress" : "To do"}
              </Text>
            </View>
          </View>

          {/* checklist */}
          {subs.length > 0 && (
            <View style={styles.block}>
              <View style={styles.blockHeader}>
                <Text style={styles.blockTitle}>CHECKLIST</Text>
                <Text style={styles.blockCount}>{subsDone}/{subs.length}</Text>
              </View>
              {subs.map((s, i) => (
                <View key={i} style={[styles.subRow, i === subs.length - 1 && { borderBottomWidth: 0 }]}>
                  <CheckCircle done={s.done} doing={false} onToggle={() => toggleSub(i)} />
                  <Text style={[
                    styles.subText,
                    s.done && { color: C.subtle, textDecorationLine: "line-through" },
                  ]}>{s.t}</Text>
                </View>
              ))}
            </View>
          )}

          {/* details */}
          <View style={styles.block}>
            <View style={styles.blockHeader}>
              <View style={styles.blockIconWrap}>
                <Ionicons name="document-text-outline" size={14} color={C.navy} />
              </View>
              <Text style={styles.blockTitle}>DETAILS</Text>
            </View>
            <Text style={styles.detailsText}>{task.desc ?? ""}</Text>
          </View>

          {/* linked */}
          <View style={styles.block}>
            <View style={styles.blockHeader}>
              <View style={styles.blockIconWrap}>
                <Ionicons
                  name={isTenant ? "person-outline" : task.linkedType === "unit" ? "bed-outline" : "home-outline"}
                  size={14}
                  color={C.navy}
                />
              </View>
              <Text style={styles.blockTitle}>
                {isTenant ? "TENANT" : task.linkedType === "unit" ? "UNIT" : "LOCATION"}
              </Text>
            </View>
            <View style={styles.linkedRow}>
              <View style={styles.linkedAvatar}>
                {isTenant ? (
                  <Text style={styles.linkedAvatarText}>
                    {(task.linkedLabel ?? "").split(" ").slice(0, 2).map((w: string) => w[0]).join("")}
                  </Text>
                ) : (
                  <Ionicons
                    name={task.linkedType === "unit" ? "bed-outline" : "home-outline"}
                    size={18}
                    color={C.navy}
                  />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.linkedLabel}>{task.linkedLabel ?? ""}</Text>
                <Text style={styles.linkedSub}>{task.linkedSub ?? ""}</Text>
              </View>
              {isTenant && (
                <TouchableOpacity style={styles.callBtn}>
                  <Ionicons name="call-outline" size={15} color={C.navy} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* assignment */}
          <View style={styles.block}>
            <View style={styles.blockHeader}>
              <View style={styles.blockIconWrap}>
                <Ionicons name="person-outline" size={14} color={C.navy} />
              </View>
              <Text style={styles.blockTitle}>ASSIGNMENT</Text>
            </View>
            <InfoRow label="Assigned to" value={task.assigneeName ?? "—"} />
            <InfoRow label="Role" value={task.assigneeRole ?? "—"} />
            <InfoRow label="Created" value={createdDate} last />
          </View>
        </ScrollView>

        {/* CTA */}
        <View style={styles.sheetCTA}>
          <TouchableOpacity
            style={[
              styles.ctaBtn,
              done
                ? { backgroundColor: C.white, borderWidth: 1, borderColor: C.border }
                : { backgroundColor: C.accent },
            ]}
            onPress={() => { onToggleStatus(task._id); onClose(); }}
          >
            <Ionicons name="checkmark" size={18} color={done ? C.navy : C.accentText} />
            <Text style={[styles.ctaBtnText, { color: done ? C.navy : C.accentText }]}>
              {done ? "Reopen task" : "Mark complete"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function InfoRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.infoRow, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

// ─── Booking request card ─────────────────────────────────────
type BookingRequest = {
  _id: string;
  propertyName: string;
  propertyCity: string | null;
  studentName: string;
  studentPhone: string;
  studentEmail: string | null;
  course: string | null;
  yearOfStudy: string | null;
  parentName: string | null;
  parentPhone: string | null;
  moveInDate: string;
  foodPreference: string | null;
  paymentProofUrl: string | null;
  roomTypePreference: string | null;
  status: "pending" | "accepted" | "rejected";
  createdAt: number;
};

// ─── Booking detail sheet ─────────────────────────────────────
function BookingDetailSheet({
  booking,
  onClose,
  onAccept,
  onReject,
}: {
  booking: BookingRequest;
  onClose: () => void;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const isPending = booking.status === "pending";
  const isAccepted = booking.status === "accepted";
  const submittedDate = new Date(booking.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetOverlay} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />

        {/* header */}
        <View style={styles.sheetHeader}>
          <View style={[styles.bookingIconWrap, { width: 48, height: 48, borderRadius: 14 }]}>
            <Ionicons name="person-add-outline" size={22} color="#7C3AED" />
          </View>
          <View style={styles.sheetHeaderText}>
            <Text style={styles.sheetTitle} numberOfLines={1}>{booking.studentName}</Text>
            <Text style={styles.sheetKind}>{booking.propertyName}{booking.propertyCity ? `, ${booking.propertyCity}` : ""}</Text>
          </View>
          <View style={[
            styles.bookingBadge,
            isPending ? { backgroundColor: "#FEF3C7" } : isAccepted ? { backgroundColor: "#D1FAE5" } : { backgroundColor: "#FEE2E2" },
          ]}>
            <Text style={[
              styles.bookingBadgeText,
              isPending ? { color: "#92400E" } : isAccepted ? { color: "#065F46" } : { color: "#991B1B" },
            ]}>
              {isPending ? "Pending" : isAccepted ? "Accepted" : "Rejected"}
            </Text>
          </View>
          <TouchableOpacity style={styles.sheetClose} onPress={onClose}>
            <Ionicons name="close" size={16} color={C.navy} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetScrollContent} showsVerticalScrollIndicator={false}>
          {/* status banner */}
          <View style={styles.statusBanner}>
            <View>
              <Text style={styles.bannerCaption}>MOVE-IN DATE</Text>
              <Text style={[styles.bannerValue, { color: C.accent }]}>{booking.moveInDate}</Text>
              {booking.roomTypePreference ? (
                <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", fontWeight: "600", marginTop: 4 }}>
                  {booking.roomTypePreference}
                </Text>
              ) : null}
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.bannerCaption}>SUBMITTED</Text>
              <Text style={[styles.bannerStatus, { fontSize: 13, marginTop: 4 }]}>{submittedDate}</Text>
            </View>
          </View>

          {/* student info */}
          <View style={styles.block}>
            <View style={styles.blockHeader}>
              <View style={styles.blockIconWrap}>
                <Ionicons name="person-outline" size={14} color={C.navy} />
              </View>
              <Text style={styles.blockTitle}>STUDENT INFO</Text>
            </View>
            <InfoRow label="Name" value={booking.studentName} />
            <InfoRow label="Phone" value={booking.studentPhone} />
            {booking.studentEmail ? <InfoRow label="Email" value={booking.studentEmail} /> : null}
            {booking.course ? <InfoRow label="Course" value={booking.course} /> : null}
            {booking.yearOfStudy ? <InfoRow label="Year of study" value={booking.yearOfStudy} last={!booking.roomTypePreference && !booking.foodPreference && !booking.parentName} /> : null}
            {booking.roomTypePreference ? <InfoRow label="Room type" value={booking.roomTypePreference} last={!booking.foodPreference && !booking.parentName} /> : null}
            {booking.foodPreference ? <InfoRow label="Food preference" value={booking.foodPreference} last={!booking.parentName} /> : null}
          </View>

          {/* payment proof */}
          <View style={styles.block}>
            <View style={styles.blockHeader}>
              <View style={styles.blockIconWrap}>
                <Ionicons name="cash-outline" size={14} color={C.navy} />
              </View>
              <Text style={styles.blockTitle}>PAYMENT PROOF</Text>
            </View>
            {booking.paymentProofUrl ? (
              <Image
                source={{ uri: booking.paymentProofUrl }}
                style={styles.paymentProofImage}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.paymentProofEmpty}>
                <Ionicons name="image-outline" size={22} color={C.subtle} />
                <Text style={styles.paymentProofEmptyText}>No proof uploaded</Text>
              </View>
            )}
          </View>

          {/* parent / guardian */}
          {(booking.parentName || booking.parentPhone) && (
            <View style={styles.block}>
              <View style={styles.blockHeader}>
                <View style={styles.blockIconWrap}>
                  <Ionicons name="people-outline" size={14} color={C.navy} />
                </View>
                <Text style={styles.blockTitle}>PARENT / GUARDIAN</Text>
              </View>
              {booking.parentName ? <InfoRow label="Name" value={booking.parentName} /> : null}
              {booking.parentPhone ? <InfoRow label="Phone" value={booking.parentPhone} last /> : null}
            </View>
          )}
        </ScrollView>

        {isPending && (
          <View style={[styles.sheetCTA, { flexDirection: "row", gap: 10 }]}>
            <TouchableOpacity
              style={[styles.ctaBtn, { flex: 1, backgroundColor: C.white, borderWidth: 1, borderColor: "#FECACA" }]}
              onPress={() => { onReject(booking._id); onClose(); }}
            >
              <Ionicons name="close-outline" size={18} color="#DC2626" />
              <Text style={[styles.ctaBtnText, { color: "#DC2626" }]}>Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.ctaBtn, { flex: 1, backgroundColor: C.navy }]}
              onPress={() => { onAccept(booking._id); onClose(); }}
            >
              <Ionicons name="checkmark" size={18} color={C.accent} />
              <Text style={[styles.ctaBtnText, { color: C.accent }]}>Accept</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

function BookingRequestCard({
  booking,
  onAccept,
  onReject,
  onOpen,
}: {
  booking: BookingRequest;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onOpen: (b: BookingRequest) => void;
}) {
  const isPending = booking.status === "pending";
  const isAccepted = booking.status === "accepted";

  return (
    <TouchableOpacity style={styles.bookingCard} activeOpacity={0.8} onPress={() => onOpen(booking)}>
      <View style={styles.bookingCardHeader}>
        <View style={styles.bookingIconWrap}>
          <Ionicons name="person-add-outline" size={18} color={C.navy} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.bookingName} numberOfLines={1}>{booking.studentName}</Text>
          <Text style={styles.bookingProp} numberOfLines={1}>{booking.propertyName}{booking.propertyCity ? `, ${booking.propertyCity}` : ""}</Text>
        </View>
        <View style={[
          styles.bookingBadge,
          isPending
            ? { backgroundColor: "#FEF3C7" }
            : isAccepted
            ? { backgroundColor: "#D1FAE5" }
            : { backgroundColor: "#FEE2E2" },
        ]}>
          <Text style={[
            styles.bookingBadgeText,
            isPending
              ? { color: "#92400E" }
              : isAccepted
              ? { color: "#065F46" }
              : { color: "#991B1B" },
          ]}>
            {isPending ? "Pending" : isAccepted ? "Accepted" : "Rejected"}
          </Text>
        </View>
      </View>

      <View style={styles.bookingDetails}>
        <View style={styles.bookingDetailRow}>
          <Ionicons name="calendar-outline" size={13} color={C.muted} />
          <Text style={styles.bookingDetailText}>Move-in: {booking.moveInDate}</Text>
        </View>
        <View style={styles.bookingDetailRow}>
          <Ionicons name="call-outline" size={13} color={C.muted} />
          <Text style={styles.bookingDetailText}>{booking.studentPhone}</Text>
        </View>
        {booking.course && (
          <View style={styles.bookingDetailRow}>
            <Ionicons name="school-outline" size={13} color={C.muted} />
            <Text style={styles.bookingDetailText}>{booking.course}{booking.yearOfStudy ? ` · Year ${booking.yearOfStudy}` : ""}</Text>
          </View>
        )}
      </View>

      {isPending && (
        <View style={styles.bookingActions}>
          <TouchableOpacity
            style={[styles.bookingBtn, styles.bookingBtnReject]}
            onPress={(e) => { e.stopPropagation?.(); onReject(booking._id); }}
            activeOpacity={0.8}
          >
            <Ionicons name="close-outline" size={15} color="#DC2626" />
            <Text style={[styles.bookingBtnText, { color: "#DC2626" }]}>Reject</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.bookingBtn, styles.bookingBtnAccept]}
            onPress={(e) => { e.stopPropagation?.(); onAccept(booking._id); }}
            activeOpacity={0.8}
          >
            <Ionicons name="checkmark-outline" size={15} color={C.accentText} />
            <Text style={[styles.bookingBtnText, { color: C.accentText }]}>Accept</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Empty state ──────────────────────────────────────────────
function EmptyState() {
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIcon}>
        <Ionicons name="checkmark-circle-outline" size={26} color={C.navy} />
      </View>
      <Text style={styles.emptyTitle}>All caught up</Text>
      <Text style={styles.emptyText}>
        No tasks here. Try a different filter or create a new task.
      </Text>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────
export default function TasksScreen() {
  const insets = useSafeAreaInsets();
  const convex = useConvex();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [bookingRequests, setBookingRequests] = useState<BookingRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<BookingRequest | null>(null);

  const convexRef = useRef(convex);
  convexRef.current = convex;
  const pendingLoad = useRef(false);

  const loadTasks = useCallback(async () => {
    setIsLoading(true);
    try {
      const [data, bookings] = await Promise.all([
        (convexRef.current as any).query("tasks:list", {}),
        (convexRef.current as any).query("properties:getBookingRequestsForOperator", {}),
      ]);
      setTasks(data ?? []);
      setBookingRequests(bookings ?? []);
    } catch {
      setTasks([]);
      setBookingRequests([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Mark that a load is needed when screen gains focus
  useFocusEffect(useCallback(() => {
    pendingLoad.current = true;
  }, []));

  // Execute the load only once auth is ready
  useEffect(() => {
    if (!authLoading && isAuthenticated && pendingLoad.current) {
      pendingLoad.current = false;
      loadTasks();
    }
  });

  const handleAcceptBooking = useCallback(async (id: string) => {
    setBookingRequests((xs) => xs.map((b) => b._id === id ? { ...b, status: "accepted" as const } : b));
    try {
      await (convex as any).mutation("properties:updateBookingRequestStatus", { bookingId: id, status: "accepted" });
    } catch {
      loadTasks();
    }
  }, [convex, loadTasks]);

  const handleRejectBooking = useCallback(async (id: string) => {
    setBookingRequests((xs) => xs.map((b) => b._id === id ? { ...b, status: "rejected" as const } : b));
    try {
      await (convex as any).mutation("properties:updateBookingRequestStatus", { bookingId: id, status: "rejected" });
    } catch {
      loadTasks();
    }
  }, [convex, loadTasks]);

  const toggleStatus = useCallback(async (id: string) => {
    const task = tasks.find((t) => t._id === id);
    if (!task) return;
    const next = task.status === "done" ? "todo" : "done";
    setTasks((xs) => xs.map((t) => t._id === id ? { ...t, status: next } : t));
    try {
      await (convex as any).mutation("tasks:updateStatus", { id, status: next });
    } catch {
      loadTasks();
    }
  }, [tasks, convex, loadTasks]);

  const counts = useMemo<Record<FilterKey, number>>(() => ({
    all:     tasks.length,
    todo:    tasks.filter((t) => t.status === "todo").length,
    doing:   tasks.filter((t) => t.status === "doing").length,
    overdue: tasks.filter((t) => t.bucket === "overdue" && t.status !== "done").length,
    done:    tasks.filter((t) => t.status === "done").length,
  }), [tasks]);

  const filtered = useMemo(() => {
    let xs = tasks;
    if (filter === "overdue") xs = xs.filter((t) => t.bucket === "overdue" && t.status !== "done");
    else if (filter === "done") xs = xs.filter((t) => t.status === "done");
    else if (filter !== "all") xs = xs.filter((t) => t.status === filter);
    if (search) {
      const q = search.toLowerCase();
      xs = xs.filter((t) =>
        t.title.toLowerCase().includes(q) ||
        (t.linkedLabel ?? "").toLowerCase().includes(q) ||
        (t.linkedSub ?? "").toLowerCase().includes(q)
      );
    }
    return xs;
  }, [tasks, filter, search]);

  // Build sections for "all" view
  const sections = useMemo(() => {
    if (filter !== "all") return null;
    const open = filtered.filter((t) => t.status !== "done");
    const result = BUCKETS
      .map((b) => ({ ...b, data: open.filter((t) => t.bucket === b.key) }))
      .filter((g) => g.data.length > 0);
    const doneItems = filtered.filter((t) => t.status === "done");
    if (doneItems.length) result.push({ key: "done" as Bucket, label: "Completed", tint: "#15803D", data: doneItems });
    return result;
  }, [filtered, filter]);

  const renderCard = useCallback((task: Task) => (
    <TaskCard key={task._id} task={task} onOpen={setSelectedTask} onToggle={toggleStatus} />
  ), [toggleStatus]);

  // Sync selected task with latest state
  const currentSelected = useMemo(
    () => selectedTask ? tasks.find((t) => t._id === selectedTask._id) ?? null : null,
    [selectedTask, tasks]
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.propertyLabel}>SUNRISE RESIDENCY</Text>
          <Text style={styles.pageTitle}>Tasks</Text>
        </View>
        <View style={styles.topActions}>
          <TouchableOpacity
            style={[styles.iconBtn, searchOpen && { backgroundColor: C.navy, borderColor: C.navy }]}
            onPress={() => { setSearchOpen((x) => !x); if (searchOpen) setSearch(""); }}
          >
            <Ionicons name="search-outline" size={16} color={searchOpen ? C.accent : C.navy} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn}>
            <Ionicons name="filter-outline" size={16} color={C.navy} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search bar */}
      {searchOpen && (
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={15} color={C.muted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search tasks, unit, tenant"
            placeholderTextColor={C.muted}
            autoFocus
          />
        </View>
      )}

      {/* Stats */}
      <StatsStrip tasks={tasks} />

      {/* Filter chips */}
      <FilterChips value={filter} onChange={setFilter} counts={counts} />

      {/* Content */}
      {isLoading ? (
        <View style={styles.emptyWrap}>
          <ActivityIndicator size="large" color={C.navy} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          nestedScrollEnabled
        >
          {/* Booking requests section */}
          {bookingRequests.length > 0 && (
            <View style={{ marginBottom: 4 }}>
              <SectionHeader
                label="Booking Requests"
                count={bookingRequests.filter((b) => b.status === "pending").length}
                tint="#7C3AED"
              />
              {bookingRequests.map((b) => (
                <View key={b._id} style={{ paddingHorizontal: 16 }}>
                  <BookingRequestCard
                    booking={b}
                    onAccept={handleAcceptBooking}
                    onReject={handleRejectBooking}
                    onOpen={setSelectedBooking}
                  />
                </View>
              ))}
            </View>
          )}

          {/* Tasks section */}
          {tasks.length === 0 && bookingRequests.length === 0 ? (
            <EmptyState />
          ) : tasks.length === 0 ? null : sections && sections.length > 0 ? (
            <>
              {sections.map((section) => (
                <View key={section.key}>
                  <SectionHeader label={section.label} count={section.data.length} tint={section.tint} />
                  {section.data.map((item) => (
                    <View key={item._id} style={{ paddingHorizontal: 16 }}>
                      {renderCard(item)}
                    </View>
                  ))}
                </View>
              ))}
            </>
          ) : filtered.length === 0 ? (
            tasks.length > 0 ? <EmptyState /> : null
          ) : (
            <>
              {filtered.map((item) => (
                <View key={item._id} style={{ paddingHorizontal: 16 }}>
                  {renderCard(item)}
                </View>
              ))}
            </>
          )}
        </ScrollView>
      )}

      {/* FAB */}
      <TouchableOpacity style={styles.fab} activeOpacity={0.85}>
        <View style={styles.fabIcon}>
          <Ionicons name="add" size={14} color={C.accent} />
        </View>
        <Text style={styles.fabText}>New task</Text>
      </TouchableOpacity>

      {/* Detail sheet */}
      {currentSelected && (
        <DetailSheet
          task={currentSelected}
          onClose={() => setSelectedTask(null)}
          onToggleStatus={toggleStatus}
        />
      )}

      {/* Booking detail sheet */}
      {selectedBooking && (
        <BookingDetailSheet
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onAccept={(id) => { handleAcceptBooking(id); }}
          onReject={(id) => { handleRejectBooking(id); }}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.pageBg,
  },

  // Top bar
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  propertyLabel: {
    fontSize: 10.5,
    color: C.muted,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: C.navy,
    letterSpacing: -0.6,
    marginTop: 2,
  },
  topActions: {
    flexDirection: "row",
    gap: 8,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 10,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: "500",
    color: C.navy,
    height: "100%",
  },

  // Stats
  statsRow: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginBottom: 14,
    gap: 6,
  },
  statCard: {
    flex: 1,
    backgroundColor: C.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 10,
    paddingBottom: 12,
    overflow: "hidden",
  },
  statBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  statLabel: {
    fontSize: 9,
    color: C.muted,
    fontWeight: "700",
    letterSpacing: 0.6,
    marginTop: 4,
  },
  statVal: {
    fontSize: 20,
    fontWeight: "800",
    color: C.navy,
    letterSpacing: -0.5,
    lineHeight: 24,
    marginTop: 2,
  },
  statSub: {
    fontSize: 10,
    color: C.subtle,
    fontWeight: "600",
  },

  // Filter chips
  chip: {
    flexDirection: "row",
    alignItems: "center",
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
  },
  chipActive: {
    backgroundColor: C.navy,
    borderColor: C.navy,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "700",
    color: C.navy,
    marginRight: 6,
  },
  chipBadge: {
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 999,
  },
  chipBadgeText: {
    fontSize: 11,
    fontWeight: "800",
  },

  // Section header
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 8,
    marginTop: 2,
  },
  sectionDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  sectionLabel: {
    fontSize: 11,
    color: C.muted,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: C.border,
  },
  sectionCount: {
    fontSize: 11,
    color: C.subtle,
    fontWeight: "800",
  },

  // Task card
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    padding: 12,
    paddingHorizontal: 13,
    marginBottom: 8,
    backgroundColor: C.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  cardBody: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  cardText: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: C.navy,
    letterSpacing: -0.3,
  },
  cardTitleDone: {
    textDecorationLine: "line-through",
    color: C.subtle,
  },
  cardSub: {
    fontSize: 11.5,
    color: C.muted,
    fontWeight: "500",
    marginTop: 3,
  },
  cardRight: {
    alignItems: "flex-end",
    gap: 6,
    flexShrink: 0,
  },

  // Priority pill
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
  },
  pillDot: {
    width: 5,
    height: 5,
    borderRadius: 999,
  },
  pillText: {
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 0.2,
  },

  // Done label
  doneLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  doneLabelText: {
    fontSize: 10,
    fontWeight: "800",
    color: C.positive,
    letterSpacing: 0.2,
  },
  inProgressLabel: {
    fontSize: 9.5,
    fontWeight: "800",
    color: "#0F766E",
    letterSpacing: 0.3,
  },

  // Kind icon
  kindIcon: {
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  // CheckCircle
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  doingDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: C.navy,
  },

  // List
  listContent: {
    paddingBottom: 120,
    paddingTop: 4,
  },

  // FAB
  fab: {
    position: "absolute",
    right: 18,
    bottom: 90,
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: C.accent,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 8,
    zIndex: 25,
  },
  fabIcon: {
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: C.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  fabText: {
    fontSize: 13.5,
    fontWeight: "800",
    color: C.accentText,
    letterSpacing: -0.1,
  },

  // Empty
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 10,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: C.surfaceGray,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 15.5,
    fontWeight: "800",
    color: C.navy,
    letterSpacing: -0.3,
  },
  emptyText: {
    fontSize: 12.5,
    color: C.muted,
    textAlign: "center",
    lineHeight: 18,
  },

  // Detail sheet
  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.5)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "92%",
    backgroundColor: C.pageBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: C.border,
    alignSelf: "center",
    marginTop: 8,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  sheetHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: C.navy,
    letterSpacing: -0.4,
  },
  sheetMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 3,
  },
  sheetKind: {
    fontSize: 11.5,
    color: C.muted,
    fontWeight: "600",
  },
  sheetMetaDot: {
    color: C.border,
    fontSize: 11.5,
  },
  sheetClose: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: C.surfaceGray,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  // Quick actions
  quickActions: {
    flexDirection: "row",
    gap: 6,
    padding: 12,
    paddingHorizontal: 18,
  },
  quickAction: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 14,
    backgroundColor: C.surfaceGray,
    alignItems: "center",
    gap: 4,
  },
  quickActionLabel: {
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 0.1,
    color: C.navy,
  },

  sheetScroll: { flex: 1 },
  sheetScrollContent: {
    padding: 4,
    paddingHorizontal: 18,
    paddingBottom: 8,
    gap: 12,
  },

  // Status banner
  statusBanner: {
    backgroundColor: C.navy,
    borderRadius: 16,
    padding: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bannerCaption: {
    fontSize: 10,
    color: "rgba(255,255,255,0.6)",
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  bannerValue: {
    fontSize: 19,
    fontWeight: "800",
    marginTop: 4,
    letterSpacing: -0.4,
  },
  bannerStatus: {
    fontSize: 15,
    fontWeight: "800",
    marginTop: 5,
    letterSpacing: -0.2,
    color: C.white,
  },

  // Block card
  block: {
    backgroundColor: C.white,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: C.border,
  },
  blockHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  blockIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: C.surfaceGray,
    alignItems: "center",
    justifyContent: "center",
  },
  blockTitle: {
    fontSize: 12.5,
    fontWeight: "800",
    color: C.navy,
    letterSpacing: 0.3,
  },
  blockCount: {
    fontSize: 10.5,
    color: C.subtle,
    fontWeight: "800",
    marginLeft: "auto",
  },

  // Subtask rows
  subRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  subText: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: "600",
    color: C.navy,
    letterSpacing: -0.1,
  },

  detailsText: {
    fontSize: 13,
    color: C.navy,
    fontWeight: "500",
    lineHeight: 20,
    paddingVertical: 12,
  },

  // Linked row
  linkedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
  linkedAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.surfaceGray,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  linkedAvatarText: {
    fontSize: 14,
    fontWeight: "800",
    color: C.navy,
  },
  linkedLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: C.navy,
    letterSpacing: -0.2,
  },
  linkedSub: {
    fontSize: 11.5,
    color: C.muted,
    fontWeight: "500",
    marginTop: 1,
  },
  callBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: C.surfaceGray,
    alignItems: "center",
    justifyContent: "center",
  },

  // Info row
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 10,
  },
  infoLabel: {
    fontSize: 11.5,
    color: C.muted,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: "700",
    color: C.navy,
    letterSpacing: -0.1,
  },

  // CTA
  sheetCTA: {
    padding: 12,
    paddingHorizontal: 18,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.pageBg,
  },
  ctaBtn: {
    height: 52,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  ctaBtnText: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.1,
  },

  // Booking request card
  bookingCard: {
    backgroundColor: C.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 10,
    overflow: "hidden",
  },
  bookingCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    paddingBottom: 10,
  },
  bookingIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#EDE9FE",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  bookingName: {
    fontSize: 14,
    fontWeight: "800",
    color: C.navy,
    letterSpacing: -0.2,
  },
  bookingProp: {
    fontSize: 11.5,
    color: C.muted,
    fontWeight: "500",
    marginTop: 1,
  },
  bookingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  bookingBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.1,
  },
  bookingDetails: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    gap: 5,
  },
  bookingDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  bookingDetailText: {
    fontSize: 12,
    color: C.muted,
    fontWeight: "500",
  },
  bookingActions: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  bookingBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 5,
  },
  bookingBtnReject: {
    borderRightWidth: 1,
    borderRightColor: C.border,
  },
  bookingBtnAccept: {
    // backgroundColor: C.navy,
  },
  bookingBtnText: {
    fontSize: 13,
    fontWeight: "700",
  },

  paymentProofImage: {
    width: "100%",
    height: 220,
    borderRadius: 10,
    marginVertical: 12,
    backgroundColor: C.surfaceGray,
  },
  paymentProofEmpty: {
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 24,
  },
  paymentProofEmptyText: {
    fontSize: 12.5,
    color: C.subtle,
    fontWeight: "600",
  },
});
