import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useConvex } from "convex/react";
import { useFocusEffect } from "expo-router";

// ─── Design tokens ──────────────────────────────────────────
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
  inputBg: "#F3F4F6",
};

const RSTATUS = {
  paid:     { label: "Paid",     fg: "#15803D", bg: "#DCFCE7", dot: "#16A34A" },
  pending:  { label: "Pending",  fg: "#92400E", bg: "#FEF3C7", dot: "#D97706" },
  overdue:  { label: "Overdue",  fg: "#991B1B", bg: "#FEE2E2", dot: "#DC2626" },
  vacant:   { label: "Vacant",   fg: "#475569", bg: "#F1F5F9", dot: "#94A3B8" },
  reserved: { label: "Reserved", fg: "#1A1A1A", bg: "#E9F5BE", dot: "#84CC16" },
  partial:  { label: "Partial",  fg: "#1D4ED8", bg: "#DBEAFE", dot: "#3B82F6" },
};

// ─── Types ───────────────────────────────────────────────────
type Occupant = { n: string; i: string; status: keyof typeof RSTATUS; rent: number };
type RoomDoc = {
  _id: string;
  roomNumber: string;
  type: string;
  capacity: number;
  rent?: number;
  deposit?: number;
};
type Room = {
  id: string;
  type: string;
  capacity: number;
  occupants: Occupant[];
  rent?: number;
  deposit?: number;
};
type FloorDoc = {
  _id: string;
  label: string;
  short: string;
  order: number;
  rooms: RoomDoc[];
};
type Floor = { key: string; label: string; short: string; rooms: Room[] };

type PropertyDoc = {
  name: string;
  roomPricings?: { roomType: string; rent: string; deposit: string }[];
};

// ─── Room type config ─────────────────────────────────────────
const ROOM_TYPES = [
  { label: "Single",  capacity: 1 },
  { label: "Double",  capacity: 2 },
  { label: "Triple",  capacity: 3 },
  { label: "1RK",     capacity: 1 },
  { label: "1BHK",    capacity: 1 },
  { label: "2BHK",    capacity: 2 },
  { label: "3BHK",    capacity: 3 },
];

const FLOOR_PRESETS = [
  { label: "Ground", short: "G" },
  { label: "First",  short: "1F" },
  { label: "Second", short: "2F" },
  { label: "Third",  short: "3F" },
  { label: "Fourth", short: "4F" },
  { label: "Fifth",  short: "5F" },
];

