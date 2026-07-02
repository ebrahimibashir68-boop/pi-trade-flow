# PiVerify API Documentation

**Base URL:** `https://backend.piverify-czgzri81fq2lioqn.staging.piappengine.com`

---

## Get started

### Overview

PiVerify lets you verify the identity of your users in three steps:

1. **Create a session** — Your backend calls the PiVerify API to create a verification session and receives a hosted flow URL.
2. **Launch the hosted flow** — Redirect the user to the hosted URL or embed it via the JS SDK. They complete ID upload and liveness checks.
3. **Handle the result** — PiVerify sends a webhook to your server with the outcome, or you can poll the session status via the API.

**Before you begin** you'll need:
- A PiVerify account with at least one sandbox API key
- A server-side environment (Node.js, Python, Ruby, Go, etc.) to call the API
- A publicly reachable URL for receiving webhooks (use ngrok for local dev)

> **Sandbox vs Production:** All examples use sandbox keys. Sandbox sessions return simulated results and do not count toward billing.

---

### Quickstart

#### 1. Get your API key

Go to **API Keys** and copy your sandbox secret key.

#### 2. Create a session

Call `POST /api/v1/kyc_sessions` from your server. Never call this from the browser — your API key must stay server-side.

```bash
curl -X POST https://backend.piverify-czgzri81fq2lioqn.staging.piappengine.com/api/v1/kyc_sessions \
  -H "Authorization: Bearer sbx_..." \
  -H "Content-Type: application/json" \
  -d '{"external_user_id": "user_abc123", "idempotency_key": "order_123_kyc_1"}'
```

**Response:**

```json
{
  "id": "ks_4xKq8mNpL2vRtZ7w",
  "external_user_id": "user_abc123",
  "status": "created",
  "hosted_flow_url": "https://kyc-kcz3w8hw6nyyrwwy.piappengine.com/piverify/sandbox/verify/abc123...",
  "rejection_reason": null,
  "created_at": "2026-05-27T12:00:00Z",
  "updated_at": "2026-05-27T12:00:00Z"
}
```

#### 3. Redirect your user

Send your user to `hosted_flow_url` — as a redirect, a link, or embedded via the JS SDK.

```javascript
window.location.href = session.hosted_flow_url
```

#### 4. Receive the result

Configure your webhook URL in the **Webhooks** page. When verification completes, PiVerify posts a `kyc.session.approved` or `kyc.session.rejected` event to your endpoint.

```json
{
  "id": "evt_Xr9kLmP2qNvT5wZb",
  "type": "kyc.session.approved",
  "created_at": "2026-05-27T12:00:00Z",
  "data": {
    "session_id": "ks_4xKq8mNpL2vRtZ7w",
    "external_user_id": "user_abc123",
    "status": "approved",
    "rejection_reason": null
  }
}
```

---

### Authentication

PiVerify uses API keys to authenticate requests. All API calls must include your secret key in the `Authorization` header as a Bearer token.

```http
Authorization: Bearer sbx_4eC39HqLyjWDarjtT7en
```

> **Keep your secret key secret.** Never expose it in client-side code, public repositories, or logs. Rotate it immediately from the API Keys page if compromised.

| Key prefix | Environment | Description |
|---|---|---|
| `sbx_` | Sandbox | Simulated results, no billing. Use for development and testing. |
| `live_` | Production | Real verifications. Triggers real identity checks and deducts credits. |

---

## Integration

### Create a session

A verification session represents one user's verification attempt. Sessions are single-use.

#### POST /api/v1/kyc_sessions

```javascript
const response = await fetch('https://backend.piverify-czgzri81fq2lioqn.staging.piappengine.com/api/v1/kyc_sessions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    external_user_id: 'usr_12345',
    idempotency_key: 'order_123_kyc_1',
  }),
})
const session = await response.json()
```

**Request parameters:**

| Parameter | Type | Description |
|---|---|---|
| `external_user_id` | string · required | Your internal user identifier. |
| `idempotency_key` | string · required | Unique key for safe retries. Valid for 24 hours. |

**Session object:**

