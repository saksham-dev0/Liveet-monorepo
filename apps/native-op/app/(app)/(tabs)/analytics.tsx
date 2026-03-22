import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, card as cardStyle, cardShadow } from "../../../constants/theme";

const CHART_DATA = [
  { month: "Jan", value: 65 },
  { month: "Feb", value: 45 },
  { month: "Mar", value: 80 },
  { month: "Apr", value: 55 },
  { month: "May", value: 90 },
  { month: "Jun", value: 70 },
];
const MAX_CHART = 100;
const CHART_HEIGHT = 120;

const CATEGORIES = [
  { name: "Food & Dining", amount: 420, percent: 28, color: colors.spentCard },
  { name: "Shopping", amount: 310, percent: 21, color: colors.savedCard },
  { name: "Transport", amount: 180, percent: 12, color: colors.investedCard },
  { name: "Entertainment", amount: 250, percent: 17, color: colors.primary },
];

export default function AnalyticsScreen() {
  return (
    <View style={s.container}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.header}>
          <Text style={s.title}>Analytics</Text>
          <TouchableOpacity style={s.iconBtn} activeOpacity={0.7}>
            <Ionicons name="calendar-outline" size={22} color={colors.black} />
          </TouchableOpacity>
        </View>

        <View style={[s.card, s.overviewCard]}>
          <Text style={s.cardTitle}>Spending overview</Text>
          <Text style={s.periodLabel}>Last 6 months</Text>
          <View style={s.chartContainer}>
            {CHART_DATA.map((item, i) => (
              <View key={i} style={s.chartBarWrap}>
                <View
                  style={[
                    s.chartBar,
                    {
                      height: (item.value / MAX_CHART) * CHART_HEIGHT,
                      backgroundColor: colors.spentCard,
                    },
                  ]}
                />
              </View>
            ))}
          </View>
          <View style={s.chartLabels}>
            {CHART_DATA.map((item, i) => (
              <Text key={i} style={s.chartLabel}>
                {item.month}
              </Text>
            ))}
          </View>
        </View>

        <View style={[s.card, s.categoriesCard]}>
          <Text style={s.cardTitle}>By category</Text>
          {CATEGORIES.map((cat, i) => (
            <View
              key={i}
              style={[
                s.categoryRow,
                i === CATEGORIES.length - 1 && s.categoryRowLast,
              ]}
            >
              <View style={[s.categoryDot, { backgroundColor: cat.color }]} />
              <View style={s.categoryContent}>
                <Text style={s.categoryName}>{cat.name}</Text>
                <View style={s.categoryBarBg}>
                  <View
                    style={[s.categoryBarFill, { width: `${cat.percent}%`, backgroundColor: cat.color }]}
                  />
                </View>
              </View>
              <Text style={s.categoryAmount}>${cat.amount}</Text>
            </View>
          ))}
        </View>

        <View style={[s.card, s.insightsCard]}>
          <Text style={s.cardTitle}>Insights</Text>
          <View style={s.insightRow}>
            <View style={s.insightIconWrap}>
              <Ionicons name="trending-up" size={20} color={colors.positiveAmount} />
            </View>
            <View style={s.insightContent}>
              <Text style={s.insightTitle}>Spending down 12%</Text>
              <Text style={s.insightSub}>
                You spent less this month compared to last month
              </Text>
            </View>
          </View>
          <View style={s.insightRow}>
            <View style={[s.insightIconWrap, s.insightIconWarning]}>
              <Ionicons name="alert-circle-outline" size={20} color={colors.error} />
            </View>
            <View style={s.insightContent}>
              <Text style={s.insightTitle}>Food spending up</Text>
              <Text style={s.insightSub}>
                Consider setting a budget for dining out
              </Text>
            </View>
          </View>
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
  overviewCard: {
    padding: 20,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.black,
    marginBottom: 8,
  },
  periodLabel: {
    fontSize: 13,
    color: colors.muted,
    marginBottom: 16,
  },
  chartContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: CHART_HEIGHT + 8,
    gap: 8,
  },
  chartBarWrap: {
    flex: 1,
    height: "100%",
    justifyContent: "flex-end",
  },
  chartBar: {
    borderRadius: 8,
    minHeight: 16,
  },
  chartLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    paddingHorizontal: 2,
  },
  chartLabel: {
    flex: 1,
    fontSize: 11,
    color: colors.muted,
    textAlign: "center",
  },
  categoriesCard: {
    padding: 20,
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  categoryRowLast: {
    borderBottomWidth: 0,
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  categoryContent: {
    flex: 1,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.black,
    marginBottom: 6,
  },
  categoryBarBg: {
    height: 6,
    backgroundColor: colors.inputBg,
    borderRadius: 3,
    overflow: "hidden",
  },
  categoryBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  categoryAmount: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.black,
    marginLeft: 12,
  },
  insightsCard: {
    padding: 20,
  },
  insightRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  insightIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(5, 150, 105, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  insightIconWarning: {
    backgroundColor: "rgba(220, 38, 38, 0.15)",
  },
  insightContent: {
    flex: 1,
  },
  insightTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.black,
  },
  insightSub: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 4,
  },
  bottomSpacer: {
    height: 100,
  },
});
