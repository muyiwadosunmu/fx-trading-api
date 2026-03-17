# FX Trading API

Backend API for authentication, admin operations, wallets, FX quotes/conversions, and transfers.

## Stack

- NestJS + TypeScript
- TypeORM + PostgreSQL
- JWT authentication
- In-memory cache via `@nestjs/cache-manager`
- ExchangeRate API integration for FX rates

## Assumptions (Important)

- All money inputs/outputs in wallet APIs are minor units (`amountMinor`).
- Wallet balances and transaction amounts are stored as integer minor units (`bigint` in DB).
- FX provider rates are major-unit rates (for example `1 USD = 1500 NGN`).
- Conversion logic converts source minor to major before applying FX rate, then floors to destination minor.
- Spread and fee are configured in basis points (`bps`): `10_000 bps = 100%`.
- Funding and transfers require `x-idempotency-key` header.
- Wallets are lazily created when a currency wallet does not exist.
- On successful OTP verification, initial wallets are seeded for `USD`, `NGN`, and `GBP`.

## Environment Variables

Create `.env` in the project root.

```env
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=fx_trading_db

# Auth
ACCESS_TOKEN_SECRET=replace_with_secure_secret
JWT_EXPIRY=86400

# FX Provider
EXCHANGE_RATE_API_BASE_URL=https://v6.exchangerate-api.com/v6
EXCHANGE_RATE_API_KEY=replace_with_valid_key

# Optional FX pricing controls
FX_SPREAD_BPS=0
FX_FEE_BPS=0

# Email / Zeptomail
ZEPTOMAIL_FROM_EMAIL=replace_with_sender
ZEPTOMAIL_API_KEY=replace_with_api_key
```

## Install

```bash
npm install --legacy-peer-deps
```

## Run

```bash
# development (watch)
npm run start:dev

# production
npm run build
npm run start:prod
```

## Migrations

```bash
npm run build
npm run typeorm:run-migrations
```

To create a new migration:

```bash
npm run typeorm:create-migration --name=YourMigrationName
```

## Authentication

- User token is obtained from `POST /v1/auth/login`.
- Admin token is obtained from `POST /v1/admin/login`.
- Protected routes require `Authorization: Bearer <token>`.

## Idempotency Rules

- `POST /v1/wallet/fund` requires `x-idempotency-key`.
- `POST /v1/wallet/transfer` requires `x-idempotency-key`.
- If a request with the same key is replayed, API returns existing transaction result instead of duplicating effects.

## FX and Trading Rules

- Quote and conversion reject same-currency pair.
- Amount must be a positive integer in minor units.
- Quote breakdown includes gross amount, spread, fee, net amount, and rounding metadata.
- Effective rate reflects post-fee/spread realized conversion.

## API Summary

### Auth

- `POST /v1/auth/register` create user and send OTP.
- `POST /v1/auth/verify` verify OTP and seed initial wallets.
- `POST /v1/auth/login` login user and return JWT.
- `GET /v1/auth/me` get current user profile (protected).

### Admin

- `POST /v1/admin/register` create first super admin (one-time bootstrap).
- `POST /v1/admin/login` admin login.
- `GET /v1/admin/me` get current admin profile (protected).
- `PATCH /v1/admin/me` update current admin profile (protected).
- `POST /v1/admin/create` super admin creates another admin.
- `GET /v1/admin/users` list/search/sort users with pagination.
- `PATCH /v1/admin/users/:id/suspend` suspend user.
- `PATCH /v1/admin/users/:id/unsuspend` unsuspend user.
- `PATCH /v1/admin/admins/:id/suspend` suspend admin (super admin only).
- `PATCH /v1/admin/admins/:id/unsuspend` unsuspend admin (super admin only).

### Wallet

- `GET /v1/wallet` list my balances.
- `POST /v1/wallet/fund` fund a wallet (minor units, idempotent).
- `POST /v1/wallet/quote` get conversion quote breakdown (minor units).
- `POST /v1/wallet/convert` perform conversion.
- `POST /v1/wallet/trade` same conversion path but marked as `TRADE` transaction type.
- `POST /v1/wallet/transfer` transfer to another user by recipient email.
- `GET /v1/wallet/transactions` list history with pagination and filters.
- `GET /v1/wallet/transactions/:id` fetch single transaction.

### FX

- `GET /v1/fx/rates?base=USD` get provider rates by base currency.

## Wallet API Examples

### Fund Wallet

`POST /v1/wallet/fund`

Headers:

- `Authorization: Bearer <token>`
- `x-idempotency-key: fund-001`

Body:

```json
{
  "currency": "USD",
  "amountMinor": 10000
}
```

### Quote/Convert

`GET /v1/wallet/quote?fromCurrency=USD&toCurrency=NGN` with body:

```json
{
  "amountMinor": 10000
}
```

Interpretation:

- `amountMinor=10000` means `100.00 USD` (2-decimal currency).
- Rate and bps are applied in major space, then converted/floored to destination minor.

### Transfer Funds

`POST /v1/wallet/transfer`

Headers:

- `Authorization: Bearer <token>`
- `x-idempotency-key: UUID-string`

Body:

```json
{
  "recipientEmail": "recipient@example.com",
  "currency": "USD",
  "amountMinor": 5000
}
```

## Error Model

Common API error classes:

- `400 Bad Request`: validation, insufficient funds, unsupported conversion.
- `401 Unauthorized`: invalid/missing auth token.
- `404 Not Found`: missing user/transaction/admin.
- `409 Conflict`: duplicate entity (for example duplicate email).

Errors are returned through the global error filter and API response wrappers.

## Testing

Run all unit tests:

```bash
npm test
```

Run e2e tests:

```bash
npm test:e2e
```

Wallet/trading unit tests are in:

- `src/modules/v1/wallet/wallet.service.spec.ts`

## Known Gaps / Future Improvements

- Add full e2e path and failure-path coverage for wallet conversion and transfer.
- Replace number-based arithmetic with a decimal library for very large-value operations.
- Add structured audit logs for pricing decisions and idempotency replay tracing.
- Porting Email and some core works to a worker like BullMq for better scalability
