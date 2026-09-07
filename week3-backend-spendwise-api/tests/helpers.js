/**
 * Shared test helpers.
 */
import request from 'supertest'
import { createApp } from '../src/app.js'

export const app = createApp()
export const api = () => request(app)

export const validUser = { name: 'Badal', email: 'badal@example.com', password: 'Passw0rd123' }

/** Register a user and return { token, user }. */
export async function registerAndLogin(overrides = {}) {
  const res = await api()
    .post('/api/v1/auth/register')
    .send({ ...validUser, ...overrides })
  if (res.status !== 201) throw new Error(`register failed: ${JSON.stringify(res.body)}`)
  return { token: res.body.data.token, user: res.body.data.user }
}

export const auth = (token) => ({ Authorization: `Bearer ${token}` })

export const sampleTx = {
  title: 'Grocery run',
  amount: 2340,
  type: 'expense',
  category: 'food',
  payment: 'upi',
  date: '2026-09-03',
  notes: 'Weekly vegetables',
}

export async function createTx(token, overrides = {}) {
  const res = await api()
    .post('/api/v1/transactions')
    .set(auth(token))
    .send({ ...sampleTx, ...overrides })
  if (res.status !== 201) throw new Error(`createTx failed: ${JSON.stringify(res.body)}`)
  return res.body.data
}
