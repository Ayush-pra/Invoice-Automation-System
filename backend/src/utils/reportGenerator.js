import PDFDocument from 'pdfkit'
import prisma from '../config/db.js'

/**
 * Generate report aggregation data.
 * Queries all processed invoices for a company inside a specific month and year,
 * and compiles comprehensive breakdowns.
 *
 * @param {string} companyId - UUID of the company
 * @param {number} month - 1-12
 * @param {number} year - 4 digit year
 * @returns {Promise<Object>} Aggegrated report data summary
 */
const generateReportData = async (companyId, month, year) => {
  // Fetch company details
  const company = await prisma.company.findUnique({
    where: { id: companyId },
  })

  if (!company) {
    throw Object.assign(new Error('Company not found'), { status: 404 })
  }

  // Create date boundaries for the given month
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0, 23, 59, 59, 999)

  // Fetch all invoices in the billing period
  const invoices = await prisma.invoice.findMany({
    where: {
      companyId,
      billingDate: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      subscription: {
        include: {
          user: {
            include: {
              department: true,
            },
          },
        },
      },
    },
  })

  const processedInvoices = invoices.filter((inv) => inv.status === 'PROCESSED')
  const pendingInvoicesCount = invoices.filter((inv) => inv.status === 'PENDING').length
  const processedInvoicesCount = processedInvoices.length

  // Calculate overall spend (always default currency to INR or USD)
  // Let's assume all invoices in the company are standardized to one currency (default: INR)
  const currency = processedInvoices.length > 0 ? processedInvoices[0].currency : 'INR'
  const totalAmount = processedInvoices.reduce((sum, inv) => sum + (inv.amount || 0.0), 0.0)

  // 1. Group by Department
  const departmentMap = new Map()
  
  processedInvoices.forEach((inv) => {
    const user = inv.subscription?.user
    const deptName = user?.department?.name || 'General'
    const userId = user?.id || 'unknown'

    if (!departmentMap.has(deptName)) {
      departmentMap.set(deptName, {
        departmentName: deptName,
        totalAmount: 0.0,
        employees: new Set(),
        invoices: [],
      })
    }

    const dept = departmentMap.get(deptName)
    dept.totalAmount += inv.amount || 0.0
    dept.employees.add(userId)
    dept.invoices.push({
      id: inv.id,
      invoiceId: inv.externalId,
      platform: inv.platform,
      amount: inv.amount,
      currency: inv.currency,
      date: inv.billingDate,
      employeeName: user?.name || 'Unknown',
    })
  })

  const byDepartment = Array.from(departmentMap.values()).map((dept) => ({
    departmentName: dept.departmentName,
    totalAmount: parseFloat(dept.totalAmount.toFixed(2)),
    employeeCount: dept.employees.size,
    invoices: dept.invoices,
  }))

  // 2. Group by Employee
  const employeeMap = new Map()

  processedInvoices.forEach((inv) => {
    const user = inv.subscription?.user
    if (!user) return

    const userId = user.id
    const deptName = user.department?.name || 'General'

    if (!employeeMap.has(userId)) {
      employeeMap.set(userId, {
        employeeName: user.name,
        email: user.email,
        department: deptName,
        totalAmount: 0.0,
        subscriptions: [],
      })
    }

    const emp = employeeMap.get(userId)
    emp.totalAmount += inv.amount || 0.0
    emp.subscriptions.push({
      platform: inv.platform,
      amount: inv.amount,
      invoiceId: inv.externalId,
      date: inv.billingDate,
    })
  })

  const byEmployee = Array.from(employeeMap.values()).map((emp) => ({
    employeeName: emp.employeeName,
    email: emp.email,
    department: emp.department,
    totalAmount: parseFloat(emp.totalAmount.toFixed(2)),
    subscriptions: emp.subscriptions,
  }))

  // 3. Group by Platform
  const platformMap = new Map()

  processedInvoices.forEach((inv) => {
    const platform = inv.platform.toLowerCase()
    const userName = inv.subscription?.user?.name || 'Unknown'

    if (!platformMap.has(platform)) {
      platformMap.set(platform, {
        platform: inv.platform,
        totalAmount: 0.0,
        invoiceCount: 0,
        employees: new Set(),
      })
    }

    const plat = platformMap.get(platform)
    plat.totalAmount += inv.amount || 0.0
    plat.invoiceCount += 1
    plat.employees.add(userName)
  })

  const byPlatform = Array.from(platformMap.values()).map((plat) => ({
    platform: plat.platform,
    totalAmount: parseFloat(plat.totalAmount.toFixed(2)),
    invoiceCount: plat.invoiceCount,
    employees: Array.from(plat.employees),
  }))

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]
  const periodLabel = `${months[month - 1]} ${year}`

  const reportData = {
    company: {
      name: company.name,
      email: company.email,
    },
    period: {
      month,
      year,
      label: periodLabel,
    },
    totalAmount: parseFloat(totalAmount.toFixed(2)),
    currency,
    byDepartment,
    byEmployee,
    byPlatform,
    pendingInvoices: pendingInvoicesCount,
    processedInvoices: processedInvoicesCount,
    invoiceList: processedInvoices.map((inv) => ({
      id: inv.id,
      invoiceId: inv.externalId,
      platform: inv.platform,
      amount: inv.amount,
      currency: inv.currency,
      date: inv.billingDate,
      employeeName: inv.subscription?.user?.name || 'Unknown',
    })),
  }

  return reportData
}

