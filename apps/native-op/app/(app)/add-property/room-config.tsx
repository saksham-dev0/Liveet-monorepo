import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
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
import { colors, errorText, input, label, radii } from "../../../constants/theme";

type RoomOption = { _id: string; category: string; typeName?: string; numberOfRooms?: number };
type Room = { _id: string; floorId: string; roomOptionId?: string; roomNumber: string; displayName?: string; category?: string };
type Floor = { _id: string; floorNumber: number; label?: string; rooms: Room[] };

const FLOOR_LABELS: Record<number, string> = { 0: "Ground floor", 1: "1st floor", 2: "2nd floor", 3: "3rd floor" };
function floorLabel(n: number): string { return FLOOR_LABELS[n] ?? `${n}th floor`; }

export default function AddPropertyRoomConfigScreen() {
  const router = useRouter();
  const convex = useConvex();
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roomOptions, setRoomOptions] = useState<RoomOption[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [totalUnits, setTotalUnits] = useState(0);
  const [floorChoices, setFloorChoices] = useState<number[]>([0, 1, 2, 3, 4, 5]);
  const [selectedFloor, setSelectedFloor] = useState("0");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [numRooms, setNumRooms] = useState("");
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [editingRoomNumber, setEditingRoomNumber] = useState("");

  const load = useCallback(async () => {
    if (!propertyId) return;
    try {
      const data = await (convex as any).query("onboarding:getPropertyFlowData", { propertyId });
      if (!data) return;
      setTotalUnits(data.property?.totalUnits ?? 0);
      setRoomOptions(data.roomOptions ?? []);

      const allFloors: any[] = data.floors ?? [];
      const allRooms: Room[] = data.rooms ?? [];
      const floorMap: Floor[] = allFloors
        .sort((a: any, b: any) => a.floorNumber - b.floorNumber)
        .map((f: any) => ({
          ...f,
          rooms: allRooms.filter((r) => r.floorId === f._id).sort((a, b) => a.roomNumber.localeCompare(b.roomNumber)),
        }));
      setFloors(floorMap);

      if (allFloors.length > 0) {
        const maxExisting = Math.max(...allFloors.map((f: any) => f.floorNumber));
        setFloorChoices((prev) => {
          const highest = Math.max(...prev);
          if (maxExisting > highest) {
            const expanded = [...prev];
            for (let i = highest + 1; i <= maxExisting; i++) expanded.push(i);
            return expanded;
          }
          return prev;
        });
      }

    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [convex, propertyId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (roomOptions.length > 0 && !selectedCategory) {
      setSelectedCategory(roomOptions[0]._id);
    }
  }, [roomOptions, selectedCategory]);

  const currentRoomCount = floors.reduce((sum, f) => sum + f.rooms.length, 0);
  const roomsRemaining = Math.max(0, totalUnits - currentRoomCount);
  const atCapacity = totalUnits > 0 && roomsRemaining <= 0;
  const noTotalUnits = totalUnits <= 0;
  const canAddRooms = !noTotalUnits && !atCapacity;

  const handleAddRooms = async () => {
    if (!propertyId) return;
    const count = parseInt(numRooms, 10);
    if (!count || count < 1) { setError("Enter number of rooms to add."); return; }
    const floorNum = parseInt(selectedFloor, 10);
    if (Number.isNaN(floorNum) || floorNum < 0) { setError("Select a valid floor."); return; }
    if (totalUnits > 0 && count > roomsRemaining) {
      setError(`You can add at most ${roomsRemaining} more room${roomsRemaining !== 1 ? "s" : ""}.`);
      return;
    }
    const selectedOption = roomOptions.find((o) => o._id === selectedCategory);
    setSaving(true); setError(null);
    try {
      const result = await (convex as any).mutation("onboarding:addFloorWithRooms", {
        propertyId, floorNumber: floorNum,
        roomOptionId: selectedOption?._id,
        category: selectedOption?.category,
        numberOfRooms: count,
      });
      const prefix = floorNum * 100;
      const existingFloor = floors.find((f) => f.floorNumber === floorNum);
      const startIndex = existingFloor?.rooms.length ?? 0;
      const newRooms: Room[] = result.roomIds.map((id: string, i: number) => ({
        _id: id, floorId: result.floorId,
        roomOptionId: selectedOption?._id,
        roomNumber: String(prefix + startIndex + i + 1).padStart(3, "0"),
        category: selectedOption?.category,
      }));
      setFloors((prev) => {
        const idx = prev.findIndex((f) => f._id === result.floorId);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], rooms: [...updated[idx].rooms, ...newRooms] };
          return updated;
        }
        return [...prev, { _id: result.floorId, floorNumber: floorNum, label: floorLabel(floorNum), rooms: newRooms }].sort((a, b) => a.floorNumber - b.floorNumber);
      });
      setNumRooms("");
    } catch (err: any) {
      setError(err?.message ?? "Failed to add rooms.");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateRoom = async () => {
    if (!editingRoomId || !editingRoomNumber.trim()) return;
    setSaving(true);
    try {
      await (convex as any).mutation("onboarding:updateRoom", { roomId: editingRoomId, roomNumber: editingRoomNumber.trim() });
      setFloors((prev) => prev.map((f) => ({ ...f, rooms: f.rooms.map((r) => r._id === editingRoomId ? { ...r, roomNumber: editingRoomNumber.trim() } : r) })));
      setEditingRoomId(null); setEditingRoomNumber("");
    } catch { setError("Failed to update room."); }
    finally { setSaving(false); }
  };

  const handleDeleteRoom = (room: Room) => {
    Alert.alert("Delete room", `Delete room ${room.roomNumber}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try {
          await (convex as any).mutation("onboarding:deleteRoom", { roomId: room._id });
          setFloors((prev) => prev.map((f) => ({ ...f, rooms: f.rooms.filter((r) => r._id !== room._id) })));
        } catch { setError("Failed to delete room."); }
      }},
    ]);
  };

  const handleDeleteFloor = (floor: Floor) => {
    Alert.alert("Delete floor", `Delete ${floor.label ?? `Floor ${floor.floorNumber}`} and all its rooms?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try {
          await (convex as any).mutation("onboarding:deleteFloor", { floorId: floor._id });
          setFloors((prev) => prev.filter((f) => f._id !== floor._id));
        } catch { setError("Failed to delete floor."); }
      }},
    ]);
  };

  const categoryOptions = roomOptions.map((o) => ({
    id: o._id,
    label: o.typeName
      ? `${o.typeName} (${o.category})`
      : o.category === "single" ? "Single"
      : o.category === "double" ? "Double"
      : o.category === "triple" ? "Triple"
      : "3+ sharing",
  }));

  const totalRooms = floors.reduce((sum, f) => sum + f.rooms.length, 0);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.headerAction}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Room configuration</Text>
        <TouchableOpacity onPress={() => router.push({ pathname: "/(app)/add-property/agreement", params: { propertyId } } as any)}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingCenter}><ActivityIndicator color={colors.primary} /></View>
        ) : (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Add rooms to a floor</Text>
              <Text style={styles.helper}>Rooms are auto-numbered per floor (e.g. 001, 101). You can rename them after adding.</Text>
              {noTotalUnits ? (
                <Text style={styles.unitsHelper}>Set total units in basic details first.</Text>
              ) : (
                <Text style={styles.unitsHelper}>{currentRoomCount} of {totalUnits} units used{roomsRemaining > 0 ? ` · ${roomsRemaining} more available` : " · All units configured"}</Text>
              )}

              {error ? <Text style={errorText}>{error}</Text> : null}

              <Text style={label}>Floor</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {floorChoices.map((n) => (
                  <TouchableOpacity key={n} style={[styles.chip, selectedFloor === String(n) && styles.chipActive]} onPress={() => setSelectedFloor(String(n))}>
                    <Text style={[styles.chipText, selectedFloor === String(n) && styles.chipTextActive]}>
                      {n === 0 ? "Ground" : `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={styles.addFloorChip} onPress={() => { const next = Math.max(...floorChoices) + 1; setFloorChoices((prev) => [...prev, next]); setSelectedFloor(String(next)); }}>
                  <Text style={styles.addFloorChipText}>+ Floor</Text>
                </TouchableOpacity>
              </ScrollView>

              <Text style={label}>Room type</Text>
              {categoryOptions.length === 0 ? (
                <Text style={styles.helper}>Add room options first from the previous step.</Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                  {categoryOptions.map((opt) => (
                    <TouchableOpacity key={opt.id} style={[styles.chip, selectedCategory === opt.id && styles.chipActive]} onPress={() => setSelectedCategory(opt.id)}>
                      <Text style={[styles.chipText, selectedCategory === opt.id && styles.chipTextActive]}>{opt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              <Text style={label}>Number of rooms</Text>
              <View style={styles.addRow}>
                <TextInput style={[input, styles.numInput]} placeholder="e.g. 5" placeholderTextColor={colors.muted} keyboardType="number-pad" value={numRooms} onChangeText={setNumRooms} />
                <TouchableOpacity style={[styles.addButton, (!canAddRooms || saving || categoryOptions.length === 0) && styles.addButtonDisabled]} onPress={handleAddRooms} disabled={!canAddRooms || saving || categoryOptions.length === 0}>
                  <Text style={[styles.addButtonText, (!canAddRooms || atCapacity) && styles.addButtonTextDisabled]}>
                    {saving ? "Adding…" : noTotalUnits ? "Set total units first" : atCapacity ? "All units used" : "+ Add rooms"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {floors.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Floor plan ({totalRooms} room{totalRooms !== 1 ? "s" : ""})</Text>
                {floors.map((floor) => (
                  <View key={floor._id} style={styles.floorCard}>
                    <View style={styles.floorHeader}>
                      <Text style={styles.floorLabel}>{floor.label ?? floorLabel(floor.floorNumber)} · {floor.rooms.length} room{floor.rooms.length !== 1 ? "s" : ""}</Text>
                      <TouchableOpacity onPress={() => handleDeleteFloor(floor)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Text style={styles.deleteFloorText}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.roomGrid}>
                      {floor.rooms.map((room) => (
                        <View key={room._id} style={styles.roomChip}>
                          {editingRoomId === room._id ? (
                            <View style={styles.editRoomRow}>
                              <TextInput style={styles.roomEditInput} value={editingRoomNumber} onChangeText={setEditingRoomNumber} autoFocus selectTextOnFocus onSubmitEditing={handleUpdateRoom} returnKeyType="done" />
                              <TouchableOpacity onPress={handleUpdateRoom} style={styles.roomEditDone}>
                                <Text style={styles.roomEditDoneText}>✓</Text>
                              </TouchableOpacity>
                            </View>
                          ) : (
                            <TouchableOpacity style={styles.roomChipInner} onPress={() => { setEditingRoomId(room._id); setEditingRoomNumber(room.roomNumber); }} onLongPress={() => handleDeleteRoom(room)}>
                              <Text style={styles.roomNumber}>{room.roomNumber}</Text>
                              <Text style={styles.roomCat}>{room.category ? room.category.charAt(0).toUpperCase() : ""}</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.footerButtons}>
              <TouchableOpacity style={styles.proceedButton} onPress={() => router.push({ pathname: "/(app)/add-property/agreement", params: { propertyId } } as any)}>
                <Text style={styles.proceedButtonText}>{floors.length > 0 ? "Save & proceed" : "Skip for now"}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, paddingTop: 4, paddingHorizontal: 20 },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 40 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12, paddingTop: 52 },
  headerAction: { fontSize: 14, color: colors.primary, fontWeight: "600" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: colors.navy },
  skipText: { fontSize: 13, color: colors.muted, fontWeight: "600" },
  loadingCenter: { minHeight: 120, alignItems: "center", justifyContent: "center" },
  section: { marginTop: 8, marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: "600", color: colors.navy, marginBottom: 4 },
  helper: { fontSize: 12, color: colors.muted, marginBottom: 10, lineHeight: 17 },
  unitsHelper: { fontSize: 12, fontWeight: "500", color: colors.muted, marginBottom: 10 },
  chipRow: { gap: 8, paddingVertical: 4 },
  chip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: radii.pill, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.inputBg },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: "500", color: colors.navy },
  chipTextActive: { color: colors.white },
  addFloorChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radii.pill, borderWidth: 1.5, borderColor: colors.primary, borderStyle: "dashed", backgroundColor: colors.white },
  addFloorChipText: { fontSize: 13, fontWeight: "600", color: colors.primary },
  addRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  numInput: { flex: 1 },
  addButton: { borderRadius: radii.pill, paddingHorizontal: 18, paddingVertical: 13, backgroundColor: colors.primary },
  addButtonText: { fontSize: 13, fontWeight: "600", color: colors.white },
  addButtonDisabled: { backgroundColor: colors.primaryLight },
  addButtonTextDisabled: { color: colors.muted },
  floorCard: { marginTop: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.inputBg, overflow: "hidden" },
  floorHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  floorLabel: { fontSize: 14, fontWeight: "600", color: colors.navy },
  deleteFloorText: { fontSize: 12, fontWeight: "600", color: colors.error },
  roomGrid: { flexDirection: "row", flexWrap: "wrap", padding: 10, gap: 8 },
  roomChip: { minWidth: 64, borderRadius: 10, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  roomChipInner: { paddingHorizontal: 12, paddingVertical: 8, alignItems: "center" },
  roomNumber: { fontSize: 14, fontWeight: "600", color: colors.navy },
  roomCat: { fontSize: 10, color: colors.muted, marginTop: 1 },
  editRoomRow: { flexDirection: "row", alignItems: "center", paddingRight: 4 },
  roomEditInput: { flex: 1, fontSize: 14, fontWeight: "600", color: colors.navy, paddingHorizontal: 10, paddingVertical: 7 },
  roomEditDone: { padding: 6 },
  roomEditDoneText: { fontSize: 16, fontWeight: "700", color: colors.primary },
  footerButtons: { marginTop: 24, gap: 12 },
  proceedButton: { borderRadius: radii.pill, paddingVertical: 14, alignItems: "center", backgroundColor: colors.primary },
  proceedButtonText: { fontSize: 16, fontWeight: "600", color: colors.white },
});
