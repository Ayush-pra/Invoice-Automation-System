import { Resend } from 'resend'

// Initialize Resend SDK
// If RESEND_API_KEY is not defined, we operate in mock/log mode to prevent blocking application flows
const resendApiKey = process.env.RESEND_API_KEY
const resend = resendApiKey ? new Resend(resendApiKey) : null

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'

/**
 * Dispatch monthly PDF expense report to CA / Finance team.
 *
 * @param {Object} options
 * @param {string} options.toEmail
 * @param {string} options.toName
 * @param {string} options.companyName
 * @param {string} options.month - Month name (e.g., "May")
 * @param {number} options.year - Year (e.g., 2026)
 * @param {number} options.totalAmount
 * @param {string} options.currency
 * @param {Buffer} options.reportPdfBuffer - Raw PDF buffer
 * @param {number} options.invoiceCount
 * @returns {Promise<{ success: boolean, messageId?: string }>}
 */
const sendMonthlyReport = async (options) => {
  const {
    toEmail,
    toName,
    companyName,
    month,
    year,
    totalAmount,
    currency,
    reportPdfBuffer,
    invoiceCount,
  } = options

  const subject = `${companyName} — Expense Report ${month} ${year}`
  const formattedTotal = totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })
  const currencySymbol = currency === 'INR' ? '₹' : `${currency} `

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6; margin: 0; padding: 0; background-color: #f8fafc; }
          .container { max-width: 600px; margin: 40px auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
          .header { background: #1e293b; padding: 30px 40px; text-align: center; color: #ffffff; }
          .header h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.05em; }
          .content { padding: 40px; }
          .stats-grid { display: flex; gap: 20px; margin: 30px 0; }
          .stat-card { flex: 1; padding: 20px; background: #f1f5f9; border-radius: 6px; border: 1px solid #e2e8f0; text-align: center; }
          .stat-label { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 5px; }
          .stat-val { font-size: 22px; font-weight: 700; color: #0ea5e9; }
          .footer { background: #f8fafc; padding: 20px 40px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
          .btn { display: inline-block; padding: 12px 24px; background: #0ea5e9; color: #ffffff; text-decoration: none; border-radius: 4px; font-weight: bold; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>MONTHLY EXPENSE SUMMARY</h1>
          </div>
          <div class="content">
            <p>Dear ${toName || 'Finance Manager'},</p>
            <p>Please find attached the monthly spend and SaaS subscription expense report for <strong>${companyName}</strong> covering the billing period of <strong>${month} ${year}</strong>.</p>
            
            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-label">Total Outlay</div>
                <div class="stat-val">${currencySymbol}${formattedTotal}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Invoices Audited</div>
                <div class="stat-val">${invoiceCount}</div>
              </div>
            </div>

            <p>A comprehensive, multi-page itemized list of all employee expenditures, platform splits, and department allocations has been processed and compiled. This summary report is attached to this email as a PDF document for your audit records.</p>
            
            <p style="margin-top: 30px;">If you have any questions, feel free to log in to the subscription dashboard.</p>
          </div>
          <div class="footer">
            &copy; ${year} ${companyName} &bull; Enterprise Subscription & Invoice Automation System
          </div>
        </div>
      </body>
    </html>
  `

  console.log(`[Email Service] Preparing monthly report email to: ${toEmail}`)

  if (!resend) {
    console.log('[Email Service] MOCK MODE: Resend API Key is missing. Email parameters logged below:')
    console.log(`  - To: ${toEmail}`)
    console.log(`  - Subject: ${subject}`)
    console.log(`  - Attachments: 1 PDF file (${reportPdfBuffer.length} bytes)`)
    return { success: true, messageId: 'mock-message-id' }
  }

  try {
    const response = await resend.emails.send({
      from: FROM_EMAIL,
      to: toEmail,
      subject,
      html,
      attachments: [
        {
          filename: `Report_${month}_${year}.pdf`,
          content: reportPdfBuffer,
        },
      ],
    })

    if (response.error) {
      throw new Error(response.error.message)
    }

    console.log(`[Email Service] Monthly report successfully dispatched to ${toEmail}. Message ID: ${response.data.id}`)
    return { success: true, messageId: response.data.id }
  } catch (error) {
    console.error('[Email Service] Resend email dispatch failed:', error.message)
    // Never crash report pipelines due to SMTP/resend exceptions
    return { success: false, error: error.message }
  }
}

/**
 * Dispatch real-time billing activity notification when an invoice is processed.
 *
 * @param {Object} options
 * @param {string} options.toEmail
 * @param {string} options.employeeName
 * @param {string} options.platform
 * @param {number} options.amount
 * @param {string} [options.invoiceUrl]
 * @returns {Promise<Object>}
 */
const sendInvoiceAlert = async (options) => {
  const { toEmail, employeeName, platform, amount, invoiceUrl } = options
  const subject = `New Invoice Processed: ${platform.toUpperCase()}`

  const html = `
    <div style="font-family: Arial, sans-serif; color: #333333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 5px;">
      <h2 style="color: #1e293b; border-bottom: 2px solid #0ea5e9; padding-bottom: 10px;">Billing Alert</h2>
      <p>Hello ${employeeName},</p>
      <p>An automated invoice has been fetched and compiled for your platform subscription:</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr style="background-color: #f9f9f9;">
          <td style="padding: 10px; font-weight: bold; border: 1px solid #eaeaea;">Platform</td>
          <td style="padding: 10px; border: 1px solid #eaeaea;">${platform.toUpperCase()}</td>
        </tr>
        <tr>
          <td style="padding: 10px; font-weight: bold; border: 1px solid #eaeaea;">Amount</td>
          <td style="padding: 10px; border: 1px solid #eaeaea; color: #0ea5e9; font-weight: bold;">₹${amount}</td>
        </tr>
      </table>
      ${invoiceUrl ? `<p><a href="${invoiceUrl}" style="background-color: #0ea5e9; color: white; padding: 10px 15px; text-decoration: none; border-radius: 3px; display: inline-block;">View Invoice PDF</a></p>` : ''}
      <p style="color: #94a3b8; font-size: 11px; margin-top: 30px;">This is an automated notification. Please do not reply directly to this inbox.</p>
    </div>
  `

  if (!resend) {
    console.log(`[Email Service] MOCK MODE: Invoice Alert logged: Platform ${platform}, Amount ${amount} -> ${toEmail}`)
    return { success: true }
  }

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: toEmail,
      subject,
      html,
    })
    return { success: true }
  } catch (err) {
    console.error('[Email Service] Failed sending invoice alert email:', err.message)
    return { success: false, error: err.message }
  }
}

/**
 * Dispatch credentials setup and welcome details to invited employee.
 *
 * @param {Object} options
 * @param {string} options.toEmail
 * @param {string} options.name
 * @param {string} options.companyName
 * @param {string} options.tempPassword
 * @returns {Promise<Object>}
 */
const sendWelcomeEmail = async (options) => {
  const { toEmail, name, companyName, tempPassword } = options
  const subject = `Welcome to ${companyName} — Expense & Invoice Platform`

  const html = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1e293b; max-width: 600px; margin: 40px auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
      <h2 style="color: #1e293b; font-size: 20px; font-weight: 700; border-bottom: 2px solid #0ea5e9; padding-bottom: 12px; margin-top: 0;">Welcome Aboard!</h2>
      <p>Hello <strong>${name}</strong>,</p>
      <p>You have been invited by your administrator to join the <strong>${companyName}</strong> Enterprise Subscription & Invoice Automation portal.</p>
      
      <div style="background-color: #f8fafc; padding: 20px; border-radius: 6px; border: 1px solid #e2e8f0; margin: 25px 0;">
        <h4 style="margin-top: 0; margin-bottom: 10px; color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;">YOUR LOGIN CREDENTIALS</h4>
        <p style="margin: 5px 0;"><strong>Username / Email:</strong> ${toEmail}</p>
        <p style="margin: 5px 0;"><strong>Temporary Password:</strong> <code style="background-color: #e2e8f0; padding: 2px 6px; border-radius: 3px; font-family: monospace;">${tempPassword}</code></p>
      </div>

      <p><strong>Next Steps:</strong></p>
      <ol style="padding-left: 20px;">
        <li>Log in to your account page at <a href="http://localhost:5173" style="color: #0ea5e9; text-decoration: none; font-weight: 600;">http://localhost:5173</a></li>
        <li>Update your password in security settings upon first sign-in.</li>
        <li>Link any platforms, credentials, or Gmail boxes to automate subscription fetches!</li>
      </ol>
      
      <p style="margin-top: 30px;">If you have questions, please reach out to your Finance Admin team.</p>
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0;">
      <p style="color: #94a3b8; font-size: 11px; text-align: center; margin-bottom: 0;">Automated System Dispatcher &bull; Enterprise Invoice Automation Platform</p>
    </div>
  `

  if (!resend) {
    console.log(`[Email Service] MOCK MODE: Welcome Email logged for ${name} (${toEmail}) with temp pass "${tempPassword}"`)
    return { success: true }
  }

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: toEmail,
      subject,
      html,
    })
    return { success: true }
  } catch (err) {
    console.error('[Email Service] Failed sending welcome email:', err.message)
    return { success: false, error: err.message }
  }
}

export { sendMonthlyReport, sendInvoiceAlert, sendWelcomeEmail }