/**
 * Generate a highly professional PDF document using PDFKit.
 * Matches clean modern typography and theme styling.
 *
 * @param {Object} reportData - Aggregated summary object
 * @returns {Promise<Buffer>} PDF file buffer
 */
const generateReportPDF = (reportData) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, bufferPages: true })
      const buffers = []

      doc.on('data', buffers.push.bind(buffers))
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers)
        resolve(pdfBuffer)
      })

      // Define Palette Colors
      const primaryColor = '#1e293b' // Dark Slate
      const secondaryColor = '#0ea5e9' // Sky Blue
      const lightBg = '#f8fafc' // Soft White
      const dividerColor = '#cbd5e1' // Cool Grey
      const textMuted = '#64748b' // Slate Grey

      // ──────────────────────────────────────────────────────────
      // PAGE 1 — COVER PAGE
      // ──────────────────────────────────────────────────────────
      // Top background accent block
      doc.rect(0, 0, doc.page.width, 220).fillColor(primaryColor).fill()
      
      // Secondary Accent stripe
      doc.rect(0, 220, doc.page.width, 10).fillColor(secondaryColor).fill()

      // Header on cover
      doc.fillColor('#ffffff').fontSize(24).font('Helvetica-Bold')
      doc.text(reportData.company.name.toUpperCase(), 50, 80)
      doc.fontSize(12).font('Helvetica').fillColor('#94a3b8')
      doc.text('ENTERPRISE EXPENSE REPORTING SYSTEM', 50, 115)

      // Title Block
      doc.y = 280
      doc.fillColor(primaryColor).fontSize(34).font('Helvetica-Bold')
      doc.text('MONTHLY EXPENSE SUMMARY', 50, doc.y)
      
      doc.y += 45
      doc.fontSize(18).font('Helvetica').fillColor(textMuted)
      doc.text(`Billing Cycle: ${reportData.period.label}`, 50, doc.y)

      // Info metadata
      doc.y += 60
      doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).strokeColor(dividerColor).lineWidth(1.5).stroke()
      
      doc.y += 20
      const startY = doc.y
      doc.fontSize(10).font('Helvetica-Bold').fillColor(primaryColor).text('PREPARED FOR:', 50, startY)
      doc.fontSize(10).font('Helvetica').fillColor(textMuted).text(reportData.company.name, 50, startY + 15)
      doc.text(reportData.company.email, 50, startY + 30)

      doc.fontSize(10).font('Helvetica-Bold').fillColor(primaryColor).text('GENERATED ON:', 250, startY)
      doc.fontSize(10).font('Helvetica').fillColor(textMuted).text(new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }), 250, startY + 15)

      // Total Spend highlight badge
      doc.rect(doc.page.width - 240, startY - 5, 190, 70).fillColor(lightBg).strokeColor(dividerColor).lineWidth(1).stroke()
      
      doc.fillColor(textMuted).fontSize(9).font('Helvetica-Bold').text('TOTAL OUTSTANDING SPEND', doc.page.width - 230, startY, { width: 170, align: 'center' })
      
      const currencySymbol = reportData.currency === 'INR' ? 'Rs ' : `${reportData.currency} `
      const formattedTotal = reportData.totalAmount.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })

      doc.fillColor(secondaryColor).fontSize(18).font('Helvetica-Bold').text(`${currencySymbol}${formattedTotal}`, doc.page.width - 230, startY + 20, { width: 170, align: 'center' })

      // ──────────────────────────────────────────────────────────
      // PAGE 2 — DEPARTMENT BREAKDOWN SUMMARY
      // ──────────────────────────────────────────────────────────
      doc.addPage()
      
      doc.fillColor(primaryColor).fontSize(18).font('Helvetica-Bold').text('DEPARTMENT SPEND SUMMARY', 50, 50)
      doc.fontSize(10).font('Helvetica').fillColor(textMuted).text('Overview of billing transactions aggregated by department.', 50, 75)

      // Draw table headers
      let tableY = 110
      doc.rect(50, tableY, doc.page.width - 100, 24).fillColor(primaryColor).fill()
      
      doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold')
      doc.text('Department', 60, tableY + 7, { width: 190 })
      doc.text('Active Employees', 250, tableY + 7, { width: 90, align: 'right' })
      doc.text('Spend Amount', 350, tableY + 7, { width: 100, align: 'right' })
      doc.text('% of Total', 460, tableY + 7, { width: 60, align: 'right' })

      tableY += 24

      // Draw rows
      reportData.byDepartment.forEach((dept, index) => {
        const pct = reportData.totalAmount > 0 ? ((dept.totalAmount / reportData.totalAmount) * 100).toFixed(1) : '0.0'
        
        // Zebra striping
        if (index % 2 === 0) {
          doc.rect(50, tableY, doc.page.width - 100, 20).fillColor(lightBg).fill()
        }

        doc.fillColor(primaryColor).fontSize(9).font('Helvetica')
        doc.text(dept.departmentName, 60, tableY + 5, { width: 190 })
        doc.text(dept.employeeCount.toString(), 250, tableY + 5, { width: 90, align: 'right' })
        
        const formattedAmount = dept.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })
        doc.text(`${reportData.currency} ${formattedAmount}`, 350, tableY + 5, { width: 100, align: 'right' })
        doc.text(`${pct}%`, 460, tableY + 5, { width: 60, align: 'right' })

        tableY += 20
      })

      // Total Row
      doc.moveTo(50, tableY).lineTo(doc.page.width - 50, tableY).strokeColor(dividerColor).lineWidth(1.5).stroke()
      
      doc.fillColor(primaryColor).fontSize(10).font('Helvetica-Bold')
      doc.text('Total Summary', 60, tableY + 8, { width: 190 })
      doc.text(`${reportData.currency} ${formattedTotal}`, 350, tableY + 8, { width: 100, align: 'right' })
      doc.text('100.0%', 460, tableY + 8, { width: 60, align: 'right' })
      
      doc.moveTo(50, tableY + 24).lineTo(doc.page.width - 50, tableY + 24).strokeColor(dividerColor).lineWidth(1.5).stroke()

      // ──────────────────────────────────────────────────────────
      // PAGE 3+ — EMPLOYEE BREAKDOWN
      // ──────────────────────────────────────────────────────────
      doc.addPage()
      
      doc.fillColor(primaryColor).fontSize(18).font('Helvetica-Bold').text('EMPLOYEE EXPENSE BREAKDOWN', 50, 50)
      doc.fontSize(10).font('Helvetica').fillColor(textMuted).text('Itemized breakdown of SaaS subscriptions per individual employee.', 50, 75)

      let currentY = 110

      if (reportData.byEmployee.length === 0) {
        doc.fontSize(11).font('Helvetica-Oblique').fillColor(textMuted).text('No invoice transactions found for this period.', 50, currentY)
      } else {
        reportData.byEmployee.forEach((emp) => {
          // If content reaches too far down the page, start a new page
          if (currentY > doc.page.height - 180) {
            doc.addPage()
            currentY = 50
          }

          // Employee Banner Header
          doc.rect(50, currentY, doc.page.width - 100, 20).fillColor('#e2e8f0').fill()
          doc.fillColor(primaryColor).fontSize(9).font('Helvetica-Bold')
          doc.text(`${emp.employeeName} (${emp.email})`, 60, currentY + 5, { width: 250 })
          doc.text(`Dept: ${emp.department}`, 310, currentY + 5, { width: 210, align: 'right' })

          currentY += 20

          // Headers
          doc.rect(50, currentY, doc.page.width - 100, 16).fillColor(lightBg).fill()
          doc.fillColor(textMuted).fontSize(8).font('Helvetica-Bold')
          doc.text('Platform', 60, currentY + 4, { width: 120 })
          doc.text('Invoice Number', 190, currentY + 4, { width: 140 })
          doc.text('Date', 340, currentY + 4, { width: 90 })
          doc.text('Amount', 440, currentY + 4, { width: 70, align: 'right' })

          currentY += 16

          emp.subscriptions.forEach((sub) => {
            doc.fillColor(primaryColor).fontSize(8).font('Helvetica')
            doc.text(sub.platform.toUpperCase(), 60, currentY + 4, { width: 120 })
            doc.text(sub.invoiceId || 'N/A', 190, currentY + 4, { width: 140 })
            doc.text(new Date(sub.date).toLocaleDateString('en-US'), 340, currentY + 4, { width: 90 })
            
            const amt = sub.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })
            doc.text(`${reportData.currency} ${amt}`, 440, currentY + 4, { width: 70, align: 'right' })

            currentY += 15
          })

          // Subtotal row
          doc.moveTo(50, currentY).lineTo(doc.page.width - 50, currentY).strokeColor(dividerColor).lineWidth(0.5).stroke()
          
          doc.fillColor(primaryColor).fontSize(8).font('Helvetica-Bold')
          doc.text('Individual Subtotal', 60, currentY + 4, { width: 120 })
          
          const subtotalAmt = emp.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })
          doc.text(`${reportData.currency} ${subtotalAmt}`, 440, currentY + 4, { width: 70, align: 'right' })

          currentY += 25 // spacing for next block
        })
      }

      // ──────────────────────────────────────────────────────────
      // LAST PAGE — PLATFORM SUMMARY
      // ──────────────────────────────────────────────────────────
      doc.addPage()
      
      doc.fillColor(primaryColor).fontSize(18).font('Helvetica-Bold').text('PLATFORM UTILITY & SUMMARY', 50, 50)
      doc.fontSize(10).font('Helvetica').fillColor(textMuted).text('Consolidated spend metric analysis grouped by SaaS platform vendor.', 50, 75)

      let platformY = 110
      doc.rect(50, platformY, doc.page.width - 100, 24).fillColor(primaryColor).fill()
      
      doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold')
      doc.text('Platform Name', 60, platformY + 7, { width: 180 })
      doc.text('Invoices Captured', 250, platformY + 7, { width: 110, align: 'right' })
      doc.text('Platform Spend Amount', 370, platformY + 7, { width: 140, align: 'right' })

      platformY += 24

      reportData.byPlatform.forEach((plat, index) => {
        if (index % 2 === 0) {
          doc.rect(50, platformY, doc.page.width - 100, 20).fillColor(lightBg).fill()
        }

        doc.fillColor(primaryColor).fontSize(9).font('Helvetica')
        doc.text(plat.platform.toUpperCase(), 60, platformY + 5, { width: 180 })
        doc.text(plat.invoiceCount.toString(), 250, platformY + 5, { width: 110, align: 'right' })
        
        const platAmt = plat.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })
        doc.text(`${reportData.currency} ${platAmt}`, 370, platformY + 5, { width: 140, align: 'right' })

        platformY += 20
      })

      doc.moveTo(50, platformY).lineTo(doc.page.width - 50, platformY).strokeColor(dividerColor).lineWidth(1.5).stroke()

      // ──────────────────────────────────────────────────────────
      // HEADER & FOOTER ON SUB-PAGES (DYNAMICALLY BIND)
      // ──────────────────────────────────────────────────────────
      const range = doc.bufferedPageRange()
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(i)
        
        // Skip Header/Footer on Cover Page (Page 1)
        if (i === 0) continue

        // Footer block
        doc.fontSize(8).fillColor(textMuted).font('Helvetica')
        doc.text(
          `Page ${i + 1} of ${range.count}`,
          50,
          doc.page.height - 45,
          { align: 'right', width: doc.page.width - 100 }
        )
        doc.text(
          `${reportData.company.name} — Expense Summary Report (${reportData.period.label})`,
          50,
          doc.page.height - 45,
          { align: 'left', width: doc.page.width - 100 }
        )
        
        doc.moveTo(50, doc.page.height - 52).lineTo(doc.page.width - 50, doc.page.height - 52).strokeColor(dividerColor).lineWidth(0.5).stroke()
      }

      // Finalize the PDF Document
      doc.end()

    } catch (err) {
      reject(err)
    }
  })
}

export { generateReportData, generateReportPDF }
