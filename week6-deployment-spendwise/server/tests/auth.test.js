import { describe, it, expect } from 'vitest'
import { api, auth, registerAndLogin, validUser } from './helpers.js'

describe('POST /api/v1/auth/register', () => {
  it('creates a user, hashes the password and returns a token', async () => {
    const res = await api().post('/api/v1/auth/register').send(validUser)

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.token).toMatch(/^eyJ/)
    expect(res.body.data.user).toMatchObject({ name: 'Badal', email: 'badal@example.com', currency: 'INR', role: 'user' })
    expect(res.body.data.user.password).toBeUndefined()
    expect(res.body.data.user.id).toBeDefined()
  })

  it('normalises the email to lower-case', async () => {
    const res = await api().post('/api/v1/auth/register').send({ ...validUser, email: 'BADAL@Example.COM' })
    expect(res.status).toBe(201)
    expect(res.body.data.user.email).toBe('badal@example.com')
  })

  it('rejects a duplicate email with 409', async () => {
    await registerAndLogin()
    const res = await api().post('/api/v1/auth/register').send(validUser)
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('CONFLICT')
  })

  it('returns field-level validation errors with 422', async () => {
    const res = await api().post('/api/v1/auth/register').send({ name: 'B', email: 'nope', password: 'short' })
    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    const fields = res.body.error.details.map((d) => d.field)
    expect(fields).toEqual(expect.arrayContaining(['name', 'email', 'password']))
  })

  it('requires a number in the password', async () => {
    const res = await api().post('/api/v1/auth/register').send({ ...validUser, password: 'onlyletters' })
    expect(res.status).toBe(422)
    expect(res.body.error.details[0].message).toMatch(/number/)
  })
})

describe('POST /api/v1/auth/login', () => {
  it('logs in with correct credentials', async () => {
    await registerAndLogin()
    const res = await api().post('/api/v1/auth/login').send({ email: validUser.email, password: validUser.password })
    expect(res.status).toBe(200)
    expect(res.body.data.token).toBeDefined()
    expect(res.body.data.user.email).toBe(validUser.email)
  })

  it('returns 401 for a wrong password (same message as unknown email)', async () => {
    await registerAndLogin()
    const wrongPw = await api().post('/api/v1/auth/login').send({ email: validUser.email, password: 'Wrong1234' })
    const unknown = await api().post('/api/v1/auth/login').send({ email: 'ghost@example.com', password: 'Wrong1234' })
    expect(wrongPw.status).toBe(401)
    expect(unknown.status).toBe(401)
    expect(wrongPw.body.error.message).toBe(unknown.body.error.message)
  })
})

describe('GET /api/v1/auth/me', () => {
  it('returns the profile for a valid token', async () => {
    const { token } = await registerAndLogin()
    const res = await api().get('/api/v1/auth/me').set(auth(token))
    expect(res.status).toBe(200)
    expect(res.body.data.user.email).toBe(validUser.email)
  })

  it('rejects a missing token', async () => {
    const res = await api().get('/api/v1/auth/me')
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('UNAUTHORIZED')
  })

  it('rejects a tampered token', async () => {
    const { token } = await registerAndLogin()
    const res = await api().get('/api/v1/auth/me').set(auth(token.slice(0, -4) + 'abcd'))
    expect(res.status).toBe(401)
    expect(res.body.error.message).toMatch(/invalid token/i)
  })

  it('rejects a non-Bearer scheme', async () => {
    const res = await api().get('/api/v1/auth/me').set({ Authorization: 'Basic abc' })
    expect(res.status).toBe(401)
  })
})

describe('PATCH /api/v1/auth/me and /password', () => {
  it('updates the profile', async () => {
    const { token } = await registerAndLogin()
    const res = await api().patch('/api/v1/auth/me').set(auth(token)).send({ name: 'Badal Kumar', currency: 'usd' })
    expect(res.status).toBe(200)
    expect(res.body.data.user).toMatchObject({ name: 'Badal Kumar', currency: 'USD' })
  })

  it('rejects an empty profile update', async () => {
    const { token } = await registerAndLogin()
    const res = await api().patch('/api/v1/auth/me').set(auth(token)).send({})
    expect(res.status).toBe(422)
  })

  it('changes the password and the old one stops working', async () => {
    const { token } = await registerAndLogin()
    const change = await api()
      .patch('/api/v1/auth/password')
      .set(auth(token))
      .send({ currentPassword: validUser.password, newPassword: 'NewPassw0rd' })
    expect(change.status).toBe(200)

    const old = await api().post('/api/v1/auth/login').send({ email: validUser.email, password: validUser.password })
    const fresh = await api().post('/api/v1/auth/login').send({ email: validUser.email, password: 'NewPassw0rd' })
    expect(old.status).toBe(401)
    expect(fresh.status).toBe(200)
  })

  it('refuses to change the password when the current one is wrong', async () => {
    const { token } = await registerAndLogin()
    const res = await api()
      .patch('/api/v1/auth/password')
      .set(auth(token))
      .send({ currentPassword: 'Wrong1234', newPassword: 'NewPassw0rd' })
    expect(res.status).toBe(401)
  })
})
