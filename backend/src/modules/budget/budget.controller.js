import * as budgetService from './budget.service.js'

const setBudgetHandler = async (req, res, next) => {
  try {
    const { companyId } = req.user
    const { departmentId, month, year, amount } = req.body

    if (!departmentId || !month || !year || amount === undefined) {
      throw Object.assign(new Error('departmentId, month, year, and amount are required'), { status: 400 })
    }

    const budget = await budgetService.setBudget(
      companyId,
      departmentId,
      parseInt(month),
      parseInt(year),
      parseFloat(amount)
    )

    res.status(201).json(budget)
  } catch (error) {
    next(error)
  }
}

const getBudgetsHandler = async (req, res, next) => {
  try {
    const { companyId } = req.user
    const month = parseInt(req.query.month) || new Date().getMonth() + 1
    const year = parseInt(req.query.year) || new Date().getFullYear()

    const budgets = await budgetService.getBudgets(companyId, month, year)
    res.json(budgets)
  } catch (error) {
    next(error)
  }
}

const deleteBudgetHandler = async (req, res, next) => {
  try {
    const { companyId } = req.user
    const { id } = req.params

    const result = await budgetService.deleteBudget(id, companyId)
    res.json(result)
  } catch (error) {
    next(error)
  }
}

export { setBudgetHandler, getBudgetsHandler, deleteBudgetHandler }
