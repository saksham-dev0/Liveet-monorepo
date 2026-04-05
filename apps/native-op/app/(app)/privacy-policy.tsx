import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../constants/theme";

/* ── Error Boundary ────────────────────────────────────────────────────────── */

type ErrorBoundaryState = { hasError: boolean };

class PrivacyPolicyErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("PrivacyPolicyErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={s.errorContainer} accessible accessibilityRole="alert">
          <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
          <Text style={s.errorTitle}>Something went wrong</Text>
          <Text style={s.errorBody}>
            We couldn't load the Privacy Policy. Please try again later.
          </Text>
          <TouchableOpacity
            style={s.retryBtn}
            onPress={() => this.setState({ hasError: false })}
            accessibilityRole="button"
            accessibilityLabel="Retry loading privacy policy"
          >
            <Text style={s.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

/* ── Screen ────────────────────────────────────────────────────────────────── */

function PrivacyPolicyContent() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[s.root, { paddingTop: insets.top }]} accessible={false}>
      {/* Header */}
      <View style={s.header} accessibilityRole="header">
        <TouchableOpacity
          onPress={() => router.back()}
          style={s.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={12}
        >
          <Ionicons name="arrow-back" size={22} color={colors.navy} />
        </TouchableOpacity>
        <Text style={s.headerTitle} accessibilityRole="header">
          Privacy Policy
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        accessibilityLabel="Privacy policy content"
      >
        <Text style={s.pageTitle} accessibilityRole="header">
          Our Terms and Policy
        </Text>
        <Text style={s.intro}>
          Welcome to Liveet. Your privacy and data security are important to us.
          This Privacy & Security Policy explains how we collect, use, store, and
          protect your information when you use our platform.
        </Text>

        {/* 1 */}
        <Text style={s.sectionTitle} accessibilityRole="header">
          1. Information We Collect
        </Text>
        <Text style={s.body}>
          When you use our platform, we may collect the following information:
        </Text>

        <Text style={s.subTitle} accessibilityRole="header">
          Personal Information
        </Text>
        <View accessibilityRole="list" accessibilityLabel="Personal information collected">
          <Text style={s.bullet} accessibilityRole="text">{"•  Full name"}</Text>
          <Text style={s.bullet} accessibilityRole="text">{"•  Email address"}</Text>
          <Text style={s.bullet} accessibilityRole="text">{"•  Phone number"}</Text>
          <Text style={s.bullet} accessibilityRole="text">{"•  Profile photo"}</Text>
          <Text style={s.bullet} accessibilityRole="text">{"•  Identification details (if required for verification)"}</Text>
        </View>

        <Text style={s.subTitle} accessibilityRole="header">
          Property Information
        </Text>
        <View accessibilityRole="list" accessibilityLabel="Property information collected">
          <Text style={s.bullet} accessibilityRole="text">{"•  Property listings"}</Text>
          <Text style={s.bullet} accessibilityRole="text">{"•  Property images"}</Text>
          <Text style={s.bullet} accessibilityRole="text">{"•  Location details"}</Text>
          <Text style={s.bullet} accessibilityRole="text">{"•  Pricing and availability"}</Text>
        </View>

        <Text style={s.subTitle} accessibilityRole="header">
          Tenant & Operator Data
        </Text>
        <View accessibilityRole="list" accessibilityLabel="Tenant and operator data collected">
          <Text style={s.bullet} accessibilityRole="text">{"•  Rental agreements"}</Text>
          <Text style={s.bullet} accessibilityRole="text">{"•  Booking history"}</Text>
          <Text style={s.bullet} accessibilityRole="text">{"•  Payment records"}</Text>
          <Text style={s.bullet} accessibilityRole="text">{"•  Communication between tenants and property owners"}</Text>
        </View>

        <Text style={s.subTitle} accessibilityRole="header">
          Device & Usage Data
        </Text>
        <Text style={s.body}>We may automatically collect:</Text>
        <View accessibilityRole="list" accessibilityLabel="Device and usage data collected">
          <Text style={s.bullet} accessibilityRole="text">{"•  Device type"}</Text>
          <Text style={s.bullet} accessibilityRole="text">{"•  Operating system"}</Text>
          <Text style={s.bullet} accessibilityRole="text">{"•  IP address"}</Text>
          <Text style={s.bullet} accessibilityRole="text">{"•  App usage data"}</Text>
          <Text style={s.bullet} accessibilityRole="text">{"•  Crash logs"}</Text>
        </View>
        <Text style={s.body}>
          This information helps us improve the reliability and performance of the
          platform.
        </Text>

        {/* 2 */}
        <Text style={s.sectionTitle} accessibilityRole="header">
          2. How We Use Your Information
        </Text>
        <Text style={s.body}>Your information is used to:</Text>
        <View accessibilityRole="list" accessibilityLabel="How your information is used">
          <Text style={s.bullet} accessibilityRole="text">{"•  Create and manage your account"}</Text>
          <Text style={s.bullet} accessibilityRole="text">{"•  Enable property listings and bookings"}</Text>
          <Text style={s.bullet} accessibilityRole="text">{"•  Facilitate communication between tenants and property operators"}</Text>
          <Text style={s.bullet} accessibilityRole="text">{"•  Process transactions and rental payments"}</Text>
          <Text style={s.bullet} accessibilityRole="text">{"•  Improve platform features and performance"}</Text>
          <Text style={s.bullet} accessibilityRole="text">{"•  Prevent fraud and ensure security"}</Text>
          <Text style={s.bullet} accessibilityRole="text">{"•  Provide customer support"}</Text>
        </View>
        <Text style={s.bodyBold} accessibilityRole="text">
          We do not sell your personal information to third parties.
        </Text>

        {/* 3 */}
        <Text style={s.sectionTitle} accessibilityRole="header">
          3. Data Security
        </Text>
        <Text style={s.body}>
          We take data protection seriously and implement industry-standard security
          measures including:
        </Text>
        <View accessibilityRole="list" accessibilityLabel="Security measures">
          <Text style={s.bullet} accessibilityRole="text">{"•  Encrypted data transmission (HTTPS / SSL)"}</Text>
          <Text style={s.bullet} accessibilityRole="text">{"•  Secure authentication systems"}</Text>
          <Text style={s.bullet} accessibilityRole="text">{"•  Access control for sensitive data"}</Text>
          <Text style={s.bullet} accessibilityRole="text">{"•  Secure cloud infrastructure"}</Text>
          <Text style={s.bullet} accessibilityRole="text">{"•  Regular system monitoring and updates"}</Text>
        </View>
        <Text style={s.body}>
          Despite these measures, no system can guarantee 100% security, but we
          continuously improve our protections.
        </Text>

        {/* 4 */}
        <Text style={s.sectionTitle} accessibilityRole="header">
          4. Data Sharing
        </Text>
        <Text style={s.body}>
          We may share your data only in the following cases:
        </Text>
        <View accessibilityRole="list" accessibilityLabel="Data sharing cases">
          <Text style={s.bullet} accessibilityRole="text">{"•  With property operators or tenants to facilitate bookings"}</Text>
          <Text style={s.bullet} accessibilityRole="text">{"•  With payment processors to complete transactions"}</Text>
          <Text style={s.bullet} accessibilityRole="text">{"•  With service providers who support our platform operations"}</Text>
          <Text style={s.bullet} accessibilityRole="text">{"•  When required by law or legal authorities"}</Text>
        </View>
        <Text style={s.body}>
          All partners and service providers are required to maintain strict
          confidentiality and security standards.
        </Text>

        {/* 5 */}
        <Text style={s.sectionTitle} accessibilityRole="header">
          5. Data Retention
        </Text>
        <Text style={s.body}>
          We retain your data only as long as necessary to:
        </Text>
        <View accessibilityRole="list" accessibilityLabel="Data retention purposes">
          <Text style={s.bullet} accessibilityRole="text">{"•  Provide services"}</Text>
          <Text style={s.bullet} accessibilityRole="text">{"•  Maintain legal and financial records"}</Text>
          <Text style={s.bullet} accessibilityRole="text">{"•  Resolve disputes"}</Text>
          <Text style={s.bullet} accessibilityRole="text">{"•  Enforce our agreements"}</Text>
        </View>
        <Text style={s.body}>
          Users may request deletion of their accounts and associated data by
          contacting support.
        </Text>

        {/* 6 */}
        <Text style={s.sectionTitle} accessibilityRole="header">
          6. User Rights
        </Text>
        <Text style={s.body}>You have the right to:</Text>
        <View accessibilityRole="list" accessibilityLabel="Your rights">
          <Text style={s.bullet} accessibilityRole="text">{"•  Access your personal data"}</Text>
          <Text style={s.bullet} accessibilityRole="text">{"•  Correct inaccurate information"}</Text>
          <Text style={s.bullet} accessibilityRole="text">{"•  Request deletion of your data"}</Text>
          <Text style={s.bullet} accessibilityRole="text">{"•  Withdraw consent for certain data uses"}</Text>
        </View>
        <Text style={s.body}>
          To make a request, contact us at support@liveet.org.
        </Text>

        {/* 7 */}
        <Text style={s.sectionTitle} accessibilityRole="header">
          7. Third-Party Services
        </Text>
        <Text style={s.body}>
          Our platform may use third-party services such as:
        </Text>
        <View accessibilityRole="list" accessibilityLabel="Third-party services used">
          <Text style={s.bullet} accessibilityRole="text">{"•  Payment gateways"}</Text>
          <Text style={s.bullet} accessibilityRole="text">{"•  Cloud hosting providers"}</Text>
          <Text style={s.bullet} accessibilityRole="text">{"•  Analytics tools"}</Text>
          <Text style={s.bullet} accessibilityRole="text">{"•  Authentication services"}</Text>
        </View>
        <Text style={s.body}>
          These services operate under their own privacy policies.
        </Text>

        {/* 8 */}
        <Text style={s.sectionTitle} accessibilityRole="header">
          8. Children's Privacy
        </Text>
        <Text style={s.body}>
          Our services are not intended for individuals under 18 years of age. We do
          not knowingly collect personal data from minors.
        </Text>

        {/* 9 */}
        <Text style={s.sectionTitle} accessibilityRole="header">
          9. Policy Updates
        </Text>
        <Text style={s.body}>
          We may update this Privacy Policy from time to time. Changes will be
          communicated through the app or website.
        </Text>

        {/* 10 */}
        <Text style={s.sectionTitle} accessibilityRole="header">
          10. Contact Us
        </Text>
        <Text style={s.body}>
          If you have any questions about this Privacy Policy, please contact us:
        </Text>
        <Text
          style={s.contactText}
          accessibilityRole="text"
          accessibilityLabel="Contact email: support@liveet.org"
        >
          Email: support@liveet.org
        </Text>
      </ScrollView>
    </View>
  );
}

export default function PrivacyPolicyScreen() {
  return (
    <PrivacyPolicyErrorBoundary>
      <PrivacyPolicyContent />
    </PrivacyPolicyErrorBoundary>
  );
}

/* ── Styles ────────────────────────────────────────────────────────────────── */

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.pageBg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.inputBg,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.navy,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.navy,
    marginBottom: 12,
  },
  intro: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.muted,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.navy,
    marginTop: 24,
    marginBottom: 10,
  },
  subTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.navy,
    marginTop: 14,
    marginBottom: 6,
  },
  body: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.muted,
    marginBottom: 8,
  },
  bodyBold: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.navy,
    fontWeight: "600",
    marginTop: 8,
    marginBottom: 8,
  },
  bullet: {
    fontSize: 14,
    lineHeight: 24,
    color: colors.muted,
    paddingLeft: 12,
  },
  contactText: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.primary,
    fontWeight: "600",
    marginTop: 4,
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    backgroundColor: colors.pageBg,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.navy,
    marginTop: 16,
    marginBottom: 8,
  },
  errorBody: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.muted,
    textAlign: "center",
    marginBottom: 24,
  },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  retryText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.white,
  },
});