| Field | Type | Description |
|---|---|---|
| `id` | string | Unique session identifier. Prefix: `ks_` |
| `status` | string | `created` · `started` · `pending_review` · `approved` · `rejected` · `failed` |
| `hosted_flow_url` | string | URL to redirect your user to complete verification. |
| `external_user_id` | string | The user ID you supplied when creating the session. |
| `rejection_reason` | string? | Present when status is `rejected`. |
| `allowed_action` | string? | Present on rejected sessions. When set, redirect user back to `hosted_flow_url` — Pi KYC handles the resubmission (`RESUBMIT`) or appeal (`APPEAL`). Absent when no further action is available. |
| `created_at` | string | ISO 8601 timestamp when the session was created. |
| `updated_at` | string | ISO 8601 timestamp of the last status change. |

---

### Webhooks

PiVerify sends real-time events to your server when a session status changes. Register a webhook endpoint in the **Webhooks** page.

#### Supported events

| Event | Trigger |
|---|---|
| `kyc.session.started` | User opened the hosted verification flow. |
| `kyc.session.pending_review` | User submitted documents; verification in progress. |
| `kyc.session.approved` | Verification passed. |
| `kyc.session.rejected` | Verification failed. `rejection_reason` is set. |
| `kyc.session.failed` | Provider error — session cannot be completed. |

#### Payload example

```json
{
  "id": "evt_Xr9kLmP2qNvT5wZb",
  "type": "kyc.session.rejected",
  "created_at": "2026-05-27T12:00:00Z",
  "data": {
    "session_id": "ks_4xKq8mNpL2vRtZ7w",
    "external_user_id": "usr_12345",
    "status": "rejected",
    "rejection_reason": "unclear_photo",
    "allowed_action": "RESUBMIT"
  }
}
```

`allowed_action` is only present on `kyc.session.rejected` events. When present (`RESUBMIT` or `APPEAL`), redirect the user back to the session's `hosted_flow_url` — Pi KYC's hosted flow handles the resubmission or appeal. When absent, the flow is complete and no further action is available.

#### Verify webhook signatures

Every webhook request includes an `X-PiVerify-Signature` header. The value is `sha256=<hex>` — HMAC-SHA256 of the raw request body signed with your webhook secret.

```javascript
const crypto = require('crypto')

function verifyWebhook(rawBody, signature, secret) {
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signature)
  )
}

app.post('/webhooks/piverify', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['x-piverify-signature']
  if (!verifyWebhook(req.body, sig, process.env.WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature')
  }
  const event = JSON.parse(req.body)
  // handle event.type ...
  res.sendStatus(200)
})
```

#### Retry behaviour

Failed deliveries are retried up to 5 times with exponential backoff. A delivery is considered failed if your endpoint returns a non-2xx status or times out (10 s). You can also manually redeliver from the Webhooks page.

---

### Environments

PiVerify provides separate sandbox and production environments so you can build and test without affecting real data or incurring charges.

**Sandbox** — All verifications return simulated results. Use sandbox API keys during development. No billing applies. Sandbox sessions always complete with a deterministic result based on the test user ID provided.

**Production** — Production API keys trigger real identity checks and deduct credits. Contact the PiVerify team from the Dashboard to activate production access.

---

## API Reference

### Sessions API

Full reference for the `/api/v1/kyc_sessions` endpoints.

#### POST /api/v1/kyc_sessions

Create a new verification session. Idempotent when the same `idempotency_key` is reused within 24 hours.

| Code | Meaning |
|---|---|
| `201` | Session created (or idempotent replay of a successful creation). |
| `402` | Insufficient credits. Contact PiVerify to add credits to your account. |
| `422` | Validation error — see the `error` field. |
| `502` | Verification provider unavailable — retry with a new `idempotency_key`. |

#### GET /api/v1/kyc_sessions/:id

Retrieve a session by ID.

```bash
curl https://backend.piverify-czgzri81fq2lioqn.staging.piappengine.com/api/v1/kyc_sessions/ks_4xKq8mNpL2vRtZ7w \
  -H "Authorization: Bearer sbx_4eC39HqLyjWDarjtT7en"
```

#### GET /api/v1/kyc_sessions/:id/sdk_token

Issue a short-lived token for the JS SDK embed. Token expires in 15 minutes.

