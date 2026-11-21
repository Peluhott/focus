import { test } from '@japa/runner'
import User from '#models/user'
import { resetDb } from '#tests/helpers'

const EMAIL = 'me@example.com'
const PASSWORD = 'correct horse battery'

test.group('Auth', (group) => {
  group.each.setup(async () => {
    await resetDb()
    await User.create({ email: EMAIL, password: PASSWORD, focusLimit: 3, aiEnabled: true })
  })

  test('health needs no login', async ({ client }) => {
    const response = await client.get('/api/v1/health')
    response.assertStatus(200)
    response.assertBody({ ok: true })
  })

  test('me without a session is 401 unauthorized', async ({ client }) => {
    const response = await client.get('/api/v1/auth/me')
    response.assertStatus(401)
    response.assertBodyContains({ error: { code: 'unauthorized' } })
  })

  test('wrong password is 401 invalid_credentials', async ({ client }) => {
    const response = await client
      .post('/api/v1/auth/login')
      .json({ email: EMAIL, password: 'nope' })
      .withCsrfToken()
    response.assertStatus(401)
    response.assertBodyContains({ error: { code: 'invalid_credentials' } })
  })

  test('bad input is 422 validation_error', async ({ client }) => {
    const response = await client
      .post('/api/v1/auth/login')
      .json({ email: 'not-an-email' })
      .withCsrfToken()
    response.assertStatus(422)
    response.assertBodyContains({ error: { code: 'validation_error' } })
  })

  test('login without a CSRF token is refused', async ({ client }) => {
    const response = await client
      .post('/api/v1/auth/login')
      .json({ email: EMAIL, password: PASSWORD })
    response.assertStatus(403)
  })

  test('login returns the user without the password hash', async ({ client, assert }) => {
    const response = await client
      .post('/api/v1/auth/login')
      .json({ email: EMAIL, password: PASSWORD })
      .withCsrfToken()
    response.assertStatus(200)
    assert.equal(response.body().user.email, EMAIL)
    assert.notProperty(response.body().user, 'password')
  })

  test('me with a session returns the user', async ({ client }) => {
    const user = await User.findByOrFail('email', EMAIL)
    const response = await client.get('/api/v1/auth/me').loginAs(user)
    response.assertStatus(200)
    response.assertBodyContains({ user: { email: EMAIL, focus_limit: 3 } })
  })

  test('the 6th login attempt in a minute is 429 rate_limited', async ({ client }) => {
    for (let i = 0; i < 5; i++) {
      await client
        .post('/api/v1/auth/login')
        .json({ email: EMAIL, password: 'nope' })
        .withCsrfToken()
    }
    const response = await client
      .post('/api/v1/auth/login')
      .json({ email: EMAIL, password: PASSWORD })
      .withCsrfToken()
    response.assertStatus(429)
    response.assertBodyContains({ error: { code: 'rate_limited' } })
  })
})
