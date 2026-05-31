# Eranad MES Modernization Audit

Status: approved for incremental execution.

This document records the database and architecture modernization path. It is intentionally conservative: no business workflow should be removed without a reference check, a compatibility path, and validation.

## Phase 1 Database Classification

| Table | Classification | Reason | Migration Strategy |
| --- | --- | --- | --- |
| `roles` | KEEP | Active RBAC source. | Add seed/unique validation as needed. |
| `permissions` | KEEP | Active permission catalog. | Standardize permission strings. |
| `role_permissions` | KEEP | RBAC join table. | Add seed integrity checks. |
| `users` | KEEP | Core identity table. | Tighten role/profile typing through joins. |
| `user_roles` | KEEP | Supports multi-role users. | Keep; avoid falling back to single role fields. |
| `user_lines` | KEEP | Operational line assignment. | Add uniqueness if missing in DB migration review. |
| `production_lines` | KEEP | Core factory master data. | Standardize status enum. |
| `product_brands` | KEEP | Product master data. | Add unique brand name if absent in DB. |
| `products` | KEEP | Product/SKU master data. | Add SKU uniqueness where business requires it. |
| `shifts` | KEEP | Production and attendance dependency. | Add non-overlap validation later. |
| `production_batches` | KEEP | Core production aggregate root. | Keep stored lifecycle status; derive counts externally. |
| `production_logs` | KEEP | Production event ledger. | Keep as production source of truth. Normalize material fields gradually. |
| `materials_usage` | REFACTOR | Overlaps with material fields on `production_logs`. | Replace with inventory transactions or a normalized child table. |
| `batch_totals` | REFACTOR | Cached derived totals from `production_logs`. | Create derived query/service first; compare before retiring writes. |
| `packaging_logs` | REFACTOR | Separate production-output log with overlap to production logs. | Convert output to inventory transaction events. |
| `dispatch_logs` | REFACTOR | Dispatch should create stock movement transactions. | Keep compatibility reads; write `DISPATCH` movements. |
| `changeover_logs` | KEEP | Lifecycle/audit log. | Type FK fields and material JSON later. |
| `operator_sessions` | KEEP | Active shop-floor session control. | Keep partial active-session uniqueness. |
| `downtime_logs` | KEEP | Incident, OEE, and production availability source. | Add status enum and constraints later. |
| `machine_states` | KEEP | Current operational state cache. | Treat as cache, not audit source. |
| `shift_handovers` | KEEP | Operational accountability. | Keep snapshots; clarify that snapshots are historical. |
| `raw_materials` | REFACTOR | Stores `current_stock`, a calculated value. | Retain as item master; derive stock from transactions. |
| `raw_material_transactions` | MERGE | Raw-material-only ledger. | Migrate into unified `inventory_transactions`. |
| `inventory_stock` | REFACTOR | Generic stock table with mutable quantity. | Retain item/warehouse metadata; remove direct quantity authority. |
| `inventory_transactions` | KEEP | Best candidate for unified stock ledger. | Expand transaction types and item references. |
| `inventory_ledger` | MERGE | Another ledger not actively used by services. | Fold useful columns into unified transactions, then remove. |
| `product_stock_transactions` | MERGE | Finished-good-only ledger. | Migrate into unified `inventory_transactions`. |
| `production_stock` | REFACTOR | Stores calculated finished-goods totals. | Replace with derived stock view/service. |
| `finished_goods_inventory` | REFACTOR | Stores finished stock separately from product transactions. | Convert to transaction-derived warehouse balances. |
| `warehouse_locations` | KEEP | Required for stock location. | Add location codes and active flag later. |
| `supplier_batches` | KEEP | Traceability candidate. | Link to procurement/GRN transactions. |
| `packaging_configurations` | KEEP | Product packaging master data. | Add unique active config rules if needed. |
| `bill_of_materials` | KEEP | Material planning and variance basis. | Add versioning later. |
| `incident_types` | KEEP | Incident taxonomy. | Keep active flag. |
| `incidents` | KEEP | Required business workflow. | Keep as active module. |
| `incident_comments` | KEEP | Incident collaboration/audit. | No removal. |
| `incident_attachments` | KEEP | Incident evidence. | No removal. |
| `incident_assignments` | KEEP | Assignment history. | Keep even if current assignee is denormalized. |
| `incident_history` | KEEP | Incident state audit trail. | No removal. |
| `notes` | KEEP | Active collaboration module. | No removal. |
| `audit_logs` | KEEP | Cross-module audit record. | Standardize categories/actions. |
| `notifications` | KEEP | In-app notification record. | No removal. |
| `device_tokens` | KEEP | Push notification delivery. | No removal. |
| `customers` | KEEP | Sales domain. | Expand validation later. |
| `sales_orders` | KEEP | Sales domain. | Dispatch integration later. |
| `sales_order_items` | KEEP | Sales line items. | Link to inventory reservations later. |
| `sales_payments` | KEEP | Sales payment tracking. | No removal. |
| `vendors` | KEEP | Procurement domain. | Add uniqueness and active flag later. |
| `purchase_orders` | KEEP | Procurement domain. | Integrate with GRN/inventory transactions. |
| `purchase_order_items` | KEEP | Procurement line items. | Link to item master later. |
| `goods_receipts` | KEEP | Receiving event. | Must create `GRN` transactions. |
| `goods_receipt_items` | KEEP | Receiving line items. | Link to unified stock ledger. |
| `production_batches_archive` | KEEP | Data lifecycle archive. | Verify restore path. |
| `production_logs_archive` | KEEP | Data lifecycle archive. | Verify restore path. |
| `operator_sessions_archive` | KEEP | Data lifecycle archive. | Verify restore path. |
| `data_lifecycle_logs` | KEEP | Archive/audit log. | Keep. |

## Priority Refactor Order

1. Inventory ledger unification.
2. Raw-material transaction migration into unified inventory transactions.
3. Finished-goods output/dispatch transaction migration.
4. Derived batch totals read model.
5. `/portal/*` route consolidation.
6. Analytics/report KPI centralization.
7. API compatibility wrappers and state-transition endpoints.

## Inventory Target Model

`inventory_transactions` should become the only authoritative movement table.

Allowed movement types:

- `PURCHASE`
- `GRN`
- `PRODUCTION_CONSUMPTION`
- `PRODUCTION_OUTPUT`
- `SCRAP`
- `LEAKAGE`
- `ADJUSTMENT`
- `TRANSFER`
- `RETURN`
- `DISPATCH`

Stock should be queried as `SUM(quantity_change)` grouped by item, warehouse, lot/batch, and status. Master tables may cache balances only after there is a deterministic reconciliation job and a clear cache invalidation strategy.

## Database Integrity Gaps To Address

- Add transaction idempotency key for inventory movements.
- Add check constraints for non-zero transaction quantities.
- Add unique constraints for duplicate active sessions and duplicate master-data names where business rules require them.
- Replace mixed varchar status fields with enums or shared constants.
- Add FKs where UUIDs are currently plain references, especially changeover product/line fields.
- Add indexes for transaction lookup by item, warehouse, reference, type, and created time.

## Compatibility Rules

- Keep existing API routes until frontend calls are migrated.
- Introduce new ledger services behind old endpoints first.
- Compare old totals and derived totals before deleting summary writes.
- Preserve incidents, production, inventory, reports, and operator workflows.

