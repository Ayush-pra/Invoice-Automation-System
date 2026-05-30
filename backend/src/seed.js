import prisma from './config/db.js'
import bcrypt from 'bcrypt'

async function main() {
  const email = 'rohan@test.com'
  const password = 'password123'
  const hashedPassword = await bcrypt.hash(password, 10)

  // Find or create company
  let company = await prisma.company.findFirst({
    where: { name: 'Rohan Test Company' }
  })
  if (!company) {
    company = await prisma.company.create({
      data: {
        name: 'Rohan Test Company',
        email: 'company@test.com'
      }
    })
  }

  // Find or create user
  const user = await prisma.user.findUnique({
    where: { email }
  })
  if (!user) {
    await prisma.user.create({
      data: {
        name: 'Rohan Prajapati',
        email,
        password: hashedPassword,
        role: 'COMPANY_ADMIN',
        companyId: company.id
      }
    })
    console.log('Test user created successfully!')
  } else {
    // Update password to ensure it matches
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    })
    console.log('Test user already exists. Password updated.')
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
