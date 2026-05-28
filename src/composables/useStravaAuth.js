import { ref, computed } from 'vue'

const AUTH_URL    = 'https://www.strava.com/oauth/authorize'
const TOKEN_URL   = 'https://www.strava.com/oauth/token'
const SCOPE       = 'activity:read_all'
const TOKEN_KEY   = 'strava_token'

const CLIENT_ID     = import.meta.env.VITE_STRAVA_CLIENT_ID
const CLIENT_SECRET = import.meta.env.VITE_STRAVA_CLIENT_SECRET

function tryParse(s) {
  try { return s ? JSON.parse(s) : null } catch { return null }
}

export function useStravaAuth() {
  const token = ref(tryParse(localStorage.getItem(TOKEN_KEY)))
  const error = ref(null)

  const isConnected = computed(
    () => !!(token.value?.access_token && token.value.expires_at > Date.now() / 1000),
  )
  const athlete = computed(() => token.value?.athlete ?? null)

  // ── OAuth redirect ──────────────────────────────────────────────────────────

  function authorize() {
    const redirectUri = window.location.origin + window.location.pathname
    const params = new URLSearchParams({
      client_id:       CLIENT_ID,
      redirect_uri:    redirectUri,
      response_type:   'code',
      approval_prompt: 'auto',
      scope:           SCOPE,
    })
    window.location.href = `${AUTH_URL}?${params}`
  }

  // ── Callback — call on app mount when ?code= is present ────────────────────

  async function handleCallback() {
    const params      = new URLSearchParams(window.location.search)
    const code        = params.get('code')
    const stravaError = params.get('error')

    if (!code && !stravaError) return false

    window.history.replaceState({}, '', window.location.pathname)

    if (stravaError) {
      error.value = `Strava authorization denied.`
      return false
    }

    try {
      const res = await fetch(TOKEN_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id:     CLIENT_ID,
          client_secret: CLIENT_SECRET,
          code,
          grant_type:    'authorization_code',
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message || `Token exchange failed (${res.status})`)
      }

      token.value = await res.json()
      localStorage.setItem(TOKEN_KEY, JSON.stringify(token.value))
      return true
    } catch (e) {
      error.value = e.message
      return false
    }
  }

  // ── Token refresh ───────────────────────────────────────────────────────────

  async function getAccessToken() {
    if (!token.value) throw new Error('Not connected to Strava.')

    if (token.value.expires_at > Date.now() / 1000 + 60) {
      return token.value.access_token
    }

    const res = await fetch(TOKEN_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id:     CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: token.value.refresh_token,
        grant_type:    'refresh_token',
      }),
    })

    if (!res.ok) {
      token.value = null
      localStorage.removeItem(TOKEN_KEY)
      throw new Error('Strava session expired. Please reconnect.')
    }

    const data = await res.json()
    token.value = { ...token.value, ...data }
    localStorage.setItem(TOKEN_KEY, JSON.stringify(token.value))
    return token.value.access_token
  }

  // ── Disconnect ──────────────────────────────────────────────────────────────

  function disconnect() {
    token.value = null
    error.value = null
    localStorage.removeItem(TOKEN_KEY)
  }

  return { token, error, isConnected, athlete, authorize, handleCallback, getAccessToken, disconnect }
}
