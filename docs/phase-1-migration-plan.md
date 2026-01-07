# Phase 1: MongoDB to PostgreSQL Migration Plan

This document outlines the detailed migration plan for transitioning the Library Management System from MongoDB to PostgreSQL/Supabase. It covers collection-to-table mappings, data type conversions, pattern transformations, risks, and recommendations for subsequent phases.

## Executive Summary

The migration involves transforming 5 MongoDB collections into 9 PostgreSQL tables, normalizing embedded documents, replacing polymorphic patterns with separate tables, and implementing proper foreign key constraints. The migration should be performed in phases to minimize downtime and allow for validation at each step.

## Collection to Table Mapping

### Overview

| MongoDB Collection | PostgreSQL Table(s) | Transformation |
|-------------------|---------------------|----------------|
| books | books, book_authors, book_attributes | Normalize embedded authors and attributes |
| users | users | Direct mapping with added constraints |
| issueDetails | reservations, borrowed_books | Split polymorphic collection |
| authors | authors | Direct mapping, remove books array |
| reviews | reviews | Normalize from embedded + standalone |

### Detailed Mappings

#### 1. books Collection

**Source**: MongoDB `books` collection
**Target**: PostgreSQL `books`, `book_authors`, `book_attributes` tables

| MongoDB Field | PostgreSQL Column | Table | Transformation |
|--------------|-------------------|-------|----------------|
| `_id` (ISBN) | `isbn` | books | Direct (VARCHAR PK) |
| `title` | `title` | books | Direct |
| `year` | `year` | books | Direct |
| `cover` | `cover` | books | Direct |
| `genres` | `genres` | books | Array to PostgreSQL array |
| `pages` | `pages` | books | Direct |
| `synopsis` | `synopsis` | books | Direct |
| `publisher` | `publisher` | books | Direct |
| `longTitle` | `long_title` | books | Rename (snake_case) |
| `language` | `language` | books | Direct |
| `binding` | `binding` | books | Direct |
| `totalInventory` | `total_inventory` | books | Rename (snake_case) |
| `available` | (computed) | books_with_availability | View or trigger |
| `authors[]` | - | book_authors | Normalize to junction table |
| `attributes[]` | - | book_attributes | Normalize to separate table |
| `reviews[]` | - | reviews | Merge with standalone reviews |
| `bookOfTheMonth` | `book_of_the_month` | books | Rename (snake_case) |

**Migration Steps**:
1. Insert book records into `books` table (excluding embedded arrays)
2. For each book's `authors[]`, insert into `book_authors` junction table
3. For each book's `attributes[]`, insert into `book_attributes` table
4. For each book's `reviews[]`, insert into `reviews` table (deduplicate with standalone)

#### 2. users Collection

**Source**: MongoDB `users` collection
**Target**: PostgreSQL `users` table

| MongoDB Field | PostgreSQL Column | Transformation |
|--------------|-------------------|----------------|
| `_id` (ObjectId) | `id` (UUID) | Generate new UUID, store mapping |
| `name` | `name` | Direct |
| `isAdmin` | `is_admin` | Rename (snake_case) |
| - | `created_at` | Set to migration timestamp |
| - | `updated_at` | Set to migration timestamp |

**Migration Steps**:
1. Generate UUID for each user
2. Store ObjectId → UUID mapping in `migration_id_mapping`
3. Insert user records with CHECK constraint validation

#### 3. issueDetails Collection (Polymorphic)

**Source**: MongoDB `issueDetails` collection
**Target**: PostgreSQL `reservations` and `borrowed_books` tables

##### Reservations (recordType = 'reservation')

| MongoDB Field | PostgreSQL Column | Transformation |
|--------------|-------------------|----------------|
| `_id` (composite) | `id` (UUID) | Generate new UUID |
| `book._id` | `book_isbn` | Extract ISBN from embedded |
| `user._id` | `user_id` | Map ObjectId to UUID |
| `expirationDate` | `expiration_date` | Direct (timestamp) |
| - | `created_at` | Set to migration timestamp |

##### Borrowed Books (recordType = 'borrowedBook')

| MongoDB Field | PostgreSQL Column | Transformation |
|--------------|-------------------|----------------|
| `_id` (composite) | `id` (UUID) | Generate new UUID |
| `book._id` | `book_isbn` | Extract ISBN from embedded |
| `user._id` | `user_id` | Map ObjectId to UUID |
| `borrowDate` | `borrow_date` | Rename (snake_case) |
| `dueDate` | `due_date` | Rename (snake_case) |
| `returnedDate` | `returned_date` | Rename (snake_case) |
| `returned` | `returned` | Direct |
| - | `created_at` | Set to migration timestamp |
| - | `updated_at` | Set to migration timestamp |

