import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useConvex } from "convex/react";
import { Ionicons } from "@expo/vector-icons";
import {
  colors,
  errorText,
  input,
  label,
  radii,
} from "../../../constants/theme";

type RoomOption = {
  _id: string;
  category: string;
  typeName?: string;
  numberOfRooms?: number;
};

type Room = {
  _id: string;
  floorId: string;
  roomOptionId?: string;
  roomNumber: string;
  displayName?: string;
  category?: string;
};

type Floor = {
  _id: string;
  floorNumber: number;
  label?: string;
  rooms: Room[];
};

type RoomOccupancy = {
  occupantCount: number;
  hasPendingPayment: boolean;
  hasPendingRent: boolean;
};

type UnassignedTenant = {
  applicationId: string;
  tenantName: string;
  phone: string;
  email: string;
  moveInDate: string;
};

function roomCapacity(category?: string): number {
  if (category === "double") return 2;
  if (category === "triple") return 3;
  if (category === "3plus") return 4;
  return 1;
}

const FLOOR_LABELS: Record<number, string> = {
  0: "Ground floor",
  1: "1st floor",
  2: "2nd floor",
  3: "3rd floor",
};

function floorLabel(n: number): string {
  return FLOOR_LABELS[n] ?? `${n}th floor`;
}

export default function RoomConfigScreen() {
  const router = useRouter();
  const convex = useConvex();
  const { propertyId: pidParam, fromProfile } = useLocalSearchParams<{
    propertyId?: string;
    fromProfile?: string;
  }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [propertyId, setPropertyId] = useState<string | null>(
    pidParam ?? null,
  );
  const [roomOptions, setRoomOptions] = useState<RoomOption[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [totalUnits, setTotalUnits] = useState<number>(0);

  const [roomOccupancies, setRoomOccupancies] = useState<Record<string, RoomOccupancy>>({});

  const [floorChoices, setFloorChoices] = useState<number[]>([0, 1, 2, 3, 4, 5]);
  const [selectedFloor, setSelectedFloor] = useState("0");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [numRooms, setNumRooms] = useState("");


  const [editModalRoom, setEditModalRoom] = useState<Room | null>(null);
  const [editModalNumber, setEditModalNumber] = useState("");
  const [editModalCategory, setEditModalCategory] = useState("");

  const [assigningRoom, setAssigningRoom] = useState<Room | null>(null);
  const [unassignedTenants, setUnassignedTenants] = useState<UnassignedTenant[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignSaving, setAssignSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const status = await (convex as any).query(
        "onboarding:getOnboardingStatus",
        {},
      );
      if (!status) return;
      const pid = pidParam || status.property?._id;
      if (pid) setPropertyId(pid);
      setTotalUnits(status.property?.totalUnits ?? 0);
      setRoomOptions(status.roomOptions ?? []);

      const allFloors: any[] = status.floors ?? [];
      const allRooms: Room[] = status.rooms ?? [];
      const floorMap: Floor[] = allFloors
        .sort((a: any, b: any) => a.floorNumber - b.floorNumber)
        .map((f: any) => ({
          ...f,
          rooms: allRooms
            .filter((r) => r.floorId === f._id)
            .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber)),
        }));
      setFloors(floorMap);

      if (allFloors.length > 0) {
        const maxExisting = Math.max(
          ...allFloors.map((f: any) => f.floorNumber),
        );
        setFloorChoices((prev) => {
          const highest = Math.max(...prev);
          if (maxExisting > highest) {
            const expanded = [...prev];
            for (let i = highest + 1; i <= maxExisting; i++) {
              expanded.push(i);
            }
            return expanded;
          }
          return prev;
        });
      }

      if (status.roomOptions?.length > 0 && !selectedCategory) {
        setSelectedCategory(status.roomOptions[0]._id);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [convex, pidParam, selectedCategory]);

  const loadOccupancy = useCallback(async () => {
    try {
      const assignments: Array<{
        roomId: string;
        hasPendingPayment: boolean;
        isRentDue: boolean;
      }> = await (convex as any).query("onboarding:listActiveRoomAssignments", {});
      if (!Array.isArray(assignments)) return;
      const map: Record<string, RoomOccupancy> = {};
      for (const a of assignments) {
        if (!map[a.roomId]) {
          map[a.roomId] = { occupantCount: 0, hasPendingPayment: false, hasPendingRent: false };
        }
        map[a.roomId].occupantCount++;
        if (a.hasPendingPayment) map[a.roomId].hasPendingPayment = true;
        if (a.isRentDue) map[a.roomId].hasPendingRent = true;
      }
      setRoomOccupancies(map);
    } catch {
      // silently fail — rooms just show without colour
    }
  }, [convex]);

  const openAssignModal = useCallback(async (room: Room) => {
    setAssigningRoom(room);
    setAssignLoading(true);
    try {
      const tenants: UnassignedTenant[] = await (convex as any).query(
        "onboarding:listUnassignedTenants",
        {},
      );
      setUnassignedTenants(Array.isArray(tenants) ? tenants : []);
    } catch {
      setUnassignedTenants([]);
    } finally {
      setAssignLoading(false);
    }
  }, [convex]);

  const handleAssignTenant = async (applicationId: string) => {
    if (!assigningRoom) return;
    setAssignSaving(true);
    try {
      await (convex as any).mutation("onboarding:assignRoomToTenant", {
        applicationId,
        roomId: assigningRoom._id,
      });
      await loadOccupancy();
      setAssigningRoom(null);
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed to assign room.");
    } finally {
      setAssignSaving(false);
    }
  };

  useEffect(() => {
    loadData();
    loadOccupancy();
  }, [loadData, loadOccupancy]);

  const currentRoomCount = floors.reduce((sum, f) => sum + f.rooms.length, 0);
  const roomsRemaining = Math.max(0, totalUnits - currentRoomCount);
  const atCapacity = totalUnits > 0 && roomsRemaining <= 0;
  const noTotalUnits = totalUnits <= 0;
  const canAddRooms = !noTotalUnits && !atCapacity;

  const handleAddRooms = async () => {
    if (!propertyId) return;
    const count = parseInt(numRooms, 10);
    if (!count || count < 1) {
      setError("Enter number of rooms to add.");
      return;
    }
    const floorNum = parseInt(selectedFloor, 10);
    if (Number.isNaN(floorNum) || floorNum < 0) {
      setError("Select a valid floor.");
      return;
    }
    if (totalUnits > 0 && count > roomsRemaining) {
      setError(
        `You can add at most ${roomsRemaining} more room${roomsRemaining !== 1 ? "s" : ""} (${totalUnits} total units).`,
      );
      return;
    }

    const selectedOption = roomOptions.find((o) => o._id === selectedCategory);

    setSaving(true);
    setError(null);
    try {
      const result = await (convex as any).mutation(
        "onboarding:addFloorWithRooms",
        {
          propertyId,
          floorNumber: floorNum,
          roomOptionId: selectedOption?._id,
          category: selectedOption?.category,
          numberOfRooms: count,
        },
      );

      const prefix = floorNum * 100;
      const existingFloor = floors.find((f) => f.floorNumber === floorNum);
      const startIndex = existingFloor?.rooms.length ?? 0;

      const newRooms: Room[] = result.roomIds.map(
        (id: string, i: number) => ({
          _id: id,
          floorId: result.floorId,
          roomOptionId: selectedOption?._id,
          roomNumber: String(prefix + startIndex + i + 1).padStart(3, "0"),
          category: selectedOption?.category,
        }),
      );

      setFloors((prev) => {
        const idx = prev.findIndex((f) => f._id === result.floorId);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = {
            ...updated[idx],
            rooms: [...updated[idx].rooms, ...newRooms],
          };
          return updated;
        }
        return [
          ...prev,
          {
            _id: result.floorId,
            floorNumber: floorNum,
            label: floorLabel(floorNum),
            rooms: newRooms,
          },
        ].sort((a, b) => a.floorNumber - b.floorNumber);
      });

      setNumRooms("");
      void loadOccupancy();
    } catch (err: any) {
      setError(err?.message ?? "Failed to add rooms.");
    } finally {
      setSaving(false);
    }
  };

  const handleEditRoomSave = async () => {
    if (!editModalRoom || !editModalNumber.trim()) return;
    setSaving(true);
    try {
      const selectedOption = roomOptions.find((o) => o._id === editModalCategory);
      await (convex as any).mutation("onboarding:updateRoom", {
        roomId: editModalRoom._id,
        roomNumber: editModalNumber.trim(),
        roomOptionId: selectedOption?._id,
        category: selectedOption?.category,
      });
      setFloors((prev) =>
        prev.map((f) => ({
          ...f,
          rooms: f.rooms.map((r) =>
            r._id === editModalRoom._id
              ? {
                  ...r,
                  roomNumber: editModalNumber.trim(),
                  roomOptionId: selectedOption?._id,
                  category: selectedOption?.category,
                }
              : r,
          ),
        })),
      );
      setEditModalRoom(null);
    } catch {
      setError("Failed to update room.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRoom = (room: Room) => {
    Alert.alert("Delete room", `Delete room ${room.roomNumber}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await (convex as any).mutation("onboarding:deleteRoom", {
              roomId: room._id,
            });
            setFloors((prev) =>
              prev.map((f) => ({
                ...f,
                rooms: f.rooms.filter((r) => r._id !== room._id),
              })),
            );
          } catch {
            setError("Failed to delete room.");
          }
        },
      },
    ]);
  };

  const handleDeleteFloor = (floor: Floor) => {
    Alert.alert(
      "Delete floor",
      `Delete ${floor.label ?? `Floor ${floor.floorNumber}`} and all its rooms?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await (convex as any).mutation("onboarding:deleteFloor", {
                floorId: floor._id,
              });
              setFloors((prev) => prev.filter((f) => f._id !== floor._id));
            } catch {
              setError("Failed to delete floor.");
            }
          },
        },
      ],
    );
  };

  const handleProceed = () => {
    if (!propertyId) return;
    if (fromProfile === "true") {
      router.back();
    } else {
      router.push({
        pathname: "/(onboarding)/property/agreement",
        params: { propertyId },
      } as any);
    }
  };

  const handleSkip = () => {
    if (!propertyId) return;
    if (fromProfile === "true") {
      router.back();
    } else {
      router.push({
        pathname: "/(onboarding)/property/agreement",
        params: { propertyId },
      } as any);
    }
  };

  const categoryOptions = roomOptions.map((o) => ({
    id: o._id,
    label: o.typeName
      ? `${o.typeName} (${o.category})`
      : o.category === "single"
        ? "Single"
        : o.category === "double"
          ? "Double"
          : o.category === "triple"
            ? "Triple"
            : "3+ sharing",
  }));

  const totalRooms = floors.reduce((sum, f) => sum + f.rooms.length, 0);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.headerAction}>{"\u2190"} Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Room configuration</Text>
        {fromProfile === "true" ? (
          <View style={styles.headerPlaceholder} />
        ) : (
          <TouchableOpacity onPress={handleSkip}>
            <Text style={styles.skipText}>Do it later</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loadingCenter}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Add rooms to a floor</Text>
              <Text style={styles.helper}>
                Rooms are auto-numbered per floor (e.g. 001, 101, 201). You can
                rename them after adding.
              </Text>
              {noTotalUnits ? (
                <Text style={styles.unitsHelper}>
                  Set total units in property basic details first to add rooms.
                </Text>
              ) : (
                <Text style={styles.unitsHelper}>
                  {currentRoomCount} of {totalUnits} units used
                  {roomsRemaining > 0
                    ? ` · You can add up to ${roomsRemaining} more room${roomsRemaining !== 1 ? "s" : ""}`
                    : " · All units configured"}
                </Text>
              )}

              {error ? <Text style={errorText}>{error}</Text> : null}

              <Text style={label}>Floor</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
              >
                {floorChoices.map((n) => (
                  <TouchableOpacity
                    key={n}
                    style={[
                      styles.chip,
                      selectedFloor === String(n) && styles.chipActive,
                    ]}
                    onPress={() => setSelectedFloor(String(n))}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selectedFloor === String(n) && styles.chipTextActive,
                      ]}
                    >
                      {n === 0 ? "Ground" : `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={styles.addFloorChip}
                  onPress={() => {
                    const next = Math.max(...floorChoices) + 1;
                    setFloorChoices((prev) => [...prev, next]);
                    setSelectedFloor(String(next));
                  }}
                >
                  <Text style={styles.addFloorChipText}>+ Floor</Text>
                </TouchableOpacity>
              </ScrollView>

              <Text style={label}>Room type</Text>
              {categoryOptions.length === 0 ? (
                <Text style={styles.helper}>
                  Add room options first from the previous step.
                </Text>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipRow}
                >
                  {categoryOptions.map((opt) => (
                    <TouchableOpacity
                      key={opt.id}
                      style={[
                        styles.chip,
                        selectedCategory === opt.id && styles.chipActive,
                      ]}
                      onPress={() => setSelectedCategory(opt.id)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          selectedCategory === opt.id && styles.chipTextActive,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              <Text style={label}>Number of rooms</Text>
              <View style={styles.addRow}>
                <TextInput
                  style={[input, styles.numInput]}
                  placeholder="e.g. 5"
                  placeholderTextColor={colors.muted}
                  keyboardType="number-pad"
                  value={numRooms}
                  onChangeText={setNumRooms}
                />
                <TouchableOpacity
                  style={[
                    styles.addButton,
                    (!canAddRooms || saving || categoryOptions.length === 0) &&
                      styles.addButtonDisabled,
                  ]}
                  onPress={handleAddRooms}
                  disabled={
                    !canAddRooms || saving || categoryOptions.length === 0
                  }
                >
                  <Text
                    style={[
                      styles.addButtonText,
                      (!canAddRooms || atCapacity) &&
                        styles.addButtonTextDisabled,
                    ]}
                  >
                    {saving
                      ? "Adding..."
                      : noTotalUnits
                        ? "Set total units first"
                        : atCapacity
                          ? "All units used"
                          : "+ Add rooms"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {floors.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  Floor plan ({totalRooms} room{totalRooms !== 1 ? "s" : ""})
                </Text>

                {floors.map((floor) => (
                  <View key={floor._id} style={styles.floorCard}>
                    <View style={styles.floorHeader}>
                      <Text style={styles.floorLabel}>
                        {floor.label ?? floorLabel(floor.floorNumber)} ·{" "}
                        {floor.rooms.length} room
                        {floor.rooms.length !== 1 ? "s" : ""}
                      </Text>
                      <TouchableOpacity
                        onPress={() => handleDeleteFloor(floor)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={styles.deleteFloorText}>Delete</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.roomGrid}>
                      {floor.rooms.map((room) => {
                        const occ = roomOccupancies[room._id];
                        const count = occ?.occupantCount ?? 0;
                        const cap = roomCapacity(room.category);
                        const hasDue = occ?.hasPendingPayment || occ?.hasPendingRent;
                        const chipColor =
                          count === 0
                            ? {}
                            : count >= cap
                            ? styles.roomChipFull
                            : styles.roomChipPartial;
                        return (
                        <View key={room._id} style={[styles.roomChip, chipColor]}>
                          <TouchableOpacity
                            style={styles.roomChipInner}
                            onPress={() => openAssignModal(room)}
                          >
                            <Text style={styles.roomNumber}>
                              {room.roomNumber}
                            </Text>
                            <Text style={styles.roomCat}>
                              {room.category
                                ? room.category.charAt(0).toUpperCase()
                                : ""}
                            </Text>
                            {hasDue && (
                              <Ionicons
                                name="hourglass-outline"
                                size={10}
                                color={colors.muted}
                                style={{ marginTop: 2 }}
                              />
                            )}
                          </TouchableOpacity>
                          <View style={styles.roomChipActions}>
                            <TouchableOpacity
                              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                              onPress={() => {
                                setEditModalRoom(room);
                                setEditModalNumber(room.roomNumber);
                                setEditModalCategory(room.roomOptionId ?? "");
                              }}
                            >
                              <Ionicons name="pencil-outline" size={11} color={colors.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                              onPress={() => handleDeleteRoom(room)}
                            >
                              <Ionicons name="trash-outline" size={11} color={colors.error} />
                            </TouchableOpacity>
                          </View>
                        </View>
                        );
                      })}
                    </View>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.footerButtons}>
              <TouchableOpacity
                style={styles.proceedButton}
                onPress={handleProceed}
              >
                <Text style={styles.proceedButtonText}>
                  {floors.length > 0 ? "Save & proceed" : "Skip for now"}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>

      <Modal
        visible={!!editModalRoom}
        animationType="slide"
        transparent
        onRequestClose={() => setEditModalRoom(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit room</Text>
              <TouchableOpacity onPress={() => setEditModalRoom(null)}>
                <Ionicons name="close" size={22} color={colors.navy} />
              </TouchableOpacity>
            </View>

            <View style={styles.editModalBody}>
              <Text style={label}>Room number</Text>
              <TextInput
                style={[input, { marginBottom: 16 }]}
                value={editModalNumber}
                onChangeText={setEditModalNumber}
                autoCorrect={false}
                autoCapitalize="characters"
                returnKeyType="done"
              />

              <Text style={label}>Room type</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
              >
                {categoryOptions.map((opt) => (
                  <TouchableOpacity
                    key={opt.id}
                    style={[
                      styles.chip,
                      editModalCategory === opt.id && styles.chipActive,
                    ]}
                    onPress={() => setEditModalCategory(opt.id)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        editModalCategory === opt.id && styles.chipTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TouchableOpacity
                style={[styles.proceedButton, { marginTop: 24 }]}
                onPress={handleEditRoomSave}
                disabled={saving || !editModalNumber.trim()}
              >
                <Text style={styles.proceedButtonText}>
                  {saving ? "Saving..." : "Save changes"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!assigningRoom}
        animationType="slide"
        transparent
        onRequestClose={() => setAssigningRoom(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Assign tenant to room {assigningRoom?.roomNumber}
              </Text>
              <TouchableOpacity onPress={() => setAssigningRoom(null)}>
                <Ionicons name="close" size={22} color={colors.navy} />
              </TouchableOpacity>
            </View>

            {assignLoading ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : unassignedTenants.length === 0 ? (
              <View style={styles.modalEmpty}>
                <Text style={styles.modalEmptyText}>
                  No unassigned tenants found.{"\n"}Onboard a tenant first before assigning a room.
                </Text>
              </View>
            ) : (
              <ScrollView
                style={styles.tenantList}
                showsVerticalScrollIndicator={false}
              >
                {unassignedTenants.map((tenant) => (
                  <TouchableOpacity
                    key={tenant.applicationId}
                    style={styles.tenantRow}
                    onPress={() => handleAssignTenant(tenant.applicationId)}
                    disabled={assignSaving}
                  >
                    <View style={styles.tenantInfo}>
                      <Text style={styles.tenantName}>{tenant.tenantName}</Text>
                      {!!tenant.phone && (
                        <Text style={styles.tenantMeta}>{tenant.phone}</Text>
                      )}
                      {!!tenant.moveInDate && (
                        <Text style={styles.tenantMeta}>Move-in: {tenant.moveInDate}</Text>
                      )}
                    </View>
                    {assignSaving ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
    paddingTop: 4,
    paddingHorizontal: 20,
  },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 40 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  headerAction: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: "600",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.navy,
  },
  skipText: {
    fontSize: 13,
    color: colors.muted,
    fontWeight: "600",
  },
  headerPlaceholder: {
    minWidth: 72,
  },
  loadingCenter: { minHeight: 120, alignItems: "center", justifyContent: "center" },
  section: { marginTop: 8, marginBottom: 16 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.navy,
    marginBottom: 4,
  },
  helper: {
    fontSize: 12,
    color: colors.muted,
    marginBottom: 10,
    lineHeight: 17,
  },
  chipRow: { gap: 8, paddingVertical: 4 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: { fontSize: 13, fontWeight: "500", color: colors.navy },
  chipTextActive: { color: colors.white },
  addFloorChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderStyle: "dashed",
    backgroundColor: colors.white,
  },
  addFloorChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primary,
  },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  numInput: { flex: 1 },
  addButton: {
    borderRadius: radii.pill,
    paddingHorizontal: 18,
    paddingVertical: 13,
    backgroundColor: colors.primary,
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.white,
  },
  addButtonDisabled: {
    backgroundColor: colors.primaryLight,
  },
  addButtonTextDisabled: {
    color: colors.muted,
  },
  unitsHelper: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.muted,
    marginBottom: 10,
  },
  floorCard: {
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
    overflow: "hidden",
  },
  floorHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  floorLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.navy,
  },
  deleteFloorText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.error,
  },
  roomGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 10,
    gap: 8,
  },
  roomChip: {
    minWidth: 64,
    borderRadius: 10,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  roomChipFull: {
    backgroundColor: "#D1FAE5",
    borderColor: "#6EE7B7",
  },
  roomChipPartial: {
    backgroundColor: "#FEF9C3",
    borderColor: "#FDE68A",
  },
  roomChipInner: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
  },
  roomNumber: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.navy,
  },
  roomCat: {
    fontSize: 10,
    color: colors.muted,
    marginTop: 1,
  },
  editRoomRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 4,
  },
  roomEditInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: colors.navy,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  roomEditDone: {
    padding: 6,
  },
  roomEditDoneText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.primary,
  },
  footerButtons: { marginTop: 24, gap: 12 },
  proceedButton: {
    borderRadius: radii.pill,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: colors.primary,
  },
  proceedButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.white,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "70%",
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.navy,
    flex: 1,
    marginRight: 12,
  },
  modalLoading: {
    paddingVertical: 40,
    alignItems: "center",
  },
  modalEmpty: {
    paddingHorizontal: 20,
    paddingVertical: 32,
    alignItems: "center",
  },
  modalEmptyText: {
    fontSize: 14,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 20,
  },
  tenantList: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  tenantRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  tenantInfo: { flex: 1 },
  tenantName: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.navy,
  },
  tenantMeta: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  roomChipActions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    paddingBottom: 6,
    paddingTop: 2,
  },
  editModalBody: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
});
