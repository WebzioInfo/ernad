## Database Migration Setup - Drizzle ORM

### ✅ What's Ready
- **Modern Drizzle Config**: Updated `drizzle.config.ts` to use `dialect: 'postgresql'`.
- **Standardized Scripts**: Added `db:push`, `db:seed`, and `db:studio` to `package.json`.
- **Improved Seeding**: Migrated to `src/db/seed.ts` with robust operator seeding using `tsx`.

### 🔧 How to Sync & Seed
If you have a working connection string (IPv4 compatible), follow these steps:

1. **Update .env**:
   Ensure `DATABASE_URL` is correct. Use the **Pooler** URL for IPv4 environments:
   ```
   DATABASE_URL='postgresql://postgres.[project-id]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres?sslmode=require'
   ```

2. **Sync Schema**:
   ```bash
   cd backend
   npm run db:push
   ```

3. **Seed Database**:
   ```bash
   npm run db:seed
   ```

4. **Explore Data**:
   ```bash
   npm run db:studio
   ```

### ❌ Troubleshooting "Tenant or user not found"
If you get this error from Supabase:
- **Check Project ID**: Ensure `[project-id]` in the username (`postgres.[project-id]`) exactly matches your Supabase project ref.
- **Check Password**: Standard password is required.
- **Check Region**: Ensure the region segment in the hostname is correct (e.g., `us-east-1`).
- **IPv6 vs IPv4**: Direct connection `db.[id].supabase.co` is IPv6-only. Use the `.pooler.supabase.com` hostname for IPv4 environments.

### ❌ Troubleshooting "SSL Cert" Errors
If you see `SELF_SIGNED_CERT_IN_CHAIN`:
- The `src/db/drizzle.provider.ts` is configured with `rejectUnauthorized: false`.
- If issues persist, try running: `SET NODE_TLS_REJECT_UNAUTHORIZED=0 && npm run db:seed`
