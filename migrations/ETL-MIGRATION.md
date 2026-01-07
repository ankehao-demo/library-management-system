# Phase 3: ETL Migration from MongoDB to Supabase

This document describes the ETL (Extract, Transform, Load) migration process for the Library Management System from MongoDB to Supabase/Postgres.

## Overview

The migration transfers data from 5 MongoDB collections to 10 Postgres tables in Supabase, following the schema design established in Phase 2. The process handles ObjectId to UUID conversion, polymorphic collection splitting, embedded array normalization, and maintains referential integrity throughout.

## Source Data (MongoDB)

The source MongoDB database contains 5 collections with the following document counts:

| Collection | Documents | Description |
|------------|-----------|-------------|
| books | 12 | Book catalog with embedded authors and reviews |
| users | 9 | User accounts with admin flags |
| issueDetails | 3 | Polymorphic collection for reservations and borrowed books |
| authors | 8 | Author information with aliases |
| reviews | 28 | Book reviews (also embedded in books) |

## Target Schema (Supabase/Postgres)

The target Postgres schema consists of 10 tables plus a computed availability view:

| Table | Records | Description |
|-------|---------|-------------|
| users | 9 | User accounts |
| authors | 8 | Author information |
| author_aliases | 7 | Normalized author aliases |
| books | 12 | Book catalog |
| book_genres | 0 | Normalized book genres (none in source data) |
| book_attributes | 0 | Normalized book attributes (none in source data) |
| book_authors | 12 | Junction table for book-author relationships |
| reviews | 28 | Book reviews |
| reservations | 3 | Active reservations |
| borrowed_books | 0 | Borrowed book records (none in source data) |

## ETL Scripts

### etl-extract.js

Connects to MongoDB and extracts all documents from the 5 source collections. The extracted data is saved to `extracted-data.json` for reference and debugging.

### etl-migrate.js

The main ETL script that performs the following operations:

1. Extracts fresh data from MongoDB
2. Pre-generates UUIDs for all MongoDB ObjectIds to ensure consistency
3. Transforms data according to the new schema
4. Generates SQL INSERT statements in FK dependency order
5. Outputs migration files (SQL, ID mapping, summary)

## Data Transformations

### ObjectId to UUID Conversion

MongoDB ObjectIds are converted to UUIDs using a consistent mapping. The same ObjectId always maps to the same UUID, ensuring referential integrity across tables. The mapping is stored in `id-mapping.json` for reference.

```javascript
function generateUuidForMongoId(mongoId) {
    const key = String(mongoId);
    if (!mongoIdToUuidMap.has(key)) {
        mongoIdToUuidMap.set(key, randomUUID());
    }
    return mongoIdToUuidMap.get(key);
}
```

### Users Transformation

MongoDB users are transformed with field renaming:
- `_id` (ObjectId) -> `id` (UUID)
- `name` -> `name`
- `isAdmin` -> `is_admin`

### Authors Transformation

Authors are split into two tables:
- Main author data goes to `authors` table
- Embedded `aliases` array is normalized to `author_aliases` table

### Books Transformation

Books undergo several transformations:
- `_id` (ISBN string) -> `isbn` (primary key)
- Embedded `authors` array -> `book_authors` junction table
- Embedded `genres` array -> `book_genres` table (if present)
- Embedded `attributes` array -> `book_attributes` table (if present)
- Field renaming: `totalInventory` -> `total_inventory`, `bookOfTheMonth` -> `book_of_month`

### Reviews Transformation

Reviews are extracted from the standalone `reviews` collection:
- `_id` (ObjectId) -> `id` (UUID)
- `bookId` -> `book_isbn`
- `name` -> `reviewer_name`
- `timestamp` (Unix ms) -> `created_at` (TIMESTAMPTZ via TO_TIMESTAMP)

### IssueDetails Transformation (Polymorphic Split)

The polymorphic `issueDetails` collection is split based on `recordType`:

**Reservations** (`recordType: 'reservation'`):
- New UUID generated for `id`
- `user._id` -> `user_id` (UUID)
- `book._id` -> `book_isbn`
- `expirationDate` -> `expiration_date` (TIMESTAMPTZ)

**Borrowed Books** (`recordType: 'borrowedBook'`):
- New UUID generated for `id`
- `user._id` -> `user_id` (UUID)
- `book._id` -> `book_isbn`
- `borrowDate` -> `borrow_date` (TIMESTAMPTZ)
- `dueDate` -> `due_date` (TIMESTAMPTZ)
- `returned` -> `returned`
- `returnedDate` -> `returned_date` (TIMESTAMPTZ, nullable)

## Migration Order

Data is loaded in the following order to respect foreign key dependencies:

1. `users` - No dependencies
2. `authors` - No dependencies
3. `author_aliases` - Depends on authors
4. `books` - No dependencies
5. `book_genres` - Depends on books
6. `book_attributes` - Depends on books
7. `book_authors` - Depends on books, authors
8. `reviews` - Depends on books
9. `reservations` - Depends on users, books
10. `borrowed_books` - Depends on users, books

## Generated Files

| File | Description |
|------|-------------|
| `extracted-data.json` | Raw extracted data from MongoDB |
| `migration-sql.sql` | SQL INSERT statements ready to execute |
| `id-mapping.json` | MongoDB ObjectId to UUID mapping |
| `migration-summary.json` | Transformation statistics and SQL statements |

## Verification

After loading data into Supabase, row counts were verified to match:

| Table | Expected | Actual | Status |
|-------|----------|--------|--------|
| users | 9 | 9 | OK |
| authors | 8 | 8 | OK |
| author_aliases | 7 | 7 | OK |
| books | 12 | 12 | OK |
| book_authors | 12 | 12 | OK |
| reviews | 28 | 28 | OK |
| reservations | 3 | 3 | OK |
| borrowed_books | 0 | 0 | OK |

The `v_book_availability` view was also verified to correctly calculate available inventory by subtracting active (non-expired) reservations and unreturned borrowed books from total inventory.

## Running the Migration

To run the ETL migration:

```bash
cd migrations

# Install dependencies (if not already installed)
npm install

# Run extraction only
node etl-extract.js

# Run full ETL (extract, transform, generate SQL)
node etl-migrate.js
```

The generated `migration-sql.sql` file can then be executed against the Supabase database using the Supabase MCP or SQL editor.

## Notes

- The migration preserves all data from the source MongoDB database
- Embedded reviews in books are not migrated separately as they already exist in the standalone reviews collection
- The `available` field is no longer stored but computed via the `v_book_availability` view
- Reservation expiration dates are preserved as-is; expired reservations are correctly excluded from availability calculations by the view
