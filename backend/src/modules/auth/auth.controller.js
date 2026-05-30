import { register, login } from './auth.service.js'

const registerHandler = async (req, res) => {
  const data = await register(req.body)
  res.status(201).json(data)
}

const loginHandler = async (req, res) => {
  const data = await login(req.body)
  res.json(data)
}

export { registerHandler, loginHandler }
