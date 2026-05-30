import prisma from '../../config/db.js'

/**
 * A. Get dashboard overview metrics for a company in a given billing period.
 */
const getOverview = async (companyId, month, year) => {
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 1)

  // Previous month range
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  const prevStartDate = new Date(prevYear, prevMonth - 1, 1)
  const prevEndDate = new Date(prevYear, prevMonth, 1)

  // Current month invoices
  const currentInvoices = await prisma.invoice.findMany({
    where: {
      companyId,
      billingDate: { gte: startDate, lt: endDate },
    },
  })

  const totalAmount = currentInvoices.reduce((sum, inv) => sum + inv.amount, 0)
  const processedCount = currentInvoices.filter(inv => inv.status === 'PROCESSED').length
  const pendingCount = currentInvoices.filter(inv => inv.status === 'PENDING').length

  // Last month invoices
  const lastMonthInvoices = await prisma.invoice.findMany({
    where: {
      companyId,
      billingDate: { gte: prevStartDate, lt: prevEndDate },
    },
  })

  const lastMonthTotal = lastMonthInvoices.reduce((sum, inv) => sum + inv.amount, 0)

  // Percentage change
  let percentageChange = 0
  if (lastMonthTotal === 0) {
    percentageChange = totalAmount > 0 ? 100 : 0
  } else {
    percentageChange = parseFloat((((totalAmount - lastMonthTotal) / lastMonthTotal) * 100).toFixed(2))
  }

  // Counts
  const totalActiveSubscriptions = await prisma.subscription.count({
    where: { companyId, isActive: true },
  })

  const totalEmployees = await prisma.user.count({
    where: { companyId },
  })

  const connectedGmailCount = await prisma.emailToken.count({
    where: {
      user: { companyId },
    },
  })

  return {
    currentMonth: {
      totalAmount,
      invoiceCount: currentInvoices.length,
      processedCount,
      pendingCount,
    },
    lastMonth: {
      totalAmount: lastMonthTotal,
      invoiceCount: lastMonthInvoices.length,
    },
    percentageChange,
    totalActiveSubscriptions,
    totalEmployees,
    connectedGmailCount,
  }
}

/**
 * B. Get invoice spend grouped by department.
 */
