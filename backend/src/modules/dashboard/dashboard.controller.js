import * as dashboardService from './dashboard.service.js'

const getOverviewHandler = async (req, res, next) => {
  try {
    const { companyId } = req.user
    const month = parseInt(req.query.month) || new Date().getMonth() + 1
    const year = parseInt(req.query.year) || new Date().getFullYear()

    const data = await dashboardService.getOverview(companyId, month, year)
    res.json(data)
  } catch (error) {
    next(error)
  }
}

const getDepartmentBreakdownHandler = async (req, res, next) => {
  try {
    const { companyId } = req.user
    const month = parseInt(req.query.month) || new Date().getMonth() + 1
    const year = parseInt(req.query.year) || new Date().getFullYear()

    const data = await dashboardService.getDepartmentBreakdown(companyId, month, year)
    res.json(data)
  } catch (error) {
    next(error)
  }
}

const getEmployeeBreakdownHandler = async (req, res, next) => {
  try {
    const { companyId } = req.user
    const month = parseInt(req.query.month) || new Date().getMonth() + 1
    const year = parseInt(req.query.year) || new Date().getFullYear()

    const data = await dashboardService.getEmployeeBreakdown(companyId, month, year)
    res.json(data)
  } catch (error) {
    next(error)
  }
}

const getPlatformBreakdownHandler = async (req, res, next) => {
  try {
    const { companyId } = req.user
    const month = parseInt(req.query.month) || new Date().getMonth() + 1
    const year = parseInt(req.query.year) || new Date().getFullYear()

    const data = await dashboardService.getPlatformBreakdown(companyId, month, year)
    res.json(data)
  } catch (error) {
    next(error)
  }
}

const getSpendTrendHandler = async (req, res, next) => {
  try {
    const { companyId } = req.user
    const months = parseInt(req.query.months) || 6

    const data = await dashboardService.getSpendTrend(companyId, months)
    res.json(data)
  } catch (error) {
    next(error)
  }
}

const getDuplicateSubscriptionsHandler = async (req, res, next) => {
  try {
    const { companyId } = req.user
    const data = await dashboardService.getDuplicateSubscriptions(companyId)
    res.json(data)
  } catch (error) {
    next(error)
  }
}

const getUnusedSubscriptionsHandler = async (req, res, next) => {
  try {
    const { companyId } = req.user
    const data = await dashboardService.getUnusedSubscriptions(companyId)
    res.json(data)
  } catch (error) {
    next(error)
  }
}

const getRenewalAlertsHandler = async (req, res, next) => {
  try {
    const { companyId } = req.user
    const data = await dashboardService.getRenewalAlerts(companyId)
    res.json(data)
  } catch (error) {
    next(error)
  }
}

export {
  getOverviewHandler,
  getDepartmentBreakdownHandler,
  getEmployeeBreakdownHandler,
  getPlatformBreakdownHandler,
  getSpendTrendHandler,
  getDuplicateSubscriptionsHandler,
  getUnusedSubscriptionsHandler,
  getRenewalAlertsHandler,
}
