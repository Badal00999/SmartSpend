# SpendWise API – Reference

Base URL (local): **`http://localhost:4000/api/v1`**
Interactive docs (Swagger UI): **`http://localhost:4000/api/docs`** · Raw spec: `/api/v1/openapi.json`
Postman collection: [`SpendWise-API.postman_collection.json`](./SpendWise-API.postman_collection.json)

---

## Conventions

### Response envelope
Every response has the same shape, so clients can handle it uniformly.

```jsonc
// success
{ "success": true, "data": { ... }, "meta": { ... } }   // meta only on paginated lists

// failure
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "Validation failed",
                               "details": [ { "field": "amount", "message": "Amount must be greater than zero" } ] } }
```

### Authentication
Obtain a JWT from `POST /auth/register` or `POST /auth/login`, then send it on every protected request:

```
Authorization: Bearer <token>
```
Tokens expire after 7 days (configurable via `JWT_EXPIRES_IN`).

### Status codes
| Code | Meaning |
|---|---|
| 200 | OK |
| 201 | Created |
| 204 | Deleted (no body) |
| 400 | Malformed JSON / bad value |
| 401 | Missing, invalid or expired token; wrong credentials |
| 403 | Forbidden (role / CORS) |
| 404 | Route or resource not found (also returned for another user's resource – no data leak) |
| 409 | Conflict (duplicate email) |
| 413 | Body larger than 100 kB |
| 422 | Validation failed – see `error.details` |
| 429 | Rate limit exceeded (300 req / 15 min per IP; 20 / 15 min on register & login) |
| 500 | Unexpected server error |

### Data types
* **Dates** are strings `YYYY-MM-DD` (cannot be in the future).
* **Amounts** are numbers `> 0` and `≤ 10,000,000`.
* **Enums**
  * `type`: `income` · `expense`
  * `category`: `food` · `transport` · `shopping` · `bills` · `entertainment` · `health` · `education` · `travel` · `salary` · `freelance` · `other`
  * `payment`: `upi` · `card` · `cash` · `bank` · `wallet`

---

## Endpoint summary

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | – | Liveness + DB status |
| GET | `/meta/categories` | – | Enum values for dropdowns |
| POST | `/auth/register` | – | Create account → user + token |
| POST | `/auth/login` | – | Log in → user + token |
| GET | `/auth/me` | ✔ | Current profile |
| PATCH | `/auth/me` | ✔ | Update name / currency |
| PATCH | `/auth/password` | ✔ | Change password |
| GET | `/transactions` | ✔ | List with filters, search, sort, pagination |
| POST | `/transactions` | ✔ | Create |
| POST | `/transactions/bulk` | ✔ | Create up to 500 at once |
| GET | `/transactions/:id` | ✔ | Read one |
| PATCH | `/transactions/:id` | ✔ | Partial update |
| DELETE | `/transactions/:id` | ✔ | Delete |
| GET | `/stats/summary` | ✔ | Totals, balance, this-month |
| GET | `/stats/by-category` | ✔ | Expense split by category |
| GET | `/stats/monthly` | ✔ | Income vs expense per month |

---

## Meta

### `GET /health`
```json
{ "success": true, "data": { "status": "ok", "uptime": 42, "database": "connected", "timestamp": "2026-09-04T10:00:00.000Z" } }
```

### `GET /meta/categories`
```json
{ "success": true, "data": { "types": ["income","expense"], "categories": ["food", "..."], "paymentMethods": ["upi","card","cash","bank","wallet"] } }
```

---

## Auth

### `POST /auth/register`
| Field | Type | Rules |
|---|---|---|
| `name` | string | required, 2–60 chars |
| `email` | string | required, valid email, stored lower-case, unique |
| `password` | string | required, 8–72 chars, at least one letter and one number |
| `currency` | string | optional, 3-letter ISO code, default `INR` |

**Request**
```json
{ "name": "Badal", "email": "badal@example.com", "password": "Passw0rd123" }
```
**Response `201`**
```json
{ "success": true, "data": {
    "user": { "id": "66d5…", "name": "Badal", "email": "badal@example.com", "currency": "INR", "role": "user",
              "createdAt": "2026-09-04T09:00:00.000Z", "updatedAt": "2026-09-04T09:00:00.000Z" },
    "token": "eyJhbGciOiJIUzI1NiIs…" } }
```
Errors: `409 CONFLICT` (email exists), `422 VALIDATION_ERROR`, `429`.

### `POST /auth/login`
```json
{ "email": "badal@example.com", "password": "Passw0rd123" }
```
Response `200` – same body as register. Wrong email **or** password → `401 "Invalid email or password"` (identical message, so attackers can't enumerate accounts).

### `GET /auth/me` → `200 { data: { user } }`

### `PATCH /auth/me`
Body: any of `name`, `currency` (at least one). → `200 { data: { user } }`

### `PATCH /auth/password`
```json
{ "currentPassword": "Passw0rd123", "newPassword": "NewPassw0rd" }
```
→ `200 { data: { message: "Password updated", token: "<fresh token>" } }` · wrong current password → `401`.

---

## Transactions

### Transaction object
```json
{
  "id": "66d5f1a2b3c4d5e6f7a8b9c1",
  "user": "66d5f1a2b3c4d5e6f7a8b9c0",
  "title": "Grocery run",
  "amount": 2340,
  "type": "expense",
  "category": "food",
  "payment": "upi",
  "date": "2026-09-03",
  "notes": "Weekly vegetables",
  "createdAt": "2026-09-04T09:10:00.000Z",
  "updatedAt": "2026-09-04T09:10:00.000Z"
}
```

### `GET /transactions`
Query parameters (all optional):

| Param | Type | Default | Description |
|---|---|---|---|
| `page` | int ≥ 1 | 1 | Page number |
| `limit` | int 1–100 | 20 | Page size |
| `type` | enum | – | `income` / `expense` |
| `category` | enum | – | Category filter |
| `payment` | enum | – | Payment-method filter |
| `from`, `to` | date | – | Inclusive date range |
| `q` | string ≤ 60 | – | Case-insensitive search in `title` and `notes` |
| `minAmount`, `maxAmount` | number | – | Amount range |
| `sort` | `date` `-date` `amount` `-amount` `createdAt` `-createdAt` | `-date` | `-` prefix = descending |

**Example** `GET /transactions?type=expense&category=food&from=2026-09-01&sort=-amount&limit=5`

**Response `200`**
```json
{ "success": true,
  "data": [ { "...transaction" } ],
  "meta": { "page": 1, "limit": 5, "total": 12, "totalPages": 3, "hasNext": true, "hasPrev": false } }
```

### `POST /transactions`
| Field | Required | Rules |
|---|---|---|
| `title` | ✔ | 1–60 chars |
| `amount` | ✔ | number > 0 (numeric strings are coerced) |
| `type` | ✔ | enum |
| `category` | ✔ | enum |
| `date` | ✔ | `YYYY-MM-DD`, not in the future |
| `payment` | – | enum, default `upi` |
| `notes` | – | ≤ 200 chars, default `""` |

→ `201 { data: transaction }` · invalid → `422` with `details[]`.

**Validation error example**
```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "Validation failed",
  "details": [ { "field": "title", "message": "Title is required" },
               { "field": "amount", "message": "Amount must be greater than zero" },
               { "field": "date", "message": "Date cannot be in the future" } ] } }
```

### `POST /transactions/bulk`
Body: JSON **array** (1–500) of transaction inputs. → `201 { data: { count, items } }`. Field errors are prefixed with the index, e.g. `"field": "3.amount"`.

### `GET /transactions/:id` → `200 { data: transaction }` · `404` if not found or owned by someone else · `422` if the id is not a 24-hex string.

### `PATCH /transactions/:id`
Body: any subset of the create fields (at least one; unknown fields → `422`). Only the sent fields change.
```json
{ "amount": 2500, "notes": "Updated after receipt" }
```
→ `200 { data: transaction }`

### `DELETE /transactions/:id` → `204` (empty body) · `404`.

---

## Stats

### `GET /stats/summary?from&to`
```json
{ "success": true, "data": {
    "income": 445000, "expense": 49625, "balance": 395375, "transactionCount": 32,
    "thisMonth": { "income": 85000, "expense": 3249 }, "currency": "INR" } }
```
`from`/`to` restrict the all-time figures; `thisMonth` is always the current calendar month.

### `GET /stats/by-category?from&to`
```json
{ "success": true,
  "data": [ { "category": "travel", "total": 12000, "count": 2, "percent": 24.2 },
            { "category": "food",   "total": 11630, "count": 5, "percent": 23.4 } ],
  "meta": { "totalExpense": 49625 } }
```
Expenses only, sorted by `total` descending.

### `GET /stats/monthly?months=6`
`months` 1–24 (default 6). Oldest → newest; months with no data are included with zeros.
```json
{ "success": true, "data": [ { "month": "2026-04", "income": 85000, "expense": 5840 }, { "month": "2026-05", "income": 85000, "expense": 11250 } ] }
```

---

## cURL quick start
```bash
BASE=http://localhost:4000/api/v1

# 1) register (or login with demo@spendwise.app / Demo1234)
TOKEN=$(curl -s -X POST $BASE/auth/register -H 'Content-Type: application/json' \
  -d '{"name":"Badal","email":"badal@example.com","password":"Passw0rd123"}' | jq -r .data.token)

# 2) create
curl -s -X POST $BASE/transactions -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"Grocery run","amount":2340,"type":"expense","category":"food","date":"2026-09-03"}'

# 3) list + stats
curl -s "$BASE/transactions?type=expense&limit=5" -H "Authorization: Bearer $TOKEN"
curl -s $BASE/stats/summary -H "Authorization: Bearer $TOKEN"
```