const getDepartmentBreakdown = async (companyId, month, year) => {
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 1)

  const invoices = await prisma.invoice.findMany({
    where: {
      companyId,
      billingDate: { gte: startDate, lt: endDate },
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

  const grandTotal = invoices.reduce((sum, inv) => sum + inv.amount, 0)

  // Group by department
  const deptMap = {}
  for (const inv of invoices) {
    const dept = inv.subscription.user.department
    const deptId = dept?.id || 'unassigned'
    const deptName = dept?.name || 'General'

    if (!deptMap[deptId]) {
      deptMap[deptId] = {
        departmentId: deptId,
        departmentName: deptName,
        totalAmount: 0,
        employees: new Set(),
        invoiceCount: 0,
        platforms: {},
      }
    }

    deptMap[deptId].totalAmount += inv.amount
    deptMap[deptId].employees.add(inv.subscription.userId)
    deptMap[deptId].invoiceCount += 1

    const plat = inv.platform
    deptMap[deptId].platforms[plat] = (deptMap[deptId].platforms[plat] || 0) + inv.amount
  }

  const result = Object.values(deptMap).map(d => {
    // Find top platform
    const topPlatform = Object.entries(d.platforms)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'

    return {
      departmentId: d.departmentId,
      departmentName: d.departmentName,
      totalAmount: parseFloat(d.totalAmount.toFixed(2)),
      employeeCount: d.employees.size,
      invoiceCount: d.invoiceCount,
      topPlatform,
      percentOfTotal: grandTotal > 0 ? parseFloat(((d.totalAmount / grandTotal) * 100).toFixed(2)) : 0,
    }
  })

  return result.sort((a, b) => b.totalAmount - a.totalAmount)
}

/**
 * C. Get invoice spend grouped by employee.
 */
const getEmployeeBreakdown = async (companyId, month, year) => {
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 1)

  const invoices = await prisma.invoice.findMany({
    where: {
      companyId,
      billingDate: { gte: startDate, lt: endDate },
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

  const empMap = {}
  for (const inv of invoices) {
    const user = inv.subscription.user
    const uid = user.id

    if (!empMap[uid]) {
      empMap[uid] = {
        userId: uid,
        employeeName: user.name,
        email: user.email,
        departmentName: user.department?.name || 'General',
        totalAmount: 0,
        invoiceCount: 0,
        platformMap: {},
      }
    }

    empMap[uid].totalAmount += inv.amount
    empMap[uid].invoiceCount += 1

    const plat = inv.platform
    empMap[uid].platformMap[plat] = (empMap[uid].platformMap[plat] || 0) + inv.amount
  }

  const result = Object.values(empMap).map(e => ({
    userId: e.userId,
    employeeName: e.employeeName,
    email: e.email,
    departmentName: e.departmentName,
    totalAmount: parseFloat(e.totalAmount.toFixed(2)),
    invoiceCount: e.invoiceCount,
    platforms: Object.entries(e.platformMap).map(([platform, amount]) => ({
      platform,
      amount: parseFloat(amount.toFixed(2)),
    })),
  }))

  return result.sort((a, b) => b.totalAmount - a.totalAmount)
}

/**
 * D. Get invoice spend grouped by platform/vendor.
 */
const getPlatformBreakdown = async (companyId, month, year) => {
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 1)

  const invoices = await prisma.invoice.findMany({
    where: {
      companyId,
      billingDate: { gte: startDate, lt: endDate },
    },
    include: {
      subscription: {
        include: {
          user: true,
        },
      },
    },
  })

  const platMap = {}
  for (const inv of invoices) {
    const plat = inv.platform

    if (!platMap[plat]) {
      platMap[plat] = {
        platform: plat,
        totalAmount: 0,
        invoiceCount: 0,
        employees: new Map(),
      }
    }

    platMap[plat].totalAmount += inv.amount
    platMap[plat].invoiceCount += 1

    const user = inv.subscription.user
    const existing = platMap[plat].employees.get(user.id)
    if (existing) {
      existing.amount += inv.amount
    } else {
      platMap[plat].employees.set(user.id, { name: user.name, amount: inv.amount })
    }
  }

  const result = Object.values(platMap).map(p => ({
    platform: p.platform,
    totalAmount: parseFloat(p.totalAmount.toFixed(2)),
    invoiceCount: p.invoiceCount,
    employeeCount: p.employees.size,
    averageAmount: parseFloat((p.totalAmount / p.invoiceCount).toFixed(2)),
    employees: Array.from(p.employees.values()).map(e => ({
      name: e.name,
      amount: parseFloat(e.amount.toFixed(2)),
    })),
  }))

  return result.sort((a, b) => b.totalAmount - a.totalAmount)
}

/**
 * E. Get spend trend over last N months for charting.
 */
const getSpendTrend = async (companyId, months = 6) => {
  const now = new Date()
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  // Build list of months
  const periods = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    periods.push({
      month: d.getMonth() + 1,
      year: d.getFullYear(),
      label: `${monthNames[d.getMonth()]} ${d.getFullYear()}`,
    })
  }

  // Query all invoices in the date range
  const oldest = periods[0]
  const startDate = new Date(oldest.year, oldest.month - 1, 1)
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  const invoices = await prisma.invoice.findMany({
    where: {
      companyId,
      billingDate: { gte: startDate, lt: endDate },
    },
  })

  // Build lookup
  const lookup = {}
  for (const inv of invoices) {
    const d = new Date(inv.billingDate)
    const key = `${d.getMonth() + 1}-${d.getFullYear()}`
    if (!lookup[key]) {
      lookup[key] = { totalAmount: 0, invoiceCount: 0 }
    }
    lookup[key].totalAmount += inv.amount
    lookup[key].invoiceCount += 1
  }

  return periods.map(p => {
    const key = `${p.month}-${p.year}`
    const data = lookup[key] || { totalAmount: 0, invoiceCount: 0 }
    return {
      month: p.month,
      year: p.year,
      label: p.label,
      totalAmount: parseFloat(data.totalAmount.toFixed(2)),
      invoiceCount: data.invoiceCount,
    }
  })
}

/**
 * F. Detect duplicate subscriptions — same platform used by 2+ employees.
 */
const getDuplicateSubscriptions = async (companyId) => {
  const subscriptions = await prisma.subscription.findMany({
    where: { companyId, isActive: true },
    include: {
      user: true,
      invoices: {
        orderBy: { billingDate: 'desc' },
        take: 1,
      },
    },
  })

  // Group by platform
  const platMap = {}
  for (const sub of subscriptions) {
    if (!platMap[sub.platform]) {
      platMap[sub.platform] = []
    }
    const latestAmount = sub.invoices[0]?.amount || 0
    platMap[sub.platform].push({
      name: sub.user.name,
      email: sub.user.email,
      amount: latestAmount,
    })
  }

  // Only flag platforms with 2+ employees
  const result = []
  for (const [platform, employees] of Object.entries(platMap)) {
    if (employees.length >= 2) {
      const totalWaste = employees.reduce((sum, e) => sum + e.amount, 0)
      result.push({
        platform,
        employeeCount: employees.length,
        totalWaste: parseFloat(totalWaste.toFixed(2)),
        employees,
        suggestion: 'Consider using a team plan',
      })
    }
  }

  return result
}

/**
 * G. Find subscriptions with no invoices in the last 2 months.
 */
const getUnusedSubscriptions = async (companyId) => {
  const twoMonthsAgo = new Date()
  twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2)

  const subscriptions = await prisma.subscription.findMany({
    where: {
      companyId,
      isActive: true,
      // Skip subscriptions added less than 2 months ago
      createdAt: { lt: twoMonthsAgo },
    },
    include: {
      user: true,
      invoices: {
        orderBy: { billingDate: 'desc' },
        take: 1,
      },
    },
  })

  const result = []
  for (const sub of subscriptions) {
    const lastInvoice = sub.invoices[0] || null
    const lastInvoiceDate = lastInvoice?.billingDate || null

    // If there is a recent invoice within 2 months, skip
    if (lastInvoiceDate && lastInvoiceDate >= twoMonthsAgo) {
      continue
    }

    result.push({
      subscriptionId: sub.id,
      platform: sub.platform,
      employeeName: sub.user.name,
      email: sub.user.email,
      lastInvoiceDate,
      monthlyCost: lastInvoice?.amount || null,
      suggestion: 'No activity in 2 months — consider cancelling',
    })
  }

  return result
}

/**
 * H. Get renewal alerts for subscriptions renewing within 7 days.
 */
const getRenewalAlerts = async (companyId) => {
  const now = new Date()
  const sevenDaysFromNow = new Date()
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)

  const subscriptions = await prisma.subscription.findMany({
    where: { companyId, isActive: true },
    include: {
      user: true,
      invoices: {
        orderBy: { billingDate: 'desc' },
        take: 1,
      },
    },
  })

  const result = []
  for (const sub of subscriptions) {
    const lastInvoice = sub.invoices[0]
    if (!lastInvoice) continue

    // Renewal date = last billing date + 30 days
    const renewalDate = new Date(lastInvoice.billingDate)
    renewalDate.setDate(renewalDate.getDate() + 30)

    if (renewalDate >= now && renewalDate <= sevenDaysFromNow) {
      const daysUntilRenewal = Math.ceil((renewalDate - now) / (1000 * 60 * 60 * 24))
      result.push({
        subscriptionId: sub.id,
        platform: sub.platform,
        employeeName: sub.user.name,
        renewalDate,
        daysUntilRenewal,
        estimatedAmount: lastInvoice.amount,
      })
    }
  }

  return result.sort((a, b) => a.daysUntilRenewal - b.daysUntilRenewal)
}

export {
  getOverview,
  getDepartmentBreakdown,
  getEmployeeBreakdown,
  getPlatformBreakdown,
  getSpendTrend,
  getDuplicateSubscriptions,
  getUnusedSubscriptions,
  getRenewalAlerts,
}
