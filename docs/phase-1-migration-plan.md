# Phase 1: MongoDB to Postgres Migration Plan

This document outlines the comprehensive plan for migrating the Library Management System from MongoDB to Supabase/Postgres. It provides detailed mappings, data type conversions, pattern translations, and recommendations for subsequent phases.

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Collection to Table Mapping](#collection-to-table-mapping)
3. [Data Type Conversions](#data-type-conversions)
4. [MongoDB Pattern Translations](#mongodb-pattern-translations)
5. [Proposed Postgres Schema](#proposed-postgres-schema)
6. [Migration Strategy](#migration-strategy)
7. [Risks and Challenges](#risks-and-challenges)
8. [Recommendations for Next Phases](#recommendations-for-next-phases)

## Executive Summary

The migration involves converting 5 MongoDB collections into 11 Postgres tables, with the primary goals of:

1. **Normalizing denormalized data** - Replacing embedded documents with proper relational tables
2. **Enforcing referential integrity** - Adding foreign key constraints
3. **Replacing composite string keys** - Using proper primary keys with indexes
4. **Splitting polymorphic collections** - Separating reservations and borrowed_books
5. **Converting computed fields** - Using database views or triggers

### High-Level Mapping Overview

| MongoDB Collection | Postgres Tables |
|-------------------|-----------------|
| books | books, book_genres, book_attributes, book_authors |
| users | users |
| authors | authors, author_aliases |
| reviews | reviews |
| issueDetails | reservations, borrowed_books |
| (computed) | v_book_availability (view) |

## Collection to Table Mapping

### 1. Books Collection

**MongoDB**: Single `books` collection with embedded arrays

**Postgres**: Normalized into 4 tables

```
books (MongoDB)                    books (Postgres)
├── _id (ISBN)          ──────►   ├── isbn (PK)
├── title                         ├── title
├── year                          ├── year
├── cover                         ├── cover_url
├── genres[]            ──────►   book_genres (junction)
├── pages                         ├── pages
├── synopsis                      ├── synopsis
├── publisher                     ├── publisher
├── longTitle                     ├── long_title
├── language                      ├── language
├── binding                       ├── binding
├── totalInventory                ├── total_inventory
├── available (computed) ─────►   v_book_availability (view)
├── authors[]           ──────►   book_authors (junction)
├── attributes[]        ──────►   book_attributes (table)
├── reviews[] (embedded) ─────►   reviews (separate table)
└── bookOfTheMonth                └── book_of_month
```

### 2. Users Collection

**MongoDB**: Simple `users` collection with schema validation

**Postgres**: Direct mapping with CHECK constraint

```
users (MongoDB)                    users (Postgres)
├── _id (ObjectId)      ──────►   ├── id (UUID, PK)
├── name (min 5 chars)            ├── name (CHECK length >= 5)
└── isAdmin                       └── is_admin
```

### 3. Authors Collection

**MongoDB**: `authors` collection with embedded aliases array

**Postgres**: Normalized into 2 tables

```
authors (MongoDB)                  authors (Postgres)
├── _id (ObjectId)      ──────►   ├── id (UUID, PK)
├── name                          ├── name
├── sanitizedName                 ├── sanitized_name (UNIQUE)
├── aliases[]           ──────►   author_aliases (table)
├── bio                           ├── bio
└── books[] (ISBNs)     ──────►   book_authors (junction, reverse)
```

### 4. Reviews Collection

**MongoDB**: Standalone `reviews` collection + embedded in books

**Postgres**: Single normalized table (no embedding)

```
reviews (MongoDB)                  reviews (Postgres)
├── _id (ObjectId)      ──────►   ├── id (UUID, PK)
├── text                          ├── text
├── name                          ├── reviewer_name
├── rating                        ├── rating (CHECK 1-5)
├── timestamp           ──────►   ├── created_at (TIMESTAMPTZ)
└── bookId (ISBN)                 └── book_isbn (FK)
```

### 5. IssueDetails Collection (Polymorphic)

**MongoDB**: Single polymorphic collection with composite string keys

**Postgres**: Split into 2 separate tables

```
issueDetails (MongoDB)             reservations (Postgres)
├── _id (composite)     ──────►   ├── id (UUID, PK)
├── recordType='reservation'      │   (implicit by table)
├── book._id                      ├── book_isbn (FK)
├── book.title          ──────►   │   (join to books table)
├── user._id                      ├── user_id (FK)
├── user.name           ──────►   │   (join to users table)
└── expirationDate                └── expiration_date

issueDetails (MongoDB)             borrowed_books (Postgres)
├── _id (composite)     ──────►   ├── id (UUID, PK)
├── recordType='borrowedBook'     │   (implicit by table)
├── book._id                      ├── book_isbn (FK)
├── book.title          ──────►   │   (join to books table)
├── user._id                      ├── user_id (FK)
├── user.name           ──────►   │   (join to users table)
├── borrowDate                    ├── borrow_date
├── dueDate                       ├── due_date
├── returned                      ├── returned
└── returnedDate                  └── returned_date
```

## Data Type Conversions

| MongoDB Type | Postgres Type | Notes |
|--------------|---------------|-------|
| ObjectId | UUID | Use `gen_random_uuid()` for generation |
| String (_id as ISBN) | VARCHAR(13) | ISBN-13 format |
| String | VARCHAR(n) or TEXT | Use VARCHAR for bounded, TEXT for unbounded |
| Number (integer) | INTEGER | Direct mapping |
| Number (float) | NUMERIC or DOUBLE PRECISION | Based on precision needs |
| Boolean | BOOLEAN | Direct mapping |
| Date | TIMESTAMPTZ | Always use timezone-aware timestamps |
| Array<String> | Junction table or TEXT[] | Prefer junction for queryability |
| Array<Object> | Separate table | Normalize embedded documents |
| Embedded Object | Foreign key reference | Replace with proper relations |
| Composite String Key | UUID + UNIQUE constraint | Use proper PK with unique index |

### ObjectId to UUID Migration

MongoDB ObjectIds are 24-character hex strings (12 bytes). For migration:

1. **Option A**: Generate new UUIDs (recommended)
   - Cleaner approach
   - Requires updating all references
   - Better for long-term maintenance

2. **Option B**: Store original ObjectId as additional column
   - Add `mongo_id VARCHAR(24)` column
   - Useful for data verification during migration
   - Can be dropped after migration validation

### Timestamp Conversion

MongoDB stores timestamps in various formats:
- `Date` objects (ISODate)
- Unix timestamps in milliseconds (Number)

Conversion approach:
```sql
-- For ISODate: Direct conversion
mongo_date::TIMESTAMPTZ

-- For Unix timestamp (milliseconds):
TO_TIMESTAMP(mongo_timestamp / 1000.0)
```

## MongoDB Pattern Translations

### 1. Computed Pattern (books.available)

**MongoDB Approach**: Calculated via aggregation pipeline at query time

**Postgres Options**:

**Option A: Database View (Recommended)**
```sql
CREATE VIEW v_book_availability AS
SELECT 
    b.isbn,
    b.title,
    b.total_inventory,
    COALESCE(r.reserved_count, 0) AS reserved_count,
    COALESCE(bb.borrowed_count, 0) AS borrowed_count,
    b.total_inventory 
        - COALESCE(r.reserved_count, 0) 
        - COALESCE(bb.borrowed_count, 0) AS available
FROM books b
LEFT JOIN (
    SELECT book_isbn, COUNT(*) AS reserved_count
    FROM reservations
    WHERE expiration_date > NOW()
    GROUP BY book_isbn
) r ON b.isbn = r.book_isbn
LEFT JOIN (
    SELECT book_isbn, COUNT(*) AS borrowed_count
    FROM borrowed_books
    WHERE returned = FALSE
    GROUP BY book_isbn
) bb ON b.isbn = bb.book_isbn;
```

**Option B: Trigger-Maintained Column**
- Add `available` column to books table
- Create triggers on reservations and borrowed_books
- Update available count on INSERT/UPDATE/DELETE
- Better performance for reads, more complex maintenance

**Recommendation**: Start with View (Option A), optimize to triggers if performance requires.

### 2. Extended Reference Pattern

**MongoDB Approach**: Embed subset of related document (e.g., `{_id, name}`)

**Postgres Approach**: Use foreign keys with JOINs

```sql
-- MongoDB: issueDetails.book = {_id: "isbn", title: "..."}
-- Postgres: Use JOIN
SELECT 
    r.id,
    r.book_isbn,
    b.title AS book_title,
    r.user_id,
    u.name AS user_name
FROM reservations r
JOIN books b ON r.book_isbn = b.isbn
JOIN users u ON r.user_id = u.id;
```

**Performance Consideration**: Create appropriate indexes on foreign key columns.

### 3. Subset Pattern (Embedded Reviews)

**MongoDB Approach**: Embed recent reviews in books document

**Postgres Approach**: Query with LIMIT and ORDER BY

```sql
-- Get book with recent reviews
SELECT 
    b.*,
    (
        SELECT json_agg(r ORDER BY r.created_at DESC)
        FROM (
            SELECT * FROM reviews 
            WHERE book_isbn = b.isbn 
            ORDER BY created_at DESC 
            LIMIT 5
        ) r
    ) AS recent_reviews
FROM books b
WHERE b.isbn = $1;
```

### 4. Polymorphic/Single Collection Pattern

**MongoDB Approach**: Store different record types in one collection with discriminator

**Postgres Options**:

**Option A: Separate Tables (Recommended)**
- Create `reservations` and `borrowed_books` tables
- Cleaner schema, better type safety
- Easier to add type-specific constraints

**Option B: Table Inheritance**
```sql
CREATE TABLE issue_details (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    book_isbn VARCHAR(13) REFERENCES books(isbn),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE reservations (
    expiration_date TIMESTAMPTZ NOT NULL
) INHERITS (issue_details);

CREATE TABLE borrowed_books (
    borrow_date TIMESTAMPTZ NOT NULL,
    due_date TIMESTAMPTZ NOT NULL,
    returned BOOLEAN DEFAULT FALSE,
    returned_date TIMESTAMPTZ
) INHERITS (issue_details);
```

**Recommendation**: Use separate tables (Option A) for simplicity and better tooling support.

### 5. Composite String Key Pattern

**MongoDB Approach**: `_id = userId + type + bookId`

**Postgres Approach**: UUID primary key with unique constraint

```sql
CREATE TABLE reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    book_isbn VARCHAR(13) NOT NULL REFERENCES books(isbn),
    expiration_date TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, book_isbn)  -- Replaces composite key uniqueness
);

-- Index for user-specific queries (replaces regex prefix matching)
CREATE INDEX idx_reservations_user ON reservations(user_id);
CREATE INDEX idx_reservations_user_book ON reservations(user_id, book_isbn);
```

### 6. Atomic Operations ($inc)

**MongoDB Approach**: `$inc: { available: -1 }`

**Postgres Approach**: Use transactions or triggers

```sql
-- Direct update (within transaction)
UPDATE books 
SET available = available - 1 
WHERE isbn = $1 AND available > 0;

-- Or use the view approach where available is always computed
```

### 7. Bidirectional Denormalization

**MongoDB Approach**: 
- `authors.books[]` contains ISBNs
- `books.authors[]` contains `{_id, name}`

**Postgres Approach**: Single junction table

```sql
CREATE TABLE book_authors (
    book_isbn VARCHAR(13) REFERENCES books(isbn) ON DELETE CASCADE,
    author_id UUID REFERENCES authors(id) ON DELETE CASCADE,
    display_order INTEGER DEFAULT 0,
    PRIMARY KEY (book_isbn, author_id)
);

-- Query books by author
SELECT b.* FROM books b
JOIN book_authors ba ON b.isbn = ba.book_isbn
WHERE ba.author_id = $1;

-- Query authors by book
SELECT a.* FROM authors a
JOIN book_authors ba ON a.id = ba.author_id
WHERE ba.book_isbn = $1
ORDER BY ba.display_order;
```

## Proposed Postgres Schema

### Complete DDL

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL CHECK (length(name) >= 5),
    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Authors table
CREATE TABLE authors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    sanitized_name VARCHAR(255) UNIQUE,
    bio TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Author aliases table
CREATE TABLE author_aliases (
    id SERIAL PRIMARY KEY,
    author_id UUID NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
    alias VARCHAR(255) NOT NULL
);
CREATE INDEX idx_author_aliases_author ON author_aliases(author_id);

-- Books table
CREATE TABLE books (
    isbn VARCHAR(13) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    year INTEGER,
    cover_url TEXT,
    pages INTEGER,
    synopsis TEXT,
    publisher VARCHAR(255),
    long_title TEXT,
    language VARCHAR(50),
    binding VARCHAR(50),
    total_inventory INTEGER NOT NULL DEFAULT 0,
    book_of_month BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Book genres junction table
CREATE TABLE book_genres (
    book_isbn VARCHAR(13) REFERENCES books(isbn) ON DELETE CASCADE,
    genre VARCHAR(100) NOT NULL,
    PRIMARY KEY (book_isbn, genre)
);

-- Book attributes table (key-value pairs)
CREATE TABLE book_attributes (
    id SERIAL PRIMARY KEY,
    book_isbn VARCHAR(13) NOT NULL REFERENCES books(isbn) ON DELETE CASCADE,
    key VARCHAR(100) NOT NULL,
    value TEXT NOT NULL
);
CREATE INDEX idx_book_attributes_book ON book_attributes(book_isbn);

-- Book-Author junction table
CREATE TABLE book_authors (
    book_isbn VARCHAR(13) REFERENCES books(isbn) ON DELETE CASCADE,
    author_id UUID REFERENCES authors(id) ON DELETE CASCADE,
    display_order INTEGER DEFAULT 0,
    PRIMARY KEY (book_isbn, author_id)
);
CREATE INDEX idx_book_authors_author ON book_authors(author_id);

-- Reviews table
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_isbn VARCHAR(13) NOT NULL REFERENCES books(isbn) ON DELETE CASCADE,
    reviewer_name VARCHAR(255) NOT NULL,
    text TEXT NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_reviews_book ON reviews(book_isbn);
CREATE INDEX idx_reviews_book_created ON reviews(book_isbn, created_at DESC);

-- Reservations table
CREATE TABLE reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    book_isbn VARCHAR(13) NOT NULL REFERENCES books(isbn) ON DELETE CASCADE,
    expiration_date TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, book_isbn)
);
CREATE INDEX idx_reservations_user ON reservations(user_id);
CREATE INDEX idx_reservations_book ON reservations(book_isbn);
CREATE INDEX idx_reservations_expiration ON reservations(expiration_date);

-- Borrowed books table
CREATE TABLE borrowed_books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    book_isbn VARCHAR(13) NOT NULL REFERENCES books(isbn) ON DELETE CASCADE,
    borrow_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    due_date TIMESTAMPTZ NOT NULL,
    returned BOOLEAN NOT NULL DEFAULT FALSE,
    returned_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_borrowed_user ON borrowed_books(user_id);
CREATE INDEX idx_borrowed_book ON borrowed_books(book_isbn);
CREATE INDEX idx_borrowed_user_returned ON borrowed_books(user_id, returned);
CREATE INDEX idx_borrowed_active ON borrowed_books(book_isbn) WHERE returned = FALSE;

-- Book availability view
CREATE VIEW v_book_availability AS
SELECT 
    b.isbn,
    b.title,
    b.total_inventory,
    COALESCE(r.reserved_count, 0) AS reserved_count,
    COALESCE(bb.borrowed_count, 0) AS borrowed_count,
    b.total_inventory 
        - COALESCE(r.reserved_count, 0) 
        - COALESCE(bb.borrowed_count, 0) AS available
FROM books b
LEFT JOIN (
    SELECT book_isbn, COUNT(*) AS reserved_count
    FROM reservations
    WHERE expiration_date > NOW()
    GROUP BY book_isbn
) r ON b.isbn = r.book_isbn
LEFT JOIN (
    SELECT book_isbn, COUNT(*) AS borrowed_count
    FROM borrowed_books
    WHERE returned = FALSE
    GROUP BY book_isbn
) bb ON b.isbn = bb.book_isbn;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_authors_updated_at BEFORE UPDATE ON authors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_books_updated_at BEFORE UPDATE ON books
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## Migration Strategy

### Phase 2: Schema Setup (Next Phase)

1. Create Supabase project
2. Execute DDL to create all tables, indexes, and views
3. Set up Row Level Security (RLS) policies if needed
4. Configure database triggers

### Phase 3: Data Migration

**Recommended Order** (respecting foreign key dependencies):

1. **users** - No dependencies
2. **authors** - No dependencies
3. **author_aliases** - Depends on authors
4. **books** - No dependencies
5. **book_genres** - Depends on books
6. **book_attributes** - Depends on books
7. **book_authors** - Depends on books, authors
8. **reviews** - Depends on books
9. **reservations** - Depends on users, books
10. **borrowed_books** - Depends on users, books

**Migration Script Approach**:

```javascript
// Pseudocode for migration
async function migrateUsers() {
    const mongoUsers = await mongodb.users.find().toArray();
    for (const user of mongoUsers) {
        await supabase.from('users').insert({
            id: generateUUID(), // or use mapping table
            name: user.name,
            is_admin: user.isAdmin
        });
        // Store ObjectId -> UUID mapping for reference updates
    }
}

async function migrateBooks() {
    const mongoBooks = await mongodb.books.find().toArray();
    for (const book of mongoBooks) {
        // Insert book
        await supabase.from('books').insert({
            isbn: book._id,
            title: book.title,
            // ... other fields
        });
        
        // Insert genres
        for (const genre of book.genres || []) {
            await supabase.from('book_genres').insert({
                book_isbn: book._id,
                genre: genre
            });
        }
        
        // Insert attributes
        for (const attr of book.attributes || []) {
            await supabase.from('book_attributes').insert({
                book_isbn: book._id,
                key: attr.key,
                value: attr.value
            });
        }
        
        // Insert book-author relationships
        for (const author of book.authors || []) {
            const authorUUID = await getAuthorUUID(author._id);
            await supabase.from('book_authors').insert({
                book_isbn: book._id,
                author_id: authorUUID
            });
        }
    }
}
```

### Phase 4: Application Code Updates

1. Replace MongoDB driver with Supabase client
2. Update all database queries
3. Replace aggregation pipelines with SQL queries/views
4. Update data models/interfaces
5. Implement proper transaction handling

### Phase 5: Testing and Validation

1. Data integrity verification
2. Query result comparison
3. Performance benchmarking
4. End-to-end application testing

## Risks and Challenges

### High Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| Data loss during migration | Critical | Run parallel systems, maintain backups, verify counts |
| ObjectId reference mapping | High | Create mapping table, validate all references |
| Computed field accuracy | High | Extensive testing of availability calculations |

### Medium Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| Performance regression | Medium | Benchmark queries, add appropriate indexes |
| Timestamp conversion errors | Medium | Validate sample data, handle edge cases |
| Missing embedded data | Medium | Audit embedded reviews vs standalone reviews |

### Low Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| Schema validation differences | Low | Implement CHECK constraints, test edge cases |
| Transaction behavior changes | Low | Review all write operations, add proper transactions |

### Technical Challenges

1. **Composite Key Migration**: The `issueDetails._id` format (`userId + type + bookId`) needs careful parsing during migration to extract user and book references.

2. **Embedded Reviews Deduplication**: Reviews exist both in the `reviews` collection and embedded in `books.reviews[]`. Need to deduplicate based on `_id` during migration.

3. **Denormalized Data Consistency**: Author names in `books.authors[]` may differ from `authors.name`. Decide which is authoritative.

4. **TTL Index Replacement**: MongoDB's TTL index on `expirationDate` needs to be replaced with a scheduled job or Supabase Edge Function to clean up expired reservations.

5. **Regex Query Replacement**: Queries like `{ _id: /^userId/ }` need to be replaced with proper indexed queries on `user_id` column.

## Recommendations for Next Phases

### Phase 2 Recommendations

1. **Use Supabase Migrations**: Leverage Supabase's migration system for version-controlled schema changes
2. **Enable RLS Early**: Set up Row Level Security policies from the start
3. **Create Seed Data**: Prepare test data that matches production patterns
4. **Set Up Monitoring**: Configure query performance monitoring

### Phase 3 Recommendations

1. **Batch Processing**: Migrate data in batches to avoid memory issues
2. **Idempotent Scripts**: Make migration scripts re-runnable
3. **Validation Queries**: Create queries to verify data integrity post-migration
4. **Rollback Plan**: Document how to revert if issues arise

### Phase 4 Recommendations

1. **Feature Flags**: Use feature flags to gradually switch to Postgres
2. **Dual-Write Period**: Consider writing to both databases during transition
3. **API Versioning**: Version APIs if breaking changes are needed
4. **Performance Testing**: Load test critical paths before cutover

### Phase 5 Recommendations

1. **Automated Tests**: Create comprehensive test suite for data operations
2. **Monitoring Alerts**: Set up alerts for query performance and errors
3. **Documentation**: Update all technical documentation
4. **Training**: Ensure team is familiar with Postgres/Supabase tooling

## ERD Diagrams

The following ERD diagrams have been generated programmatically and are available in the `docs/phase-1-erd/` directory:

1. **mongodb_current_schema.png/svg** - Visual representation of current MongoDB schema
2. **postgres_proposed_schema.png/svg** - Visual representation of proposed Postgres schema

To regenerate the diagrams, run:
```bash
cd docs/phase-1-erd
python3 generate_erd.py
```

## Appendix: Code References

| Pattern/Feature | File | Lines |
|-----------------|------|-------|
| Book model with ISBN as _id | server/src/models/book.ts | 4-63 |
| Computed available field | server/src/controllers/books.ts | 42-76 |
| Atomic inventory operations | server/src/controllers/books.ts | 152-158 |
| Polymorphic IssueDetail | server/src/models/issue-detail.ts | 3-9, 61-64 |
| Composite string key | server/src/models/issue-detail.ts | 54-59 |
| Duration constants | server/src/controllers/issue-details.ts | 30-31 |
| User schema validation | server/src/schema-validation/apply-schema.ts | 13-27 |
| Author model with books array | server/src/models/author.ts | 6-17 |
| Review model | server/src/models/review.ts | 3-14 |