**Migration Steps**:
1. Query issueDetails where `recordType = 'reservation'`
2. Insert into `reservations` table with mapped user_id
3. Query issueDetails where `recordType = 'borrowedBook'`
4. Insert into `borrowed_books` table with mapped user_id

#### 4. authors Collection

**Source**: MongoDB `authors` collection
**Target**: PostgreSQL `authors` table

| MongoDB Field | PostgreSQL Column | Transformation |
|--------------|-------------------|----------------|
| `_id` (ObjectId) | `id` (UUID) | Generate new UUID, store mapping |
| `name` | `name` | Direct |
| `sanitizedName` | `sanitized_name` | Rename (snake_case) |
| `aliases` | `aliases` | Array to PostgreSQL array |
| `bio` | `bio` | Direct |
| `books[]` | - | Migrate to book_authors junction |
| - | `created_at` | Set to migration timestamp |
| - | `updated_at` | Set to migration timestamp |

**Migration Steps**:
1. Generate UUID for each author
2. Store ObjectId → UUID mapping in `migration_id_mapping`
3. Insert author records (excluding books array)
4. Use books array to populate `book_authors` junction table

#### 5. reviews Collection

**Source**: MongoDB `reviews` collection + embedded `books.reviews[]`
**Target**: PostgreSQL `reviews` table

| MongoDB Field | PostgreSQL Column | Transformation |
|--------------|-------------------|----------------|
| `_id` (ObjectId) | `id` (UUID) | Generate new UUID |
| `text` | `text` | Direct |
| `name` | `reviewer_name` | Rename |
| `rating` | `rating` | Direct |
| `timestamp` | `timestamp` | Direct (bigint) |
| `bookId` | `book_isbn` | Direct |
| - | `user_id` | Lookup by reviewer name (nullable) |
| - | `created_at` | Set to migration timestamp |

**Migration Steps**:
1. Collect all reviews from standalone `reviews` collection
2. Collect all embedded reviews from `books.reviews[]`
3. Deduplicate by `_id` (embedded reviews have same IDs)
4. Attempt to match `reviewer_name` to `users.name` for `user_id`
5. Insert into `reviews` table

## Data Type Conversions

| MongoDB Type | PostgreSQL Type | Notes |
|-------------|-----------------|-------|
| ObjectId | UUID | Generate new UUIDs, maintain mapping |
| String | VARCHAR/TEXT | Use VARCHAR for bounded, TEXT for unbounded |
| Number (int) | INTEGER | Direct conversion |
| Number (float) | NUMERIC/DOUBLE PRECISION | Choose based on precision needs |
| Boolean | BOOLEAN | Direct conversion |
| Date | TIMESTAMP WITH TIME ZONE | Convert from MongoDB ISODate |
| Array | PostgreSQL ARRAY | Use native array types |
| Embedded Document | Separate table | Normalize to related table |
| Mixed/Any | JSONB | For truly dynamic data (not used here) |

### Special Conversions

#### ObjectId to UUID

```javascript
// MongoDB ObjectId: "695c0a4c0850c6486d5504c6"
// PostgreSQL UUID: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"

// Migration approach:
// 1. Generate new UUID for each document
// 2. Store mapping: { mongo_id: "695c0a4c0850c6486d5504c6", postgres_id: "a1b2c3d4-..." }
// 3. Use mapping table for foreign key resolution
```

#### Composite String Key to UUID

```javascript
// MongoDB composite key: "695c0a4a1f15c05b869c3c30R9780743273565"
// Format: {userId}{type}{bookId}

// Migration approach:
// 1. Parse composite key to extract userId, type, bookId
// 2. Generate new UUID for the record
// 3. Use parsed components for foreign key columns
```

#### Timestamp Formats

```javascript
// MongoDB embedded reviews: timestamp as Unix milliseconds (bigint)
// MongoDB issueDetails: expirationDate as ISODate string

// PostgreSQL approach:
// - Keep Unix timestamps as BIGINT for reviews (application compatibility)
// - Convert ISODate to TIMESTAMP WITH TIME ZONE for dates
```

## MongoDB Pattern Transformations

### 1. Computed Fields Pattern → View/Trigger

**MongoDB Pattern**: `available` field computed via aggregation pipeline

**PostgreSQL Solution**: Database view with computed column

```sql
CREATE VIEW books_with_availability AS
SELECT 
    b.*,
    b.total_inventory - COALESCE(active_issues.count, 0) AS available
FROM books b
LEFT JOIN (
    SELECT book_isbn, COUNT(*) as count
    FROM (
        SELECT book_isbn FROM reservations
        UNION ALL
        SELECT book_isbn FROM borrowed_books WHERE returned = FALSE
    ) active
    GROUP BY book_isbn
) active_issues ON b.isbn = active_issues.book_isbn;
```

