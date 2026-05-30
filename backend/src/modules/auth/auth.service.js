import prisma from '../../config/db.js'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'

const register = async ({ name, email, password, companyName }) => {
  // Check if user already exists
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) throw Object.assign(new Error('Email already registered'), { status: 400 })

  // Check if company email is already taken
  const existingCompany = await prisma.company.findUnique({ where: { email } })
  if (existingCompany) throw Object.assign(new Error('Company with this email already exists'), { status: 400 })

  // Create company first
  const company = await prisma.company.create({
    data: { name: companyName, email }
  })

  // Hash password and create user as COMPANY_ADMIN
  const hashed = await bcrypt.hash(password, 10)

  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashed,
      role: 'COMPANY_ADMIN',
      companyId: company.id
    }
  })

  const token = generateToken(user)
  return { token, user: sanitize(user), company }
}

const login = async ({ email, password }) => {
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) throw Object.assign(new Error('Invalid credentials'), { status: 401 })

  const match = await bcrypt.compare(password, user.password)
  if (!match) throw Object.assign(new Error('Invalid credentials'), { status: 401 })

  const token = generateToken(user)
  return { token, user: sanitize(user) }
}

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, role: user.role, companyId: user.companyId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  )
}

const sanitize = (user) => {
  const { password, ...rest } = user
  return rest
}

export { register, login }