// ─── Helpers ─────────────────────────────────────────────────
function fmtShort(n: number) {
  if (!n) return "₹0";
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}k`;
  return `₹${n}`;
}

function fmtFull(n: number) {
  return "₹" + n.toLocaleString("en-IN");
}

function roomStatus(room: Room): keyof typeof RSTATUS {
  if (room.occupants.length === 0) return "vacant";
  const statuses = room.occupants.map((o) => o.status);
  if (statuses.includes("overdue")) return "overdue";
  if (statuses.includes("pending")) return "pending";
  if (room.occupants.length < room.capacity) return "partial";
  if (statuses.every((s) => s === "reserved")) return "reserved";
  return "paid";
}

function floorStats(floor: Floor) {
  let beds = 0, taken = 0, pendingAmt = 0, overdueCount = 0, vacantRooms = 0;
  floor.rooms.forEach((r) => {
    beds += r.capacity;
    taken += r.occupants.length;
    if (r.occupants.length === 0) vacantRooms++;
    r.occupants.forEach((o) => {
      if (o.status === "pending" || o.status === "overdue") pendingAmt += o.rent;
      if (o.status === "overdue") overdueCount++;
    });
  });
  return { rooms: floor.rooms.length, beds, taken, vacantRooms, pendingAmt, overdueCount };
}

function allStats(floors: Floor[]) {
  return floors.reduce(
    (acc, f) => {
      const s = floorStats(f);
      return {
        rooms: acc.rooms + s.rooms,
        beds: acc.beds + s.beds,
        taken: acc.taken + s.taken,
        vacantRooms: acc.vacantRooms + s.vacantRooms,
        pendingAmt: acc.pendingAmt + s.pendingAmt,
        overdueCount: acc.overdueCount + s.overdueCount,
      };
    },
    { rooms: 0, beds: 0, taken: 0, vacantRooms: 0, pendingAmt: 0, overdueCount: 0 }
  );
}

function docToFloor(doc: FloorDoc): Floor {
  return {
    key: doc._id,
    label: doc.label,
    short: doc.short,
    rooms: doc.rooms.map((r) => ({
      id: r.roomNumber,
      type: r.type,
      capacity: r.capacity,
      occupants: [],
      rent: r.rent,
      deposit: r.deposit,
    })),
  };
}

// ─── Bed dots ────────────────────────────────────────────────
function BedDots({ capacity, occupants }: { capacity: number; occupants: Occupant[] }) {
  return (
    <View style={{ flexDirection: "row", gap: 3 }}>
      {Array.from({ length: capacity }).map((_, i) => {
        const filled = i < occupants.length;
        const o = filled ? occupants[i] : null;
        const color = !filled
          ? "transparent"
          : o?.status === "overdue" ? RSTATUS.overdue.dot
          : o?.status === "pending" ? RSTATUS.pending.dot
          : o?.status === "reserved" ? RSTATUS.reserved.dot
          : RSTATUS.paid.dot;
        return (
          <View
            key={i}
            style={{
              width: 7, height: 7, borderRadius: 2,
              backgroundColor: filled ? color : "transparent",
              borderWidth: filled ? 0 : 1.2,
              borderStyle: "dashed",
              borderColor: filled ? "transparent" : C.subtle,
            }}
          />
        );
      })}
    </View>
  );
}

// ─── Room card ───────────────────────────────────────────────
function RoomCard({ room, onDelete }: { room: Room; onDelete: () => void }) {
  const status = roomStatus(room);
  const isVacant = status === "vacant";
  const isOverdue = status === "overdue";
  const isPending = status === "pending";
  const isReserved = status === "reserved";
  const isPartial = status === "partial";

  const cardBg = isOverdue ? "#FFF7F5" : isPending ? "#FFFBEB" : isReserved ? "#FAFCE8" : C.white;
  const borderColor = isVacant ? C.border : isOverdue ? "#FECACA" : isPending ? "#FDE68A" : isReserved ? "#D9F99D" : C.border;
  const statusKey = isOverdue ? "overdue" : isPending ? "pending" : isReserved ? "reserved" : "paid";
  const statusLabel = isPartial && !isOverdue && !isPending ? "PARTIAL" : isReserved ? "HELD" : isOverdue ? "OVERDUE" : isPending ? "DUE" : "PAID";

  const dueAmt = room.occupants.reduce(
    (s, o) => s + ((o.status === "pending" || o.status === "overdue") ? o.rent : 0), 0
  );

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onLongPress={() =>
        Alert.alert(
          `Delete room ${room.id}?`,
          "This will permanently remove the room and cannot be undone.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: onDelete },
          ]
        )
      }
      style={[styles.roomCard, { backgroundColor: cardBg, borderColor, borderStyle: isVacant ? "dashed" : "solid" }]}
    >
      <View style={styles.roomCardTop}>
        <View>
          <Text style={styles.roomId}>{room.id}</Text>
          <Text style={styles.roomType}>
            {room.type} · {room.capacity} bed{room.capacity > 1 ? "s" : ""}
          </Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: isVacant ? C.surfaceGray : RSTATUS[statusKey].bg }]}>
          <Text style={[styles.statusPillText, { color: isVacant ? C.muted : RSTATUS[statusKey].fg }]}>
            {isVacant ? "VACANT" : statusLabel}
          </Text>
        </View>
      </View>

      {isVacant ? (
        <View style={styles.assignRow}>
          <Ionicons name="add" size={13} color={C.muted} />
          <Text style={styles.assignText}>Assign tenant</Text>
        </View>
      ) : (
        <View style={styles.avatarRow}>
          {room.occupants.slice(0, 3).map((o, i) => {
            const bg = o.status === "overdue" ? RSTATUS.overdue.dot
              : o.status === "pending" ? RSTATUS.pending.dot
              : o.status === "reserved" ? RSTATUS.reserved.dot
              : C.navy;
            return (
              <View key={i} style={[styles.avatarDot, { backgroundColor: bg, marginLeft: i === 0 ? 0 : -7, zIndex: 10 - i }]}>
                <Text style={styles.avatarText}>{o.i}</Text>
              </View>
            );
          })}
          {room.capacity > room.occupants.length && (
            <View style={[styles.avatarDotEmpty, { marginLeft: room.occupants.length > 0 ? -7 : 0 }]}>
              <Text style={styles.avatarEmptyText}>+</Text>
            </View>
          )}
        </View>
      )}

      <View style={[styles.roomCardBottom, { borderTopColor: borderColor }]}>
        <BedDots capacity={room.capacity} occupants={room.occupants} />
        <Text style={[styles.dueAmt, { color: dueAmt > 0 ? C.error : isVacant ? C.subtle : C.positive }]}>
          {room.rent ? (isVacant ? fmtShort(room.rent) : dueAmt > 0 ? `−${fmtShort(dueAmt)}` : "Paid") : "—"}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Add room tile ───────────────────────────────────────────
function AddRoomTile({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity activeOpacity={0.7} style={styles.addRoomTile} onPress={onPress}>
      <View style={styles.addRoomIcon}>
        <Ionicons name="add" size={16} color={C.navy} />
      </View>
      <Text style={styles.addRoomLabel}>Add room</Text>
      <Text style={styles.addRoomSub}>to this floor</Text>
    </TouchableOpacity>
  );
}

// ─── Floor section ───────────────────────────────────────────
function FloorSection({
  floor,
  filter,
  onAddRoom,
  onDeleteFloor,
  onDeleteRoom,
}: {
  floor: Floor;
  filter: string;
  onAddRoom: (floorKey: string) => void;
  onDeleteFloor: (floorKey: string) => void;
  onDeleteRoom: (floorKey: string, roomId: string) => void;
}) {
  const s = floorStats(floor);
  const filtered = floor.rooms.filter((r) => {
    if (filter === "all") return true;
    if (filter === "vacant") return r.occupants.length === 0;
    if (filter === "paid") return roomStatus(r) === "paid";
    if (filter === "pending") return roomStatus(r) === "pending";
    if (filter === "overdue") return roomStatus(r) === "overdue";
    return true;
  });

  const allItems: (Room | null)[] = [...filtered, ...(filter === "all" ? [null] : [])];
  const pairs: (Room | null)[][] = [];
  for (let i = 0; i < allItems.length; i += 2) {
    pairs.push([allItems[i], allItems[i + 1] ?? null]);
  }

  return (
    <View style={styles.floorSection}>
      <View style={styles.floorHeader}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={styles.floorBadge}>
            <Text style={styles.floorBadgeText}>{floor.short}</Text>
          </View>
          <View>
            <Text style={styles.floorLabel}>{floor.label} Floor</Text>
            <Text style={styles.floorMeta}>{s.rooms} rooms · {s.taken}/{s.beds} beds</Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          {s.pendingAmt > 0 && (
            <View style={styles.duePill}>
              <View style={styles.duePillDot} />
              <Text style={styles.duePillText}>{fmtShort(s.pendingAmt)}</Text>
            </View>
          )}
          {s.vacantRooms > 0 && (
            <View style={styles.vacantPill}>
              <Text style={styles.vacantPillText}>{s.vacantRooms} vacant</Text>
            </View>
          )}
          <TouchableOpacity
            onPress={() =>
              Alert.alert(
                `Delete ${floor.label} Floor?`,
                `This will delete the floor and all ${s.rooms} room${s.rooms !== 1 ? "s" : ""} in it. This cannot be undone.`,
                [
                  { text: "Cancel", style: "cancel" },
                  { text: "Delete", style: "destructive", onPress: () => onDeleteFloor(floor.key) },
                ]
              )
            }
            style={styles.deleteFloorBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={14} color={C.error} />
          </TouchableOpacity>
        </View>
      </View>

      {filtered.length === 0 && filter !== "all" ? (
        <View style={styles.emptyFilter}>
          <Text style={styles.emptyFilterText}>No rooms match this filter.</Text>
        </View>
      ) : (
        pairs.map((pair, idx) => (
          <View key={idx} style={styles.roomRow}>
            {pair[0] === null ? (
              <AddRoomTile onPress={() => onAddRoom(floor.key)} />
            ) : (
              <View style={{ flex: 1 }}>
                <RoomCard room={pair[0]} onDelete={() => onDeleteRoom(floor.key, pair[0]!.id)} />
              </View>
            )}
            <View style={{ width: 8 }} />
            {pair[1] === null ? (
              pair[0] !== null ? (
                <AddRoomTile onPress={() => onAddRoom(floor.key)} />
              ) : (
                <View style={{ flex: 1 }} />
              )
            ) : (
              <View style={{ flex: 1 }}>
                <RoomCard room={pair[1]} onDelete={() => onDeleteRoom(floor.key, pair[1]!.id)} />
              </View>
            )}
          </View>
        ))
      )}
    </View>
  );
}

// ─── Empty state ─────────────────────────────────────────────
function EmptyState({ onAddFloor }: { onAddFloor: () => void }) {
  return (
    <View style={styles.emptyStateWrap}>
      <View style={styles.emptyIllustration}>
        <View style={styles.emptyFloorStack}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.emptyFloorBar, { opacity: 1 - i * 0.25, width: 80 - i * 16, marginBottom: i === 2 ? 0 : 6 }]} />
          ))}
        </View>
        <View style={styles.emptyDoor}>
          <Ionicons name="home-outline" size={28} color={C.navy} />
        </View>
      </View>
      <Text style={styles.emptyTitle}>No rooms yet</Text>
      <Text style={styles.emptySubtitle}>
        Add your first floor to start tracking occupancy, rent status, and tenant assignments.
      </Text>
      <TouchableOpacity style={styles.emptyAddBtn} onPress={onAddFloor} activeOpacity={0.8}>
        <Ionicons name="add" size={18} color={C.accentText} />
        <Text style={styles.emptyAddBtnText}>Add your first floor</Text>
      </TouchableOpacity>
      <View style={styles.emptyChecklist}>
        {[
          "Track which rooms are occupied or vacant",
          "See pending & overdue rent at a glance",
          "Assign tenants to specific rooms",
        ].map((item) => (
          <View key={item} style={styles.emptyCheckRow}>
            <View style={styles.emptyCheckDot} />
            <Text style={styles.emptyCheckText}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Add Floor modal ─────────────────────────────────────────
function AddFloorModal({
  visible,
  onClose,
  onSave,
  usedLabels,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (label: string, short: string) => Promise<void>;
  usedLabels: string[];
}) {
  const [selected, setSelected] = React.useState<{ label: string; short: string } | null>(null);
  const [saving, setSaving] = React.useState(false);
  const insets = useSafeAreaInsets();

  const available = FLOOR_PRESETS.filter((p) => !usedLabels.includes(p.label));

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    try {
      await onSave(selected.label, selected.short);
      setSelected(null);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ width: "100%" }}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Add a floor</Text>
            <Text style={styles.modalSubtitle}>Pick a floor label to add to your property.</Text>

            <View style={styles.presetGrid}>
              {FLOOR_PRESETS.map((p) => {
                const used = usedLabels.includes(p.label);
                const isSelected = selected?.label === p.label;
                return (
                  <TouchableOpacity
                    key={p.label}
                    onPress={() => !used && setSelected(p)}
                    activeOpacity={0.7}
                    style={[
                      styles.presetChip,
                      isSelected && styles.presetChipActive,
                      used && styles.presetChipUsed,
                    ]}
                  >
                    <Text style={[styles.presetShort, isSelected && { color: C.accent }]}>{p.short}</Text>
                    <Text style={[styles.presetLabel, isSelected && { color: C.white }, used && { color: C.subtle }]}>
                      {p.label}
                    </Text>
                    {used && <Text style={styles.presetUsedTag}>Added</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>

            {available.length === 0 && (
              <Text style={styles.modalNote}>All preset floors added. You can rename them later.</Text>
            )}

            <TouchableOpacity
              style={[styles.modalSaveBtn, (!selected || saving) && { opacity: 0.5 }]}
              onPress={handleSave}
              disabled={!selected || saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator color={C.accentText} size="small" />
              ) : (
                <Text style={styles.modalSaveBtnText}>Add floor</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={styles.modalCancelBtn}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ─── Add Room modal ──────────────────────────────────────────
function AddRoomModal({
  visible,
  onClose,
  onSave,
  floorLabel,
  floorShort,
  existingRoomCount,
  roomPricings,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (data: { roomNumber: string; type: string; capacity: number; rent?: number; deposit?: number }) => Promise<void>;
  floorLabel: string;
  floorShort: string;
  existingRoomCount: number;
  roomPricings?: { roomType: string; rent: string; deposit: string }[];
}) {
  const insets = useSafeAreaInsets();
  const [roomNumber, setRoomNumber] = React.useState("");
  const [selectedType, setSelectedType] = React.useState(ROOM_TYPES[0]);
  const [rent, setRent] = React.useState("");
  const [deposit, setDeposit] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  // Auto-suggest room number
  React.useEffect(() => {
    if (visible) {
      const n = (existingRoomCount + 1).toString().padStart(2, "0");
      setRoomNumber(floorShort === "G" ? `G-${n}` : `${floorShort.replace("F", "")}${n}`);
    }
  }, [visible, floorShort, existingRoomCount]);

  // Pre-fill rent from property pricings
  React.useEffect(() => {
    if (!roomPricings) return;
    const match = roomPricings.find(
      (p) => p.roomType.toLowerCase() === selectedType.label.toLowerCase()
    );
    if (match) {
      setRent(match.rent);
      setDeposit(match.deposit);
    } else {
      setRent("");
      setDeposit("");
    }
  }, [selectedType, roomPricings]);

  async function handleSave() {
    if (!roomNumber.trim()) return;
    setSaving(true);
    try {
      await onSave({
        roomNumber: roomNumber.trim(),
        type: selectedType.label,
        capacity: selectedType.capacity,
        rent: rent ? parseInt(rent, 10) : undefined,
        deposit: deposit ? parseInt(deposit, 10) : undefined,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ width: "100%" }}>
          <ScrollView>
            <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Add room</Text>
              <Text style={styles.modalSubtitle}>{floorLabel} Floor · {floorShort}</Text>

              {/* Room number */}
              <Text style={styles.fieldLabel}>Room number</Text>
              <TextInput
                style={styles.textInput}
                value={roomNumber}
                onChangeText={setRoomNumber}
                placeholder="e.g. G-01"
                placeholderTextColor={C.subtle}
              />

              {/* Room type */}
              <Text style={styles.fieldLabel}>Room type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {ROOM_TYPES.map((t) => {
                    const isActive = selectedType.label === t.label;
                    return (
                      <TouchableOpacity
                        key={t.label}
                        onPress={() => setSelectedType(t)}
                        style={[styles.typeChip, isActive && styles.typeChipActive]}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.typeChipLabel, isActive && styles.typeChipLabelActive]}>
                          {t.label}
                        </Text>
                        <Text style={[styles.typeChipCap, isActive && { color: C.accent }]}>
                          {t.capacity} bed{t.capacity > 1 ? "s" : ""}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              {/* Rent */}
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Monthly rent (₹)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={rent}
                    onChangeText={setRent}
                    placeholder="e.g. 9000"
                    keyboardType="numeric"
                    placeholderTextColor={C.subtle}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Deposit (₹)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={deposit}
                    onChangeText={setDeposit}
                    placeholder="e.g. 18000"
                    keyboardType="numeric"
                    placeholderTextColor={C.subtle}
                  />
                </View>
              </View>
              {roomPricings && roomPricings.length > 0 && (
                <Text style={styles.modalNote}>Pre-filled from your property pricings. Edit if needed.</Text>
              )}

              <TouchableOpacity
                style={[styles.modalSaveBtn, (!roomNumber.trim() || saving) && { opacity: 0.5 }]}
                onPress={handleSave}
                disabled={!roomNumber.trim() || saving}
                activeOpacity={0.8}
              >
                {saving ? (
                  <ActivityIndicator color={C.accentText} size="small" />
                ) : (
                  <Text style={styles.modalSaveBtnText}>Add room</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} style={styles.modalCancelBtn}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ─── Main screen ──────────────────────────────────────────────
export default function RoomsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const convex = useConvex();

  const [floors, setFloors] = React.useState<Floor[]>([]);
  const [property, setProperty] = React.useState<PropertyDoc | null>(null);
  const [floorDocs, setFloorDocs] = React.useState<FloorDoc[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [activeFloor, setActiveFloor] = React.useState("all");
  const [filter, setFilter] = React.useState("all");

  const [showAddFloor, setShowAddFloor] = React.useState(false);
  const [addRoomTarget, setAddRoomTarget] = React.useState<{ floorKey: string; floorLabel: string; floorShort: string; count: number } | null>(null);

  const fetchData = React.useCallback(async () => {
    try {
      const result = await (convex as any).query("rooms:getFloorsWithRooms", {});
      if (result) {
        setProperty(result.property);
        setFloorDocs(result.floors);
        setFloors(result.floors.map(docToFloor));
      } else {
        setFloors([]);
      }
    } catch {
      setFloors([]);
    } finally {
      setLoading(false);
    }
  }, [convex]);

  useFocusEffect(React.useCallback(() => {
    fetchData();
  }, [fetchData]));

  const isEmpty = floors.length === 0;
  const visibleFloors = activeFloor === "all" ? floors : floors.filter((f) => f.key === activeFloor);
  const stats = isEmpty
    ? { rooms: 0, beds: 0, taken: 0, vacantRooms: 0, pendingAmt: 0, overdueCount: 0 }
    : activeFloor === "all" ? allStats(floors) : floorStats(visibleFloors[0] ?? floors[0]);
  const occPct = stats.beds === 0 ? 0 : Math.round((stats.taken / stats.beds) * 100);

  const filterChips = [
    { k: "all",     label: "All" },
    { k: "vacant",  label: "Vacant",  dot: RSTATUS.vacant.dot },
    { k: "pending", label: "Pending", dot: RSTATUS.pending.dot },
    { k: "overdue", label: "Overdue", dot: RSTATUS.overdue.dot },
    { k: "paid",    label: "Paid",    dot: RSTATUS.paid.dot },
  ];

  const legendItems = [
    { label: "Paid",    color: RSTATUS.paid.dot },
    { label: "Pending", color: RSTATUS.pending.dot },
    { label: "Overdue", color: RSTATUS.overdue.dot },
    { label: "Held",    color: RSTATUS.reserved.dot },
  ];

  async function handleDeleteFloor(floorKey: string) {
    try {
      await (convex as any).mutation("rooms:deleteFloor", { floorId: floorKey });
      if (activeFloor === floorKey) setActiveFloor("all");
      await fetchData();
    } catch {
      Alert.alert("Error", "Could not delete floor. Please try again.");
    }
  }

  async function handleDeleteRoom(floorKey: string, roomNumber: string) {
    const floorDoc = floorDocs.find((f) => f._id === floorKey);
    const roomDoc = floorDoc?.rooms.find((r) => r.roomNumber === roomNumber);
    if (!roomDoc) return;
    try {
      await (convex as any).mutation("rooms:deleteRoom", { roomId: roomDoc._id });
      await fetchData();
    } catch {
      Alert.alert("Error", "Could not delete room. Please try again.");
    }
  }

  async function handleAddFloor(label: string, short: string) {
    await (convex as any).mutation("rooms:addFloor", { label, short });
    await fetchData();
  }

  async function handleAddRoom(data: {
    roomNumber: string; type: string; capacity: number; rent?: number; deposit?: number;
  }) {
    if (!addRoomTarget) return;
    await (convex as any).mutation("rooms:addRoom", {
      floorId: addRoomTarget.floorKey,
      ...data,
    });
    await fetchData();
  }

  function openAddRoom(floorKey: string) {
    const floorDoc = floorDocs.find((f) => f._id === floorKey);
    if (!floorDoc) return;
    setAddRoomTarget({
      floorKey,
      floorLabel: floorDoc.label,
      floorShort: floorDoc.short,
      count: floorDoc.rooms.length,
    });
  }

  const usedFloorLabels = floorDocs.map((f) => f.label);

  if (loading) {
    return (
      <View style={[styles.root, { paddingTop: insets.top, alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={C.navy} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={18} color={C.navy} />
          </TouchableOpacity>
          <View>
            <Text style={styles.screenEyebrow}>ROOMS</Text>
            <Text style={styles.screenTitle} numberOfLines={1}>
              {property?.name ?? "Your Property"}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 6 }}>
          <TouchableOpacity style={styles.iconBtn}>
            <Ionicons name="search-outline" size={17} color={C.navy} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddFloor(true)}>
            <Ionicons name="add" size={18} color={C.white} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        {/* Stats strip */}
        <View style={styles.statsStrip}>
          <View style={[styles.statCard, { backgroundColor: C.navy, flex: 1.15 }]}>
            <Text style={styles.statLabelWhite}>Occupancy</Text>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 2, marginTop: 6 }}>
              <Text style={styles.statValueWhite}>{occPct}</Text>
              <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", fontWeight: "600" }}>%</Text>
            </View>
            <Text style={styles.statSubWhite}>{stats.taken}/{stats.beds} beds</Text>
            <View style={styles.occBar}>
              <View style={[styles.occBarFill, { width: `${occPct}%` as any }]} />
            </View>
          </View>

          <View style={[styles.statCard, { backgroundColor: C.white, flex: 1 }]}>
            <Text style={styles.statLabel}>Vacant</Text>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 3, marginTop: 6 }}>
              <Text style={styles.statValue}>{stats.vacantRooms}</Text>
              <Text style={{ fontSize: 11, color: C.muted, fontWeight: "600" }}>rooms</Text>
            </View>
            <Text style={styles.statSub}>{stats.beds - stats.taken} beds free</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: C.white, flex: 1, borderColor: stats.pendingAmt > 0 ? "#FECACA" : C.border }]}>
            <Text style={styles.statLabel}>Dues</Text>
            <Text style={[styles.statValue, { marginTop: 6, color: stats.pendingAmt > 0 ? C.error : C.navy }]}>
              {fmtShort(stats.pendingAmt)}
            </Text>
            <Text style={styles.statSub}>
              {stats.overdueCount > 0 ? `${stats.overdueCount} overdue` : "all on time"}
            </Text>
          </View>
        </View>

        {/* Dues banner */}
        {stats.pendingAmt > 0 && (
          <View style={styles.duesBanner}>
            <View style={styles.duesBannerDecor} />
            <View style={styles.duesBannerIcon}>
              <Ionicons name="time-outline" size={16} color="#FCA5A5" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.duesBannerTitle}>{fmtFull(stats.pendingAmt)} pending</Text>
              <Text style={styles.duesBannerSub}>
                {stats.overdueCount > 0 ? `${stats.overdueCount} overdue · ` : ""}across multiple tenants
              </Text>
            </View>
            <TouchableOpacity style={styles.remindBtn} activeOpacity={0.8}>
              <Text style={styles.remindBtnText}>Remind all</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Floor tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabsContent}>
          {[{ key: "all", label: "All", short: "★" }, ...floors].map((f) => {
            const isActive = activeFloor === f.key;
            const s = f.key === "all" ? null : floorStats(f as Floor);
            return (
              <TouchableOpacity key={f.key} onPress={() => setActiveFloor(f.key)} style={[styles.tab, isActive && styles.tabActive]} activeOpacity={0.75}>
                <View style={[styles.tabBadge, isActive && styles.tabBadgeActive]}>
                  <Text style={[styles.tabBadgeText, isActive && styles.tabBadgeTextActive]}>{f.short}</Text>
                </View>
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{f.label}</Text>
                {s && (
                  <View style={[styles.tabCount, isActive && styles.tabCountActive]}>
                    <Text style={[styles.tabCountText, isActive && styles.tabCountTextActive]}>{s.taken}/{s.beds}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Filter chips — hide when empty */}
        {!isEmpty && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={styles.chipsContent}>
            {filterChips.map((c) => {
              const isActive = filter === c.k;
              return (
                <TouchableOpacity key={c.k} onPress={() => setFilter(c.k)} style={[styles.chip, isActive && styles.chipActive]} activeOpacity={0.75}>
                  {c.dot && <View style={[styles.chipDot, { backgroundColor: c.dot }]} />}
                  <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{c.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Legend — hide when empty */}
        {!isEmpty && (
          <View style={styles.legend}>
            {legendItems.map((it) => (
              <View key={it.label} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: it.color }]} />
                <Text style={styles.legendLabel}>{it.label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Floor sections or empty state */}
        {isEmpty ? (
          <EmptyState onAddFloor={() => setShowAddFloor(true)} />
        ) : (
          visibleFloors.map((f) => (
            <FloorSection
              key={f.key}
              floor={f}
              filter={filter}
              onAddRoom={openAddRoom}
              onDeleteFloor={handleDeleteFloor}
              onDeleteRoom={handleDeleteRoom}
            />
          ))
        )}

        {/* Add floor row — only when data exists */}
        {!isEmpty && (
          <TouchableOpacity style={styles.addFloorRow} activeOpacity={0.75} onPress={() => setShowAddFloor(true)}>
            <View style={styles.addFloorIcon}>
              <Ionicons name="add" size={18} color={C.accentText} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.addFloorTitle}>Add a floor</Text>
              <Text style={styles.addFloorSub}>Configure rooms, capacities, and rent in one go</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={C.muted} />
          </TouchableOpacity>
        )}

        <View style={styles.watermark}>
          <View style={styles.watermarkRow}>
            <View style={styles.watermarkLine} />
            <Text style={styles.watermarkText}>LIVEET</Text>
            <View style={styles.watermarkLine} />
          </View>
        </View>
      </ScrollView>

      {/* Add Floor modal */}
      <AddFloorModal
        visible={showAddFloor}
        onClose={() => setShowAddFloor(false)}
        onSave={handleAddFloor}
        usedLabels={usedFloorLabels}
      />

      {/* Add Room modal */}
      {addRoomTarget && (
        <AddRoomModal
          visible={!!addRoomTarget}
          onClose={() => setAddRoomTarget(null)}
          onSave={handleAddRoom}
          floorLabel={addRoomTarget.floorLabel}
          floorShort={addRoomTarget.floorShort}
          existingRoomCount={addRoomTarget.count}
          roomPricings={property?.roomPricings}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.pageBg },

  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 18, paddingTop: 8, paddingBottom: 12,
  },
  screenEyebrow: { fontSize: 11.5, color: C.muted, fontWeight: "600", letterSpacing: 0.3 },
  screenTitle: { fontSize: 18, fontWeight: "700", color: C.navy, letterSpacing: -0.4, lineHeight: 22, maxWidth: 200 },
  iconBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: C.white, borderWidth: 1, borderColor: C.border,
    alignItems: "center", justifyContent: "center",
  },
  addBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: C.navy, alignItems: "center", justifyContent: "center" },

  statsStrip: { flexDirection: "row", gap: 8, marginHorizontal: 18, marginBottom: 12 },
  statCard: { borderRadius: 16, padding: 12, borderWidth: 1, borderColor: C.border },
  statLabel: { fontSize: 10, color: C.muted, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" },
  statLabelWhite: { fontSize: 10, color: "rgba(255,255,255,0.6)", fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" },
  statValue: { fontSize: 22, fontWeight: "700", color: C.navy, letterSpacing: -0.6 },
  statValueWhite: { fontSize: 22, fontWeight: "700", color: C.white, letterSpacing: -0.6 },
  statSub: { fontSize: 10.5, color: C.muted, fontWeight: "500", marginTop: 2 },
  statSubWhite: { fontSize: 10.5, color: "rgba(255,255,255,0.55)", fontWeight: "500", marginTop: 2 },
  occBar: { position: "absolute", left: 12, right: 12, bottom: 10, height: 3, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.12)", overflow: "hidden" },
  occBarFill: { height: "100%", backgroundColor: C.accent, borderRadius: 999 },

  duesBanner: { marginHorizontal: 18, marginBottom: 12, backgroundColor: C.navy, borderRadius: 16, padding: 12, flexDirection: "row", alignItems: "center", gap: 12, overflow: "hidden" },
  duesBannerDecor: { position: "absolute", right: -30, top: -30, width: 100, height: 100, borderRadius: 50, backgroundColor: "rgba(212,245,66,0.08)" },
  duesBannerIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(220,38,38,0.18)", alignItems: "center", justifyContent: "center" },
  duesBannerTitle: { fontSize: 13.5, fontWeight: "700", color: C.white, letterSpacing: -0.2 },
  duesBannerSub: { fontSize: 11, color: "rgba(255,255,255,0.65)", marginTop: 1, fontWeight: "500" },
  remindBtn: { backgroundColor: C.accent, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999 },
  remindBtnText: { fontSize: 11, fontWeight: "800", color: C.accentText, letterSpacing: 0.3 },

  tabsScroll: { marginBottom: 10 },
  tabsContent: { paddingHorizontal: 18, gap: 6 },
  tab: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 12 },
  tabActive: { backgroundColor: C.navy, borderColor: C.navy },
  tabBadge: { width: 22, height: 22, borderRadius: 7, backgroundColor: C.surfaceGray, alignItems: "center", justifyContent: "center" },
  tabBadgeActive: { backgroundColor: "rgba(255,255,255,0.13)" },
  tabBadgeText: { fontSize: 10.5, fontWeight: "800", color: C.navy },
  tabBadgeTextActive: { color: C.accent },
  tabLabel: { fontSize: 13, fontWeight: "700", color: C.navy, letterSpacing: -0.1 },
  tabLabelActive: { color: C.white },
  tabCount: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, backgroundColor: C.surfaceGray },
  tabCountActive: { backgroundColor: "rgba(212,245,66,0.18)" },
  tabCountText: { fontSize: 10.5, fontWeight: "700", color: C.muted },
  tabCountTextActive: { color: C.accent },

  chipsScroll: { marginBottom: 8 },
  chipsContent: { paddingHorizontal: 18, gap: 6 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: C.border, backgroundColor: "transparent" },
  chipActive: { backgroundColor: C.navy, borderColor: C.navy },
  chipDot: { width: 7, height: 7, borderRadius: 999 },
  chipText: { fontSize: 12, fontWeight: "700", color: C.muted, letterSpacing: 0.1 },
  chipTextActive: { color: C.white },

  legend: { flexDirection: "row", justifyContent: "center", gap: 14, paddingVertical: 8, marginBottom: 4 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 7, height: 7, borderRadius: 2 },
  legendLabel: { fontSize: 10.5, color: C.muted, fontWeight: "600", letterSpacing: 0.1 },

  floorSection: { marginHorizontal: 18, marginBottom: 18 },
  floorHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  floorBadge: { width: 30, height: 30, borderRadius: 9, backgroundColor: C.navy, alignItems: "center", justifyContent: "center" },
  floorBadgeText: { fontSize: 11, fontWeight: "800", color: C.accent, letterSpacing: 0.3 },
  floorLabel: { fontSize: 14.5, fontWeight: "800", color: C.navy, letterSpacing: -0.3, lineHeight: 18 },
  floorMeta: { fontSize: 11, color: C.muted, fontWeight: "600", marginTop: 1 },
  duePill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: "#FEE2E2" },
  duePillDot: { width: 6, height: 6, borderRadius: 999, backgroundColor: C.error },
  duePillText: { fontSize: 10.5, fontWeight: "800", color: "#991B1B", letterSpacing: 0.2 },
  vacantPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: C.surfaceGray },
  vacantPillText: { fontSize: 10.5, fontWeight: "800", color: C.muted, letterSpacing: 0.2 },
  deleteFloorBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: "#FEE2E2", alignItems: "center", justifyContent: "center" },

  roomRow: { flexDirection: "row", marginBottom: 8 },
  emptyFilter: { padding: 20, borderRadius: 14, backgroundColor: C.surfaceGray, alignItems: "center" },
  emptyFilterText: { fontSize: 12.5, color: C.muted, fontWeight: "500" },

  roomCard: { borderRadius: 16, padding: 12, borderWidth: 1.5, gap: 10 },
  roomCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  roomId: { fontSize: 17, fontWeight: "800", color: C.navy, letterSpacing: -0.5, lineHeight: 20 },
  roomType: { fontSize: 10.5, color: C.muted, fontWeight: "600", marginTop: 3, letterSpacing: 0.2 },
  statusPill: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999 },
  statusPillText: { fontSize: 9.5, fontWeight: "800", letterSpacing: 0.3, textTransform: "uppercase" },
  assignRow: { height: 36, borderRadius: 10, borderWidth: 1.2, borderStyle: "dashed", borderColor: C.border, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  assignText: { fontSize: 11.5, color: C.muted, fontWeight: "600" },
  avatarRow: { flexDirection: "row", alignItems: "center" },
  avatarDot: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: C.white },
  avatarText: { fontSize: 9, fontWeight: "800", color: C.white, letterSpacing: 0.1 },
  avatarDotEmpty: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.2, borderStyle: "dashed", borderColor: C.subtle, alignItems: "center", justifyContent: "center", backgroundColor: "transparent" },
  avatarEmptyText: { fontSize: 11, color: C.subtle, fontWeight: "600" },
  roomCardBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 8, borderTopWidth: 1, borderStyle: "dashed" },
  dueAmt: { fontSize: 11.5, fontWeight: "800", letterSpacing: -0.2 },

  addRoomTile: { flex: 1, minHeight: 130, borderRadius: 16, borderWidth: 1.5, borderStyle: "dashed", borderColor: C.border, alignItems: "center", justifyContent: "center", gap: 5, backgroundColor: "transparent" },
  addRoomIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: C.surfaceGray, alignItems: "center", justifyContent: "center" },
  addRoomLabel: { fontSize: 12, fontWeight: "700", color: C.navy },
  addRoomSub: { fontSize: 10.5, color: C.muted, fontWeight: "500" },

  addFloorRow: { marginHorizontal: 18, marginBottom: 14, padding: 14, borderRadius: 16, borderWidth: 1.5, borderStyle: "dashed", borderColor: C.border, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "transparent" },
  addFloorIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: C.accent, alignItems: "center", justifyContent: "center" },
  addFloorTitle: { fontSize: 13.5, fontWeight: "800", color: C.navy, letterSpacing: -0.2 },
  addFloorSub: { fontSize: 11.5, color: C.muted, fontWeight: "500", marginTop: 1 },

  watermark: { alignItems: "center", paddingVertical: 16, opacity: 0.45 },
  watermarkRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  watermarkLine: { width: 24, height: 1, backgroundColor: C.subtle },
  watermarkText: { fontSize: 13, fontWeight: "700", color: C.subtle, letterSpacing: 5 },

  // Empty state
  emptyStateWrap: { marginHorizontal: 18, marginTop: 8, marginBottom: 24, backgroundColor: C.white, borderRadius: 22, padding: 24, alignItems: "center", borderWidth: 1, borderColor: C.border },
  emptyIllustration: { width: 80, height: 80, alignItems: "center", justifyContent: "flex-end", marginBottom: 20, position: "relative" },
  emptyFloorStack: { position: "absolute", top: 0, left: 0, right: 0, alignItems: "center" },
  emptyFloorBar: { height: 14, borderRadius: 6, backgroundColor: C.surfaceGray, borderWidth: 1, borderColor: C.border },
  emptyDoor: { width: 52, height: 52, borderRadius: 16, backgroundColor: C.surfaceGray, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: C.navy, letterSpacing: -0.5, marginBottom: 6, textAlign: "center" },
  emptySubtitle: { fontSize: 13, color: C.muted, fontWeight: "500", textAlign: "center", lineHeight: 19, marginBottom: 20 },
  emptyAddBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.accent, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 999, marginBottom: 20 },
  emptyAddBtnText: { fontSize: 14, fontWeight: "800", color: C.accentText, letterSpacing: -0.2 },
  emptyChecklist: { width: "100%", gap: 10, paddingTop: 16, borderTopWidth: 1, borderTopColor: C.border },
  emptyCheckRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  emptyCheckDot: { width: 7, height: 7, borderRadius: 999, backgroundColor: C.accent, marginTop: 5, flexShrink: 0 },
  emptyCheckText: { fontSize: 12.5, color: C.muted, fontWeight: "500", flex: 1, lineHeight: 18 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  modalHandle: { width: 36, height: 4, borderRadius: 999, backgroundColor: C.border, alignSelf: "center", marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: "800", color: C.navy, letterSpacing: -0.5, marginBottom: 4 },
  modalSubtitle: { fontSize: 13, color: C.muted, marginBottom: 20, fontWeight: "500" },
  modalNote: { fontSize: 11.5, color: C.muted, marginBottom: 12, fontStyle: "italic" },
  modalSaveBtn: { backgroundColor: C.accent, paddingVertical: 14, borderRadius: 999, alignItems: "center", marginTop: 8 },
  modalSaveBtnText: { fontSize: 15, fontWeight: "800", color: C.accentText, letterSpacing: -0.2 },
  modalCancelBtn: { paddingVertical: 12, alignItems: "center" },
  modalCancelText: { fontSize: 14, fontWeight: "600", color: C.muted },

  presetGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
  presetChip: { width: "30%", paddingVertical: 12, paddingHorizontal: 10, borderRadius: 14, backgroundColor: C.surfaceGray, borderWidth: 1.5, borderColor: C.border, alignItems: "center", gap: 2 },
  presetChipActive: { backgroundColor: C.navy, borderColor: C.navy },
  presetChipUsed: { opacity: 0.45 },
  presetShort: { fontSize: 15, fontWeight: "800", color: C.navy, letterSpacing: -0.2 },
  presetLabel: { fontSize: 11.5, fontWeight: "600", color: C.muted },
  presetUsedTag: { fontSize: 9.5, fontWeight: "700", color: C.muted, backgroundColor: C.border, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 999, marginTop: 2 },

  fieldLabel: { fontSize: 12, fontWeight: "700", color: C.navy, marginBottom: 6, letterSpacing: 0.1 },
  textInput: { backgroundColor: C.inputBg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: C.navy, marginBottom: 16, borderWidth: 1, borderColor: C.border },

  typeChip: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: C.surfaceGray, borderWidth: 1.5, borderColor: C.border, alignItems: "center", gap: 2, minWidth: 70 },
  typeChipActive: { backgroundColor: C.navy, borderColor: C.navy },
  typeChipLabel: { fontSize: 13, fontWeight: "800", color: C.navy },
  typeChipLabelActive: { color: C.white },
  typeChipCap: { fontSize: 10.5, fontWeight: "600", color: C.muted },
});
