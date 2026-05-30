import bcrypt from 'bcrypt'
import prisma from '../../config/db.js'
import { sendWelcomeEmail } from '../../utils/emailService.js'

/**
 * Invite a new employee. Creates user with EMPLOYEE role and hashes temp password.
 * Automatically dispatches welcome credentials.
 */
const inviteEmployee = async (adminCompanyId, data) => {
  const { name, email, departmentId } = data

  if (!name || !email) {
    throw Object.assign(new Error('Name and email are required'), { status: 400 })
  }

  // Check if user already exists
  const existing = await prisma.user.findUnique({
    where: { email },
  })
  if (existing) {
    throw Object.assign(new Error('Email is already registered in the system'), { status: 400 })
  }

  // Hash temporary password 'Welcome@123'
  const tempPassword = 'Welcome@123'
  const hashedPassword = await bcrypt.hash(tempPassword, 10)

  // Fetch company details to include in welcome email
  const company = await prisma.company.findUnique({
    where: { id: adminCompanyId },
  })

  if (!company) {
    throw Object.assign(new Error('Admin company not found'), { status: 404 })
  }

  // Optional: check if department exists and belongs to this company
  if (departmentId) {
    const dept = await prisma.department.findUnique({
      where: { id: departmentId },
    })
    if (!dept || dept.companyId !== adminCompanyId) {
      throw Object.assign(new Error('Invalid department selection'), { status: 400 })
    }
  }

  // Create the employee record
  const employee = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      role: 'EMPLOYEE',
      companyId: adminCompanyId,
      departmentId: departmentId || null,
    },
  })

  // Trigger welcome email dispatch in the background (failures logged inside sendWelcomeEmail)
  sendWelcomeEmail({
    toEmail: email,
    name,
    companyName: company.name,
    tempPassword,
  })

  const { password, ...sanitizedEmployee } = employee
  return sanitizedEmployee
}

/**
 * Get all employees inside the admin's company.
 */
const listEmployees = async (companyId) => {
  const employees = await prisma.user.findMany({
    where: {
      companyId,
      role: 'EMPLOYEE',
    },
    include: {
      department: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  return employees.map(({ password, ...rest }) => rest)
}

export { inviteEmployee, listEmployees }
