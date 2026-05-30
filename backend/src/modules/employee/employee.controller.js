import * as employeeService from './employee.service.js'

const inviteEmployeeHandler = async (req, res, next) => {
  try {
    const { companyId } = req.user
    const employee = await employeeService.inviteEmployee(companyId, req.body)
    res.status(201).json(employee)
  } catch (error) {
    next(error)
  }
}

const listEmployeesHandler = async (req, res, next) => {
  try {
    const { companyId } = req.user
    const employees = await employeeService.listEmployees(companyId)
    res.json(employees)
  } catch (error) {
    next(error)
  }
}

export { inviteEmployeeHandler, listEmployeesHandler }
