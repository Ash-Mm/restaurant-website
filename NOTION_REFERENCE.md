# Notion Project Table Reference

How to read and update the project task board in Notion from this repo, so future
sessions don't have to rediscover the setup.

## Connection
- Integration: **Composio** (integration id `17eb9b75-7ad0-4fc1-b01d-12bb09271484`)
- Connected account: `ca_SgG94CetEUrL` (status ACTIVE, Composio-managed OAuth)
- Auth: env var `COMPOSIO_API_KEY` (project API key — **never commit it**)
- SDK: `@composio/core` (v0.17.x). The old `composio-core` CLI hits deprecated
  v1 endpoints (HTTP 410) — do **not** use it.

## Where things live
- Workspace hub page: `3c88e3f8-9152-80d6-a6b5-d9e2673fd247` ("Restaurant Platform Project Hub")
- Task database (inline `child_database` block): `3c88e3f8-9152-80a8-a2f9-cc580d68f68b`
  - **GOTCHA:** the `collection://...` id shown in page markdown is NOT the API
    database id. Use the `child_database` block id above.
- Each task row is a page whose `parent.database_id` equals the database id above.

## Columns (properties)
| Name | Type | Notes |
|---|---|---|
| Task Name | title | human-readable task |
| Domain | select | Architecture, Backend, Database, DevOps, Frontend, Fullstack, Operations |
| Phase | select | Future Backlog / Phase 0..15 (see DESIGN.md) |
| Phase Order | number | sort order within a phase |
| Priority | select | High, Medium, Low |
| Status | select | Not Started, In Progress, Completed |

## Phases
Future Backlog, Phase 0: Foundation, Phase 1: Tenant & Locations,
Phase 2: Auth & RBAC, Phase 3: Menu & Modifiers, Phase 4: Storefront & Online Ordering,
Phase 5: Payments & Transactions, Phase 6: POS Cashier, Phase 7: Receipts & Printing,
Phase 8: Kitchen Display System, Phase 9: Inventory & Barcodes, Phase 10: Purchase Orders,
Phase 11: Settings & Configurability, Phase 12: Reports, Phase 13: Security & Isolation,
Phase 14: Testing & Quality, Phase 15: Deployment & Launch.

## Stats
- 201 rows (as of 2026-08-26). Query returns max 50/page → paginate with `start_cursor`.

## Read / write (Node, `@composio/core`)
```js
const { Composio } = require('@composio/core');
const composio = new Composio({ apiKey: process.env.COMPOSIO_API_KEY });
const conn = 'ca_SgG94CetEUrL';
const DB = '3c88e3f8-9152-80a8-a2f9-cc580d68f68b';
const VER = '20260819_00';

// List all rows (paginate)
async function allRows() {
  let rows = [], start = null;
  do {
    const r = await composio.tools.execute('NOTION_QUERY_DATABASE', {
      userId: 'default-user', connectedAccountId: conn, version: VER,
      arguments: { database_id: DB, page_size: 50, start_cursor: start },
    });
    const d = r.data;
    rows.push(...(d.results || []));
    start = d.has_more ? d.next_cursor : null;
  } while (start);
  return rows;
}

// Set a row's Status
async function setStatus(rowId, status) {
  return composio.tools.execute('NOTION_UPDATE_ROW_DATABASE', {
    userId: 'default-user', connectedAccountId: conn, version: VER,
    arguments: { row_id: rowId, properties: [{ name: 'Status', type: 'select', value: status }] },
  });
}
```

## Gotchas
- The database must be **shared with the Composio integration** in Notion. Sharing the
  parent page does not always cascade to an imported/inline database. If you get
  `object_not_found`, re-share the database via its `···` → Connections menu.
- `Status` is a `select` property, not a `status` type.
- `NOTION_GET_PAGE_MARKDOWN` on the hub page returns empty for the database; use
  `NOTION_QUERY_DATABASE` on the database id above.
- Run scripts with `NODE_PATH` pointing at the global modules, or add `@composio/core`
  to the project `devDependencies`.

## Workflow conventions
- When working a task: set `Status` → In Progress, then → Completed once the
  artifact/work is done.
- Task ids are stable — reference them directly when updating.
