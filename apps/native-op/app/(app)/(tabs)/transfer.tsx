import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, card as cardStyle, cardShadow } from "../../../constants/theme";

const RECIPIENTS = [
  { id: "1", name: "Alex Johnson", handle: "@alexj", avatar: "person" },
  { id: "2", name: "Sam Wilson", handle: "@samw", avatar: "person" },
  { id: "3", name: "Jordan Lee", handle: "@jordanl", avatar: "person" },
];

const RECENT_TRANSFERS = [
  { id: "1", to: "Alex Johnson", amount: 50, date: "Today" },
  { id: "2", to: "Sam Wilson", amount: 120, date: "Yesterday" },
];

export default function TransferScreen() {
  return (
    <View style={s.container}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.header}>
          <Text style={s.title}>Transfer</Text>
          <TouchableOpacity style={s.iconBtn} activeOpacity={0.7}>
            <Ionicons name="search-outline" size={22} color={colors.black} />
          </TouchableOpacity>
        </View>

        <View style={[s.card, s.quickActions]}>
          <Text style={s.cardTitle}>Quick transfer</Text>
          <View style={s.recipientsRow}>
            {RECIPIENTS.map((r) => (
              <TouchableOpacity
                key={r.id}
                style={s.recipientItem}
                activeOpacity={0.7}
              >
                <View style={s.avatar}>
                  <Ionicons name="person" size={24} color={colors.muted} />
                </View>
                <Text style={s.recipientName} numberOfLines={1}>
                  {r.name.split(" ")[0]}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={s.addRecipient} activeOpacity={0.7}>
              <Ionicons name="add" size={28} color={colors.primary} />
              <Text style={s.addRecipientText}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[s.card, s.transferForm]}>
          <Text style={s.cardTitle}>New transfer</Text>
          <TouchableOpacity style={s.inputRow} activeOpacity={0.7}>
            <Ionicons name="person-outline" size={20} color={colors.muted} />
            <Text style={s.inputPlaceholder}>Select recipient</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </TouchableOpacity>
          <TouchableOpacity style={s.inputRow} activeOpacity={0.7}>
            <Ionicons name="cash-outline" size={20} color={colors.muted} />
            <Text style={s.inputPlaceholder}>Enter amount</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </TouchableOpacity>
          <TouchableOpacity style={s.primaryBtn} activeOpacity={0.7}>
            <Text style={s.primaryBtnText}>Send money</Text>
          </TouchableOpacity>
        </View>

        <View style={[s.card, s.recentCard]}>
          <Text style={s.cardTitle}>Recent transfers</Text>
          {RECENT_TRANSFERS.map((t, i) => (
            <View
              key={t.id}
              style={[
                s.transferRow,
                i === RECENT_TRANSFERS.length - 1 && s.transferRowLast,
              ]}
            >
              <View style={s.transferIconWrap}>
                <Ionicons name="arrow-up-outline" size={18} color={colors.primary} />
              </View>
              <View style={s.transferContent}>
                <Text style={s.transferTo}>{t.to}</Text>
                <Text style={s.transferDate}>{t.date}</Text>
              </View>
              <Text style={s.transferAmount}>-${t.amount}</Text>
            </View>
          ))}
        </View>

        <View style={s.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.pageBg,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.black,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  card: {
    ...cardStyle,
    marginBottom: 16,
  },
  quickActions: {
    padding: 20,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.black,
    marginBottom: 16,
  },
  recipientsRow: {
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
  },
  recipientItem: {
    alignItems: "center",
    minWidth: 64,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.inputBg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  recipientName: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.black,
  },
  addRecipient: {
    alignItems: "center",
    minWidth: 64,
  },
  addRecipientText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary,
    marginTop: 8,
  },
  transferForm: {
    padding: 20,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.inputBg,
    borderRadius: radii.input,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputPlaceholder: {
    flex: 1,
    fontSize: 15,
    color: colors.muted,
    marginLeft: 10,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 8,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.white,
  },
  recentCard: {
    padding: 20,
  },
  transferRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  transferRowLast: {
    borderBottomWidth: 0,
  },
  transferIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  transferContent: {
    flex: 1,
  },
  transferTo: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.black,
  },
  transferDate: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
  },
  transferAmount: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.error,
  },
  bottomSpacer: {
    height: 100,
  },
});
