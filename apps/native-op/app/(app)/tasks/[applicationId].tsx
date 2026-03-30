import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useConvex } from "convex/react";
import { colors, radii } from "../../../constants/theme";

type Priority = "High" | "Medium" | "Low";

type QuickRequestData = {
  notFound: false;
  isQuickRequest: true;
  applicationId: string;
  propertyName: string;
  tenantName: string;
  phone: string;
  email: string;
  dateOfBirth: string;
  address: string;
  moveInDate: string;
  selectedRoomOptionLabel: string | null;
};

type ManagePayload = {
  notFound: false;
  legalNameAsOnId: string | undefined;
  propertyName: string;
};

type ComplaintData = {
  complaintId: string;
  problemTitle: string;
  description: string;
  priority: Priority;
  status: "open" | "pending_confirmation" | "resolved";
  imageUrl: string | null;
  tenantName: string;
  propertyName: string;
  createdAt: number;
};

type AssignmentPayload =
  | { notFound: true }
  | {
      notFound: false;
      alreadyAssigned: true;
      assignedRoomNumber: string | null;
      paymentStatus?: "paid" | "pending";
      paymentMethod?: string | null;
    }
  | {
      notFound: false;
      alreadyAssigned: false;
      paymentStatus?: "paid" | "pending";
      paymentMethod?: string | null;
      availableRooms: Array<{ roomId: string; roomLabel: string }>;
    };

function getPriorityTone(priority: Priority) {
  if (priority === "High") return { bg: "#FEE2E2", border: "#FECACA", text: "#B91C1C" };
  if (priority === "Medium") return { bg: "#FEF3C7", border: "#FDE68A", text: "#92400E" };
  return { bg: "#DCFCE7", border: "#BBF7D0", text: "#166534" };
}

function DetailRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <View style={s.detailRow}>
      <Text style={s.detailLabel}>{label}</Text>
      <Text style={s.detailValue}>{value}</Text>
    </View>
  );
}

