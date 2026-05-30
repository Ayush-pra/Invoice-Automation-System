import * as reportService from './report.service.js'

const generateReportHandler = async (req, res, next) => {
  try {
    const { companyId } = req.user
    const { month, year } = req.body

    if (!month || !year) {
      throw Object.assign(new Error('Month and year are required'), { status: 400 })
    }

    const report = await reportService.generateMonthlyReport(
      companyId,
      parseInt(month),
      parseInt(year)
    )

    res.status(201).json(report)
  } catch (error) {
    next(error)
  }
}

const sendReportHandler = async (req, res, next) => {
  try {
    const { companyId } = req.user
    const { id } = req.params

    const result = await reportService.sendReportToCA(id, companyId)
    res.json(result)
  } catch (error) {
    next(error)
  }
}

const getReportsHandler = async (req, res, next) => {
  try {
    const { companyId } = req.user
    const reports = await reportService.getReports(companyId)
    res.json(reports)
  } catch (error) {
    next(error)
  }
}

const getReportByIdHandler = async (req, res, next) => {
  try {
    const { companyId } = req.user
    const { id } = req.params

    const report = await reportService.getReportById(id, companyId)
    res.json(report)
  } catch (error) {
    next(error)
  }
}

const getReportDownloadUrlHandler = async (req, res, next) => {
  try {
    const { companyId } = req.user
    const { id } = req.params

    const result = await reportService.getReportDownloadUrl(id, companyId)
    res.json(result)
  } catch (error) {
    next(error)
  }
}

export {
  generateReportHandler,
  sendReportHandler,
  getReportsHandler,
  getReportByIdHandler,
  getReportDownloadUrlHandler,
}
