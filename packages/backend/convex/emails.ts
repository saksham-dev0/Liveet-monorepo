import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { Resend } from "resend";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY not set in Convex environment");
  return new Resend(key);
}

export const sendInviteEmail = internalAction({
  args: {
    toEmail: v.string(),
    propertyName: v.string(),
    inviterName: v.string(),
    token: v.string(),
  },
  handler: async (_ctx, args) => {
    const resend = getResend();

    const { error } = await resend.emails.send({
      from: "Liveet <onboarding@livoza.org>",
      to: args.toEmail,
      subject: `${args.inviterName} invited you to manage ${args.propertyName}`,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#EEF2F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#ffffff;border-radius:20px;overflow:hidden">

        <!-- Header -->
        <tr>
          <td style="background:#1E293B;padding:32px 32px 24px">
            <p style="margin:0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px">
              LIVEET
            </p>
            <p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,0.55)">
              Property Management
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px">
            <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1E293B;letter-spacing:-0.5px">
              You're invited!
            </p>
            <p style="margin:0 0 24px;font-size:15px;color:#6B7280;line-height:1.6">
              <strong style="color:#1E293B">${args.inviterName}</strong> invited you
              to manage <strong style="color:#1E293B">${args.propertyName}</strong>
              as a Manager on Liveet.
            </p>

            <!-- What managers can do -->
            <table width="100%" cellpadding="0" cellspacing="0"
              style="background:#F8FAFC;border-radius:12px;padding:16px;margin-bottom:24px">
              <tr><td>
                <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#6B7280;letter-spacing:1px;text-transform:uppercase">
                  As a manager you can
                </p>
                ${["Add and manage tenants", "Collect rent", "View rooms and floors", "Respond to chats"].map(
                  (item) => `<p style="margin:0 0 6px;font-size:14px;color:#1E293B">✓ &nbsp;${item}</p>`
                ).join("")}
                <p style="margin:8px 0 0;font-size:12px;color:#9CA3AF">
                  Note: tenant contact details are not visible to managers.
                </p>
              </td></tr>
            </table>

            <!-- Token box -->
            <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#1E293B">
              Your invite token
            </p>
            <table width="100%" cellpadding="0" cellspacing="0"
              style="background:#1E293B;border-radius:12px;padding:16px;margin-bottom:8px">
              <tr><td align="center">
                <p style="margin:0;font-size:18px;font-weight:800;color:#D4F542;letter-spacing:2px;word-break:break-all">
                  ${args.token}
                </p>
              </td></tr>
            </table>
            <p style="margin:0 0 28px;font-size:12px;color:#9CA3AF">
              Token expires in 7 days. Keep it safe.
            </p>

            <!-- Steps -->
            <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#1E293B">
              How to accept
            </p>
            ${[
              "Download the Liveet Operator app from App Store or Play Store",
              "Sign up with this email address",
              'Go to Profile → "Accept Invite" and paste your token',
            ].map(
              (step, i) => `
              <table cellpadding="0" cellspacing="0" style="margin-bottom:10px">
                <tr>
                  <td style="width:28px;vertical-align:top">
                    <span style="display:inline-block;width:22px;height:22px;border-radius:11px;background:#EEF2F6;text-align:center;line-height:22px;font-size:12px;font-weight:700;color:#1E293B">${i + 1}</span>
                  </td>
                  <td style="font-size:14px;color:#374151;line-height:1.5;padding-left:8px">${step}</td>
                </tr>
              </table>`
            ).join("")}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #E2E8F0">
            <p style="margin:0;font-size:12px;color:#9CA3AF;text-align:center">
              If you didn't expect this invite, you can safely ignore this email.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
      `,
    });

    if (error) throw new Error(`Email send failed: ${error.message}`);
    return { success: true };
  },
});