**Alternative**: Trigger-maintained column for high-performance scenarios.

### 2. Embedded Documents (Subset Pattern) → Normalized Table

**MongoDB Pattern**: Reviews embedded in books document

**PostgreSQL Solution**: Separate `reviews` table with foreign key

```sql
-- Instead of embedded array in books
-- Use normalized reviews table
SELECT b.*, r.*
FROM books b
LEFT JOIN reviews r ON b.isbn = r.book_isbn
ORDER BY r.timestamp DESC
LIMIT 5;  -- Equivalent to subset pattern
```

### 3. Polymorphic Pattern → Separate Tables

**MongoDB Pattern**: Single `issueDetails` collection with `recordType` discriminator

**PostgreSQL Solution**: Separate `reservations` and `borrowed_books` tables

**Benefits**:
- Type-safe schema per record type
- Proper constraints per table
- Cleaner queries without type filtering
- Better index utilization

**Trade-offs**:
- Queries for "all issues" require UNION
- Application code needs to query both tables

### 4. Composite String Keys → UUID with Unique Constraint

**MongoDB Pattern**: `_id: "{userId}{type}{bookId}"`

**PostgreSQL Solution**: UUID primary key with unique constraint

```sql
CREATE TABLE reservations (
    id UUID PRIMARY KEY,
    book_isbn VARCHAR(20) NOT NULL,
    user_id UUID NOT NULL,
    -- ...
    CONSTRAINT reservations_unique_active UNIQUE (book_isbn, user_id)
);
```

### 5. Atomic Operations ($inc) → SQL UPDATE

**MongoDB Pattern**: `$inc: { available: -1 }`

**PostgreSQL Solution**: Standard SQL UPDATE (with view/trigger for computed field)

```sql
-- If using trigger-maintained column:
-- Triggers automatically update available when reservations/borrows change

-- If using view:
-- No direct update needed; view always shows current availability
```

### 6. Extended Reference Pattern → Foreign Keys + Denormalization

**MongoDB Pattern**: Embedded partial documents (e.g., `book: { _id, title }`)

**PostgreSQL Solution**: Foreign keys with optional denormalized columns

```sql
-- Option 1: Pure normalization (JOIN required)
SELECT r.*, b.title as book_title, u.name as user_name
FROM reservations r
JOIN books b ON r.book_isbn = b.isbn
JOIN users u ON r.user_id = u.id;

-- Option 2: Denormalized columns (for performance)
CREATE TABLE reservations (
    -- ...
    book_title VARCHAR(500),  -- Denormalized from books
    user_name VARCHAR(255),   -- Denormalized from users
    -- ...
);
```

## Identified Risks and Challenges

### High Risk

1. **Data Integrity During Migration**
   - Risk: Inconsistent state if migration fails midway
   - Mitigation: Use transactions, implement rollback procedures, migrate in batches

2. **Foreign Key Resolution**
   - Risk: ObjectId references may not resolve if parent not yet migrated
   - Mitigation: Migrate in dependency order (users → authors → books → reviews → issueDetails)

3. **Duplicate Reviews**
   - Risk: Same review exists in standalone collection and embedded in books
   - Mitigation: Deduplicate by `_id` before insertion

### Medium Risk

4. **Application Code Changes**
   - Risk: Extensive code changes required for new schema
   - Mitigation: Create abstraction layer, migrate incrementally

5. **Query Performance Differences**
   - Risk: Queries optimized for MongoDB may perform poorly in PostgreSQL
   - Mitigation: Analyze query patterns, create appropriate indexes, use EXPLAIN

6. **Timestamp Format Inconsistency**
   - Risk: Different timestamp formats between collections
   - Mitigation: Standardize during migration, document format for each column

### Low Risk

7. **UUID Generation**
   - Risk: UUID collisions (extremely unlikely)
   - Mitigation: Use `gen_random_uuid()` which is cryptographically secure

8. **Array Type Compatibility**
   - Risk: PostgreSQL arrays behave differently than MongoDB arrays
   - Mitigation: Test array operations thoroughly, consider JSONB for complex cases

## Migration Phases Recommendation

### Phase 2: Schema Creation and Validation

**Objectives**:
- Create PostgreSQL schema in Supabase
- Validate schema against application requirements
- Set up migration infrastructure

**Tasks**:
1. Execute `postgres-schema.sql` in Supabase
2. Create migration scripts for each collection
3. Set up `migration_id_mapping` table
4. Create validation queries

**Duration**: 1-2 days

### Phase 3: Data Migration (Read-Only)

**Objectives**:
- Migrate all data from MongoDB to PostgreSQL
- Validate data integrity
- Keep MongoDB as source of truth