export default function TaskDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const convex = useConvex();
  const { applicationId, taskDescription, priority, dueLabel, tenantName } =
    useLocalSearchParams<{
      applicationId: string;
      taskDescription?: string;
      priority?: Priority;
      dueLabel?: string;
      tenantName?: string;
    }>();

  const [quickRequestData, setQuickRequestData] = useState<QuickRequestData | null>(null);
  const [resolvedTenantName, setResolvedTenantName] = useState<string | null>(null);
  const [propertyName, setPropertyName] = useState<string | null>(null);
  const [assignmentData, setAssignmentData] = useState<AssignmentPayload | null>(null);
  const [complaintData, setComplaintData] = useState<ComplaintData | null>(null);
  const [resolvingComplaint, setResolvingComplaint] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [contactingTenant, setContactingTenant] = useState(false);
  const [assignMessage, setAssignMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const isQuickRequest = taskDescription === "Move-in request by new user";
  const isComplaintTask = typeof taskDescription === "string" && taskDescription.startsWith("Complaint: ");

  const load = useCallback(async () => {
    if (!applicationId || typeof applicationId !== "string") {
      setLoading(false);
      return;
    }
    try {
      if (isComplaintTask) {
        const res = await (convex as any).query(
          "complaints:getComplaintById",
          { complaintId: applicationId },
        );
        if (res) {
          setComplaintData(res as ComplaintData);
          setResolvedTenantName(res.tenantName ?? null);
          setPropertyName(res.propertyName ?? null);
        }
      } else if (isQuickRequest) {
        const res = await (convex as any).query(
          "moveIn:getApplicationForOnboarding",
          { applicationId },
        );
        if (res && !res.notFound) {
          setQuickRequestData({
            notFound: false,
            isQuickRequest: true,
            applicationId: res.applicationId,
            propertyName: res.propertyName,
            tenantName: res.tenantName,
            phone: res.phone,
            email: res.email,
            dateOfBirth: res.dateOfBirth,
            address: res.address,
            moveInDate: res.moveInDate,
            selectedRoomOptionLabel: res.selectedRoomOptionLabel,
          });
          setResolvedTenantName(res.tenantName || null);
          setPropertyName(res.propertyName);
        }
      } else {
        const [manageRes, assignmentRes] = await Promise.all([
          (convex as any).query("properties:getTenantManageDetails", { applicationId }),
          (convex as any).query("properties:getRoomAssignmentTask", { applicationId }),
        ]);
        if (manageRes && !manageRes.notFound) {
          const data = manageRes as ManagePayload;
          setResolvedTenantName(data.legalNameAsOnId ?? null);
          setPropertyName(data.propertyName);
        }
        setAssignmentData((assignmentRes ?? null) as AssignmentPayload | null);
        if (assignmentRes && !assignmentRes.notFound && !assignmentRes.alreadyAssigned) {
          setSelectedRoomId(assignmentRes.availableRooms[0]?.roomId ?? null);
        }
      }
    } catch {
      setAssignmentData(null);
    } finally {
      setLoading(false);
    }
  }, [applicationId, convex, isComplaintTask, isQuickRequest]);

  useEffect(() => {
    void load();
  }, [load]);

  const finalPriority: Priority = priority ?? "High";
  const tone = getPriorityTone(finalPriority);
  const finalTaskDescription = isComplaintTask
    ? (taskDescription ?? "").replace(/^Complaint:\s*/, "")
    : (taskDescription ?? "Task details");
  const finalDueLabel = dueLabel ?? "Due soon";
  const finalTenantName = resolvedTenantName ?? tenantName ?? "Tenant";

  const assignRoom = useCallback(async () => {
    if (!applicationId || typeof applicationId !== "string" || !selectedRoomId) return;
    setAssigning(true);
    setAssignMessage(null);
    try {
      const res = await (convex as any).mutation("properties:assignRoomToTenant", {
        applicationId,
        roomId: selectedRoomId,
      });
      const roomNumber =
        typeof res?.assignedRoomNumber === "string" ? res.assignedRoomNumber : null;
      setAssignMessage(
        roomNumber ? `Room ${roomNumber} assigned successfully.` : "Room assigned successfully.",
      );
      await load();
    } catch (err) {
      setAssignMessage(
        err instanceof Error ? err.message : "Could not assign room. Please try again.",
      );
    } finally {
      setAssigning(false);
    }
  }, [applicationId, convex, load, selectedRoomId]);

  const markCashPaid = useCallback(async () => {
    if (!applicationId || typeof applicationId !== "string") return;
    setMarkingPaid(true);
    setAssignMessage(null);
    try {
      await (convex as any).mutation("properties:markCashPaymentReceived", { applicationId });
      setAssignMessage("Payment marked as paid.");
      await load();
    } catch (err) {
      setAssignMessage(
        err instanceof Error ? err.message : "Could not update payment status.",
      );
    } finally {
      setMarkingPaid(false);
    }
  }, [applicationId, convex, load]);

  const markPaymentReceived = useCallback(async () => {
    if (!applicationId || typeof applicationId !== "string") return;
    setMarkingPaid(true);
    setAssignMessage(null);
    try {
      await (convex as any).mutation("properties:markPaymentReceived", { applicationId });
      setAssignMessage("Payment marked as received.");
      await load();
    } catch (err) {
      setAssignMessage(
        err instanceof Error ? err.message : "Could not update payment status.",
      );
    } finally {
      setMarkingPaid(false);
    }
  }, [applicationId, convex, load]);

  const resolveComplaint = useCallback(async () => {
    if (!applicationId || typeof applicationId !== "string") return;
    setResolvingComplaint(true);
    try {
      await (convex as any).mutation("complaints:markComplaintResolved", {
        complaintId: applicationId,
      });
      await load();
    } catch (err) {
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Could not resolve complaint.",
      );
    } finally {
      setResolvingComplaint(false);
    }
  }, [applicationId, convex, load]);

  const contactTenant = useCallback(async () => {
    if (!applicationId || typeof applicationId !== "string") return;
    setContactingTenant(true);
    try {
      const res = await (convex as any).mutation(
        "chats:getOrCreateConversationForApplication",
        { applicationId },
      );
      if (res?.conversationId) {
        router.push({
          pathname: "/(app)/chats/[conversationId]",
          params: { conversationId: res.conversationId, title: finalTenantName },
        } as any);
      }
    } catch (err) {
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Could not open conversation.",
      );
    } finally {
      setContactingTenant(false);
    }
  }, [applicationId, convex, finalTenantName, router]);

  const isCashTask = finalTaskDescription === "User will pay cash on reception";
  const isPendingPaymentTask = finalTaskDescription === "Complete rent payment";
  const isAlreadyAssigned =
    assignmentData !== null && !assignmentData.notFound && assignmentData.alreadyAssigned === true;
  const paymentIsPaid =
    assignmentData && !assignmentData.notFound ? assignmentData.paymentStatus === "paid" : false;
  const paymentMethod =
    assignmentData && !assignmentData.notFound ? assignmentData.paymentMethod ?? null : null;

  return (
    <View style={s.root}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={[
          s.content,
          { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar */}
        <View style={s.topBar}>
          <Pressable
            style={s.roundBtn}
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={22} color={colors.black} />
          </Pressable>
          <Text style={s.topTitle}>Task Details</Text>
          <View style={{ width: 44, height: 44 }} />
        </View>

        {/* Task header card */}
        <View style={s.card}>
          <View style={s.topRow}>
            <View style={[s.priorityTag, { backgroundColor: tone.bg, borderColor: tone.border }]}>
              <Text style={[s.priorityTagText, { color: tone.text }]}>
                {finalPriority} Priority
              </Text>
            </View>
            <Text style={s.dueText}>{finalDueLabel}</Text>
          </View>

          {isComplaintTask ? (
            <View style={s.taskTypeBadge}>
              <Ionicons name="alert-circle-outline" size={13} color="#EF4444" />
              <Text style={s.taskTypeBadgeText}>Complaint</Text>
            </View>
          ) : null}

          <Text style={s.taskTitle}>{finalTaskDescription}</Text>

          <View style={s.metaRow}>
            <Text style={s.metaLabel}>Tenant</Text>
            <Text style={s.metaValue}>{finalTenantName}</Text>
          </View>
          {propertyName ? (
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>Property</Text>
              <Text style={s.metaValue}>{propertyName}</Text>
            </View>
          ) : null}
        </View>

        {/* Loading */}
        {loading ? (
          <View style={s.loadingWrap}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={s.loadingText}>Loading...</Text>
          </View>
        ) : null}

        {/* ─── Quick request: tenant details + action buttons ─── */}
        {!loading && isQuickRequest && quickRequestData ? (
          <>
            <View style={s.sectionCard}>
              <Text style={s.sectionTitle}>Tenant Details</Text>

              <DetailRow label="Full name" value={quickRequestData.tenantName} />
              <DetailRow label="Phone" value={quickRequestData.phone} />
              <DetailRow label="Email" value={quickRequestData.email} />
              <DetailRow label="Date of birth" value={quickRequestData.dateOfBirth} />
              <DetailRow label="Address" value={quickRequestData.address} />
              <DetailRow label="Preferred move-in" value={quickRequestData.moveInDate} />
              {quickRequestData.selectedRoomOptionLabel ? (
                <DetailRow
                  label="Room type requested"
                  value={quickRequestData.selectedRoomOptionLabel}
                />
              ) : null}
            </View>

            {/* Action buttons */}
            <View style={s.actionRow}>
              <Pressable
                style={[s.actionBtn, s.actionBtnOutline, contactingTenant && { opacity: 0.6 }]}
                onPress={() => void contactTenant()}
                disabled={contactingTenant}
              >
                {contactingTenant ? (
                  <ActivityIndicator size="small" color={colors.navy} />
                ) : (
                  <>
                    <Ionicons
                      name="chatbubble-ellipses-outline"
                      size={18}
                      color={colors.navy}
                      style={{ marginRight: 8 }}
                    />
                    <Text style={s.actionBtnOutlineText}>Contact tenant</Text>
                  </>
                )}
              </Pressable>

              <Pressable
                style={[s.actionBtn, s.actionBtnFilled]}
                onPress={() =>
                  router.push({
                    pathname: "/(app)/tasks/onboard/[applicationId]",
                    params: { applicationId },
                  } as any)
                }
              >
                <Ionicons
                  name="person-add-outline"
                  size={18}
                  color={colors.white}
                  style={{ marginRight: 8 }}
                />
                <Text style={s.actionBtnFilledText}>Onboard tenant</Text>
              </Pressable>
            </View>
          </>
        ) : null}

        {/* ─── Complaint task ─── */}
        {!loading && isComplaintTask ? (
          <View style={s.sectionCard}>
            <Text style={s.sectionTitle}>Complaint Details</Text>

            {complaintData ? (
              <>
                <View style={s.detailRow}>
                  <Text style={s.detailLabel}>Problem</Text>
                  <Text style={s.detailValue}>{complaintData.problemTitle}</Text>
                </View>
                <View style={[s.detailRow, { flexDirection: "column", alignItems: "flex-start", gap: 4 }]}>
                  <Text style={s.detailLabel}>Description</Text>
                  <Text style={[s.detailValue, { textAlign: "left", flex: 0 }]}>{complaintData.description}</Text>
                </View>
                <View style={s.detailRow}>
                  <Text style={s.detailLabel}>Status</Text>
                  <Text style={[s.detailValue, {
                    color: complaintData.status === "resolved"
                      ? "#16A34A"
                      : complaintData.status === "pending_confirmation"
                      ? "#D97706"
                      : "#EF4444",
                  }]}>
                    {complaintData.status === "resolved"
                      ? "Resolved"
                      : complaintData.status === "pending_confirmation"
                      ? "Awaiting tenant confirmation"
                      : "Open"}
                  </Text>
                </View>
                <View style={s.detailRow}>
                  <Text style={s.detailLabel}>Filed on</Text>
                  <Text style={s.detailValue}>
                    {new Date(complaintData.createdAt).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </Text>
                </View>
                {complaintData.imageUrl ? (
                  <View style={{ marginTop: 12 }}>
                    <Text style={s.detailLabel}>Attached Image</Text>
                    <Image
                      source={{ uri: complaintData.imageUrl }}
                      style={s.complaintImage}
                      contentFit="cover"
                    />
                  </View>
                ) : null}

                {complaintData.status === "open" ? (
                  <Pressable
                    style={[s.resolveBtn, resolvingComplaint && s.assignBtnDisabled]}
                    disabled={resolvingComplaint}
                    onPress={() => void resolveComplaint()}
                  >
                    {resolvingComplaint ? (
                      <ActivityIndicator size="small" color={colors.white} />
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle-outline" size={18} color={colors.white} style={{ marginRight: 8 }} />
                        <Text style={s.assignBtnText}>Mark as Resolved</Text>
                      </>
                    )}
                  </Pressable>
                ) : complaintData.status === "pending_confirmation" ? (
                  <View style={s.pendingConfirmBadge}>
                    <Ionicons name="time-outline" size={16} color="#D97706" />
                    <Text style={s.pendingConfirmText}>Awaiting tenant confirmation</Text>
                  </View>
                ) : (
                  <View style={s.resolvedBadge}>
                    <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                    <Text style={s.resolvedBadgeText}>Resolved by tenant</Text>
                  </View>
                )}
              </>
            ) : (
              <Text style={s.infoText}>Could not load complaint details.</Text>
            )}
          </View>
        ) : null}

        {/* ─── Pending payment task ─── */}
        {!loading && !isComplaintTask && !isQuickRequest && isPendingPaymentTask ? (
          <View style={s.sectionCard}>
            <Text style={s.sectionTitle}>Payment Status</Text>

            {paymentIsPaid ? (
              <View style={s.paymentPaidBadge}>
                <Ionicons name="checkmark-circle" size={18} color="#16A34A" />
                <Text style={s.paymentPaidText}>Payment received</Text>
              </View>
            ) : (
              <>
                <View style={s.paymentPendingRow}>
                  <Ionicons name="time-outline" size={18} color="#D97706" />
                  <View style={{ flex: 1 }}>
                    <Text style={s.paymentPendingTitle}>Payment pending</Text>
                    {paymentMethod ? (
                      <Text style={s.paymentPendingMethod}>
                        Method: {paymentMethod}
                      </Text>
                    ) : null}
                  </View>
                </View>
                <Text style={s.paymentPendingBody}>
                  The tenant has submitted their KYC. Once you receive the payment
                  via {paymentMethod ?? "the chosen method"}, mark it as received
                  below.
                </Text>
                <Pressable
                  style={[s.assignBtn, markingPaid && s.assignBtnDisabled]}
                  disabled={markingPaid}
                  onPress={() => void markPaymentReceived()}
                >
                  <Text style={s.assignBtnText}>
                    {markingPaid ? "Updating..." : "Mark payment as received"}
                  </Text>
                </Pressable>
              </>
            )}

            {assignMessage ? <Text style={s.infoText}>{assignMessage}</Text> : null}
          </View>
        ) : null}

        {/* ─── Standard task: room assignment ─── */}
        {!loading && !isComplaintTask && !isQuickRequest && !isPendingPaymentTask ? (
          <View style={s.sectionCard}>
            <Text style={s.sectionTitle}>Available Rooms</Text>
            <Text style={s.sectionBody}>Select a room and assign it to this tenant.</Text>

            {isCashTask && !isAlreadyAssigned && !paymentIsPaid ? (
              <View style={s.cashPaymentCard}>
                <Text style={s.cashTitle}>Cash Payment</Text>
                <Text style={s.cashBody}>Confirm when you receive cash at reception.</Text>
                <Pressable
                  style={[
                    s.assignBtn,
                    (markingPaid || paymentIsPaid) && s.assignBtnDisabled,
                  ]}
                  disabled={markingPaid || paymentIsPaid}
                  onPress={() => void markCashPaid()}
                >
                  <Text style={s.assignBtnText}>
                    {markingPaid ? "Updating..." : "Mark as Paid"}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {assignmentData?.notFound ? (
              <Text style={s.infoText}>Room assignment task not found.</Text>
            ) : null}

            {assignmentData && !assignmentData.notFound && assignmentData.alreadyAssigned ? (
              <Text style={s.infoText}>
                Already assigned to room {assignmentData.assignedRoomNumber ?? "—"}.
              </Text>
            ) : null}

            {assignmentData && !assignmentData.notFound && !assignmentData.alreadyAssigned ? (
              <>
                <View style={s.roomGrid}>
                  {assignmentData.availableRooms.map((room) => {
                    const selected = selectedRoomId === room.roomId;
                    return (
                      <Pressable
                        key={room.roomId}
                        style={[s.roomChip, selected ? s.roomChipSelected : null]}
                        onPress={() => setSelectedRoomId(room.roomId)}
                      >
                        <Text
                          style={[
                            s.roomChipText,
                            selected ? s.roomChipTextSelected : null,
                          ]}
                        >
                          {room.roomLabel}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Pressable
                  style={[
                    s.assignBtn,
                    (!selectedRoomId || assigning || (isCashTask && !paymentIsPaid)) &&
                      s.assignBtnDisabled,
                  ]}
                  disabled={!selectedRoomId || assigning || (isCashTask && !paymentIsPaid)}
                  onPress={() => void assignRoom()}
                >
                  <Text style={s.assignBtnText}>
                    {assigning ? "Assigning..." : "Assign selected room"}
                  </Text>
                </Pressable>

                {isCashTask && !paymentIsPaid ? (
                  <Text style={s.infoText}>Mark payment as paid before assigning a room.</Text>
                ) : null}
              </>
            ) : null}

            {assignMessage ? <Text style={s.infoText}>{assignMessage}</Text> : null}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20 },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  roundBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  topTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "700",
    color: colors.black,
  },

  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    padding: 16,
    marginBottom: 12,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 12,
  },
  priorityTag: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  priorityTagText: { fontSize: 11, fontWeight: "700" },
  dueText: { fontSize: 12, color: colors.muted, fontWeight: "500" },
  taskTitle: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: "800",
    color: colors.black,
    marginBottom: 14,
  },
  metaRow: {
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 10,
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  metaLabel: { fontSize: 12, color: colors.muted, fontWeight: "600" },
  metaValue: {
    fontSize: 13,
    color: colors.black,
    fontWeight: "700",
    maxWidth: "62%",
    textAlign: "right",
  },

  loadingWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 16,
  },
  loadingText: { fontSize: 13, color: colors.muted },

  sectionCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.black,
    marginBottom: 12,
  },
  sectionBody: {
    fontSize: 14,
    color: colors.muted,
    marginBottom: 4,
    lineHeight: 20,
  },

  // Tenant detail rows
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    gap: 12,
  },
  detailLabel: { fontSize: 13, color: colors.muted, fontWeight: "600", flex: 1 },
  detailValue: {
    fontSize: 13,
    color: colors.black,
    fontWeight: "700",
    flex: 2,
    textAlign: "right",
  },

  // Action buttons
  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.pill,
    paddingVertical: 14,
  },
  actionBtnOutline: {
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  actionBtnOutlineText: { fontSize: 14, fontWeight: "700", color: colors.navy },
  actionBtnFilled: { backgroundColor: colors.primary },
  actionBtnFilledText: { fontSize: 14, fontWeight: "700", color: colors.white },

  // Room grid
  roomGrid: { marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  roomChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#F8FAFC",
  },
  roomChipSelected: { backgroundColor: "#DBEAFE", borderColor: "#93C5FD" },
  roomChipText: { fontSize: 13, color: colors.navy, fontWeight: "600" },
  roomChipTextSelected: { color: "#1D4ED8", fontWeight: "700" },
  assignBtn: {
    marginTop: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    paddingVertical: 12,
    backgroundColor: colors.primary,
  },
  assignBtnDisabled: { opacity: 0.5 },
  assignBtnText: { fontSize: 14, fontWeight: "700", color: colors.white },
  infoText: { marginTop: 12, fontSize: 13, lineHeight: 19, color: colors.muted },
  cashPaymentCard: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FBCFE8",
    backgroundColor: "#FDF2F8",
    padding: 12,
  },
  cashTitle: { fontSize: 13, fontWeight: "800", color: "#9D174D", marginBottom: 4 },
  cashBody: { fontSize: 13, color: "#831843", marginBottom: 10 },

  paymentPaidBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#DCFCE7",
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
  },
  paymentPaidText: { fontSize: 14, fontWeight: "700", color: "#16A34A" },

  paymentPendingRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#FEF3C7",
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
    marginBottom: 10,
  },
  paymentPendingTitle: { fontSize: 14, fontWeight: "700", color: "#92400E" },
  paymentPendingMethod: { fontSize: 12, color: "#92400E", fontWeight: "500", marginTop: 2 },
  paymentPendingBody: { fontSize: 13, color: colors.muted, lineHeight: 19, marginBottom: 14 },
  complaintImage: { width: "100%", height: 200, borderRadius: 10, marginTop: 8 },
  resolveBtn: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    paddingVertical: 12,
    backgroundColor: "#16A34A",
  },
  resolvedBadge: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#DCFCE7",
    borderRadius: 10,
    padding: 12,
  },
  resolvedBadgeText: { fontSize: 14, fontWeight: "700", color: "#16A34A" },
  pendingConfirmBadge: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF3C7",
    borderRadius: 10,
    padding: 12,
  },
  pendingConfirmText: { fontSize: 14, fontWeight: "700", color: "#D97706" },
  taskTypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    backgroundColor: "#FEF2F2",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  taskTypeBadgeText: { fontSize: 11, fontWeight: "700", color: "#EF4444" },
});