---

### Identity Checks

PiVerify runs a fixed set of automated AI checks on every verification session.

| Check | Description |
|---|---|
| ID validation | Document authenticity (tamper/forgery detection) and expiry check. |
| Data comparison | Face on document matches the selfie photo. |
| Liveness + selfie | Anti-spoofing — ensures the selfie is a live person, not a photo of a photo. |



---

### Errors

PiVerify uses standard HTTP status codes. Error responses include a single `error` field with a human-readable message.

```json
{
  "error": "Insufficient credits. Contact PiVerify to add credits to your account."
}
```

| Code | Status | Description |
|---|---|---|
| `unauthorized` | 401 | The API key is missing, revoked, or incorrect. |
| `session_not_found` | 404 | No session with that ID in this environment. |
| `payment_required` | 402 | Credit balance is zero. Contact PiVerify to add credits to your account. |
| `rate_limit_exceeded` | 429 | Too many requests. Back off and retry after a short delay. |
| `provider_error` | 502 | Verification provider unavailable — retry with a new `idempotency_key`. |

---

## SDKs

### JavaScript SDK

Embed the PiVerify verification flow directly in your web app using the JavaScript SDK.

#### Install

```html
<script src="https://backend.piverify-czgzri81fq2lioqn.staging.piappengine.com/sdk/piverify.js"></script>
```

#### Initialize

Fetch an SDK token server-side (a short-lived opaque token tied to the session, keeping your API key off the browser), then initialise the SDK in the browser.

```javascript
// Server side — fetch token
const res = await fetch(
  `https://backend.piverify-czgzri81fq2lioqn.staging.piappengine.com/api/v1/kyc_sessions/${sessionId}/sdk_token`,
  { headers: { 'Authorization': `Bearer ${process.env.PIVERIFY_API_KEY}` } }
)
const { sdk_token } = await res.json()

// Browser side — embed
const kyc = PiKYC.init({
  sdkToken:   sdk_token,
  container:  '#kyc-container',   // CSS selector or DOM element
  onComplete: ({ status }) => {
    console.log('KYC result:', status)  // 'approved' | 'rejected'
  },
  onError: ({ message }) => {
    console.error('KYC error:', message)
  },
})

// Tear down the iframe when done
kyc.destroy()
```

#### Options

| Option | Type | Description |
|---|---|---|
| `sdkToken` | string · required | Short-lived JWT from `GET /api/v1/kyc_sessions/:id/sdk_token`. |
| `container` | string \| Element · required | CSS selector or DOM element to render the iframe into. |
| `onComplete` | function | Called with `{ status }` when verification finishes. |
| `onError` | function | Called with `{ message }` on SDK or iframe errors. |

#### Security

The SDK token is short-lived — fetch it immediately before calling `PiKYC.init()`. Your API key stays server-side and is never sent to the browser. The `postMessage` origin is validated so only messages from the PiVerify domain are accepted.

---

### REST API

Use the PiVerify REST API directly from any language or HTTP client.

**Base URL:** `https://backend.piverify-czgzri81fq2lioqn.staging.piappengine.com`

#### Python example

```python
import requests

response = requests.post(
    "https://backend.piverify-czgzri81fq2lioqn.staging.piappengine.com/api/v1/kyc_sessions",
    headers={"Authorization": f"Bearer {PIVERIFY_API_KEY}"},
    json={
        "external_user_id": "usr_12345",
        "idempotency_key": "order_123_kyc_1",
    }
)
session = response.json()
```

#### Ruby example

```ruby
require 'net/http'
require 'json'

uri = URI('https://backend.piverify-czgzri81fq2lioqn.staging.piappengine.com/api/v1/kyc_sessions')
req = Net::HTTP::Post.new(uri, {
  'Authorization' => "Bearer #{ENV['PIVERIFY_API_KEY']}",
  'Content-Type'  => 'application/json'
})
req.body = { external_user_id: 'usr_12345', idempotency_key: 'order_123_kyc_1' }.to_json
res = Net::HTTP.start(uri.hostname, uri.port, use_ssl: true) { |h| h.request(req) }
session = JSON.parse(res.body)
```