**Tasks**:
1. Migrate users (generate UUIDs, store mappings)
2. Migrate authors (generate UUIDs, store mappings)
3. Migrate books (excluding embedded arrays)
4. Migrate book_authors junction table
5. Migrate book_attributes
6. Migrate reviews (deduplicate embedded + standalone)
7. Migrate reservations (from issueDetails)
8. Migrate borrowed_books (from issueDetails)
9. Validate row counts and data integrity

**Duration**: 2-3 days

### Phase 4: Application Code Migration

**Objectives**:
- Update application code to use PostgreSQL
- Implement dual-write for transition period
- Test all functionality

**Tasks**:
1. Create PostgreSQL database connection module
2. Update models to match new schema
3. Update controllers/services for SQL queries
4. Implement dual-write (write to both databases)
5. Comprehensive testing

**Duration**: 1-2 weeks

### Phase 5: Cutover and Validation

**Objectives**:
- Switch primary database to PostgreSQL
- Validate production functionality
- Decommission MongoDB

**Tasks**:
1. Final data sync from MongoDB
2. Switch application to PostgreSQL-only
3. Monitor for issues
4. Keep MongoDB as backup for rollback period
5. Decommission MongoDB after validation period

**Duration**: 1 week (including monitoring)

## Migration Script Structure

```
migrations/
├── phase-2-schema/
│   ├── 001-create-extensions.sql
│   ├── 002-create-users-table.sql
│   ├── 003-create-authors-table.sql
│   ├── 004-create-books-table.sql
│   ├── 005-create-junction-tables.sql
│   ├── 006-create-reviews-table.sql
│   ├── 007-create-issue-tables.sql
│   ├── 008-create-views.sql
│   └── 009-create-triggers.sql
├── phase-3-data/
│   ├── migrate-users.ts
│   ├── migrate-authors.ts
│   ├── migrate-books.ts
│   ├── migrate-book-authors.ts
│   ├── migrate-book-attributes.ts
│   ├── migrate-reviews.ts
│   ├── migrate-reservations.ts
│   ├── migrate-borrowed-books.ts
│   └── validate-migration.ts
└── phase-4-application/
    ├── database-connection.ts
    ├── models/
    ├── repositories/
    └── tests/
```

## Validation Queries

### Row Count Validation

```sql
-- Compare counts after migration
SELECT 'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'authors', COUNT(*) FROM authors
UNION ALL
SELECT 'books', COUNT(*) FROM books
UNION ALL
SELECT 'book_authors', COUNT(*) FROM book_authors
UNION ALL
SELECT 'reviews', COUNT(*) FROM reviews
UNION ALL
SELECT 'reservations', COUNT(*) FROM reservations
UNION ALL
SELECT 'borrowed_books', COUNT(*) FROM borrowed_books;
```

### Data Integrity Validation

```sql
-- Verify all book_authors have valid references
SELECT ba.* FROM book_authors ba
LEFT JOIN books b ON ba.book_isbn = b.isbn
LEFT JOIN authors a ON ba.author_id = a.id
WHERE b.isbn IS NULL OR a.id IS NULL;

-- Verify all reviews have valid book references
SELECT r.* FROM reviews r
LEFT JOIN books b ON r.book_isbn = b.isbn
WHERE b.isbn IS NULL;

-- Verify computed availability matches
SELECT 
    b.isbn,
    b.total_inventory,
    bwa.available as computed_available,
    (SELECT COUNT(*) FROM reservations WHERE book_isbn = b.isbn) as reservations,
    (SELECT COUNT(*) FROM borrowed_books WHERE book_isbn = b.isbn AND returned = FALSE) as active_borrows
FROM books b
JOIN books_with_availability bwa ON b.isbn = bwa.isbn;
```

## Rollback Plan

In case of critical issues during migration:

1. **Phase 2 Rollback**: Drop all created tables, no data loss
2. **Phase 3 Rollback**: Truncate PostgreSQL tables, MongoDB remains source of truth
3. **Phase 4 Rollback**: Revert application code, switch back to MongoDB
4. **Phase 5 Rollback**: Re-enable MongoDB writes, sync any PostgreSQL-only data back

## Success Criteria

- [ ] All MongoDB documents migrated to PostgreSQL
- [ ] Row counts match between source and target
- [ ] All foreign key relationships valid
- [ ] Application functionality unchanged
- [ ] Query performance acceptable (< 100ms for common queries)
- [ ] No data loss or corruption
- [ ] Computed fields (available) calculate correctly
- [ ] All business rules enforced by constraints

## Next Steps

1. Review and approve this migration plan
2. Set up Supabase project and database
3. Begin Phase 2: Schema Creation
4. Develop and test migration scripts
5. Schedule migration window for production
