import prisma from '../../config/db.js'

/**
 * Set (upsert) a department budget for a specific month/year.
 */
const setBudget = async (companyId, departmentId, month, year, amount) => {
  // Verify department belongs to company
  const department = await prisma.department.findUnique({
    where: { id: departmentId },
  })

  if (!department) {
    throw Object.assign(new Error('Department not found'), { status: 404 })
  }

  if (department.companyId !== companyId) {
    throw Object.assign(new Error('Department does not belong to your company'), { status: 403 })
  }

  // Upsert: create or update
  const budget = await prisma.budget.upsert({
    where: {
      departmentId_month_year: {
        departmentId,
        month,
        year,
      },
    },
    update: {
      amount,
    },
    create: {
      companyId,
      departmentId,
      month,
      year,
      amount,
    },
  })

  return budget
}

/**
 * Get all department budgets for a given month/year with actual spend comparison.
 */
const getBudgets = async (companyId, month, year) => {
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 1)

  // Get all budgets for this company/month/year
  const budgets = await prisma.budget.findMany({
    where: { companyId, month, year },
    include: {
      department: true,
    },
  })

  // Get all invoices for this period grouped by department
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

  // Build spend per department
  const spendMap = {}
  for (const inv of invoices) {
    const deptId = inv.subscription.user.departmentId || 'unassigned'
    spendMap[deptId] = (spendMap[deptId] || 0) + inv.amount
  }

  const result = budgets.map(b => {
    const actualSpend = spendMap[b.departmentId] || 0
    const remaining = b.amount - actualSpend
    const percentageUsed = b.amount > 0 ? parseFloat(((actualSpend / b.amount) * 100).toFixed(2)) : 0

    let status = 'under'
    if (percentageUsed >= 100) {
      status = 'over'
    } else if (percentageUsed >= 80) {
      status = 'warning'
    }

    return {
      id: b.id,
      departmentId: b.departmentId,
      departmentName: b.department.name,
      budgetAmount: b.amount,
      actualSpend: parseFloat(actualSpend.toFixed(2)),
      remaining: parseFloat(remaining.toFixed(2)),
      percentageUsed,
      status,
    }
  })

  return result
}

/**
 * Delete a budget record after verifying it belongs to the company.
 */
const deleteBudget = async (id, companyId) => {
  const budget = await prisma.budget.findUnique({
    where: { id },
  })

  if (!budget) {
    throw Object.assign(new Error('Budget not found'), { status: 404 })
  }

  if (budget.companyId !== companyId) {
    throw Object.assign(new Error('Access denied'), { status: 403 })
  }

  await prisma.budget.delete({
    where: { id },
  })

  return { message: 'Budget deleted successfully' }
}

export { setBudget, getBudgets, deleteBudget }
