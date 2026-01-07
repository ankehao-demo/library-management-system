# Phase 2: Postgres Schema Design for Supabase Migration

This document describes the Postgres schema implemented in Supabase as part of the MongoDB to Supabase migration. The schema was designed based on the Phase 1 planning documentation and implements all the recommended patterns and transformations.

## Schema Overview

The migration converts 5 MongoDB collections into 10 Postgres tables plus 1 database view:

| MongoDB Collection | Postgres Tables |
|-------------------|-----------------|
| books | books, book_genres, book_attributes, book_authors |
| users | users |
| authors | authors, author_aliases |
| reviews | reviews |
| issueDetails | reservations, borrowed_books |
| (computed) | v_book_availability (view) |

## Tables Created

### 1. users

Stores user accounts with admin privileges.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique identifier |
| name | VARCHAR(255) | NOT NULL, CHECK (length >= 5) | User's display name |
| is_admin | BOOLEAN | NOT NULL, DEFAULT FALSE | Admin privilege flag |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Record creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |

**Indexes**: `idx_users_is_admin` on `is_admin`

**Design Decision**: The CHECK constraint on `name` length (>= 5 characters) mirrors the MongoDB schema validation that was enforced at the database level.

### 2. authors

Stores author information.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique identifier |
| name | VARCHAR(255) | NOT NULL | Author's full name |
| sanitized_name | VARCHAR(255) | UNIQUE | URL-friendly slug |
| bio | TEXT | | Author biography |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Record creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |

**Indexes**: `idx_authors_name` on `name`

**Design Decision**: The `sanitized_name` column is marked UNIQUE to support URL-based lookups (e.g., `/authors/f-scott-fitzgerald`).

### 3. author_aliases

Stores alternative names for authors (normalized from embedded array).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing identifier |
| author_id | UUID | NOT NULL, FK -> authors(id) ON DELETE CASCADE | Reference to author |
| alias | VARCHAR(255) | NOT NULL | Alternative name |

**Indexes**: `idx_author_aliases_author` on `author_id`

**Design Decision**: Normalized from the `authors.aliases[]` array in MongoDB. Using SERIAL for the primary key since aliases don't need globally unique identifiers.

### 4. books

Stores book catalog information.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| isbn | VARCHAR(13) | PRIMARY KEY | ISBN-13 identifier |
| title | VARCHAR(255) | NOT NULL | Book title |
| year | INTEGER | | Publication year |
| cover_url | TEXT | | URL to cover image |
| pages | INTEGER | | Page count |
| synopsis | TEXT | | Book description |
| publisher | VARCHAR(255) | | Publisher name |
| long_title | TEXT | | Extended title |
| language | VARCHAR(50) | | Language code |
| binding | VARCHAR(50) | | Binding type |
| total_inventory | INTEGER | NOT NULL, DEFAULT 0 | Total copies owned |
| book_of_month | BOOLEAN | DEFAULT FALSE | Featured book flag |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Record creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |

**Indexes**: 
- `idx_books_title` on `title`
- `idx_books_year` on `year`
- `idx_books_book_of_month` partial index WHERE `book_of_month = TRUE`

**Design Decision**: Using ISBN as the primary key (natural key) matches the MongoDB design where `_id` was the ISBN. The `available` field is NOT stored here - it's computed via the `v_book_availability` view.

### 5. book_genres

Junction table for book-genre relationships (normalized from embedded array).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| book_isbn | VARCHAR(13) | FK -> books(isbn) ON DELETE CASCADE | Reference to book |
| genre | VARCHAR(100) | NOT NULL | Genre name |

**Primary Key**: Composite (book_isbn, genre)

**Indexes**: `idx_book_genres_genre` on `genre`

**Design Decision**: Normalized from the `books.genres[]` array. Using a composite primary key ensures no duplicate genre entries per book.

### 6. book_attributes

Stores flexible key-value attributes for books (normalized from embedded array).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing identifier |
| book_isbn | VARCHAR(13) | NOT NULL, FK -> books(isbn) ON DELETE CASCADE | Reference to book |
| key | VARCHAR(100) | NOT NULL | Attribute name |
| value | TEXT | NOT NULL | Attribute value |

**Indexes**: 
- `idx_book_attributes_book` on `book_isbn`
- `idx_book_attributes_key` on `key`

**Design Decision**: Preserves the MongoDB Attribute Pattern for flexible key-value data. Using SERIAL for the primary key allows multiple attributes with the same key if needed.

### 7. book_authors

Junction table for many-to-many book-author relationships.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| book_isbn | VARCHAR(13) | FK -> books(isbn) ON DELETE CASCADE | Reference to book |
| author_id | UUID | FK -> authors(id) ON DELETE CASCADE | Reference to author |
| display_order | INTEGER | DEFAULT 0 | Author ordering for display |

**Primary Key**: Composite (book_isbn, author_id)

**Indexes**: `idx_book_authors_author` on `author_id`

**Design Decision**: Replaces the bidirectional denormalization in MongoDB where `books.authors[]` contained author references and `authors.books[]` contained ISBNs. The `display_order` column supports ordering multiple authors on a book.

### 8. reviews

Stores book reviews (normalized from both standalone collection and embedded array).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique identifier |
| book_isbn | VARCHAR(13) | NOT NULL, FK -> books(isbn) ON DELETE CASCADE | Reference to book |
| reviewer_name | VARCHAR(255) | NOT NULL | Reviewer's display name |
| text | TEXT | NOT NULL | Review content |
| rating | INTEGER | CHECK (rating >= 1 AND rating <= 5) | Star rating |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Review timestamp |

**Indexes**: 
- `idx_reviews_book` on `book_isbn`
- `idx_reviews_book_created` on `(book_isbn, created_at DESC)`

**Design Decision**: Consolidates reviews from both the standalone `reviews` collection and the embedded `books.reviews[]` array. The CHECK constraint enforces the 1-5 star rating range. The composite index on `(book_isbn, created_at DESC)` optimizes queries for recent reviews.

### 9. reservations

Stores book reservations (split from polymorphic issueDetails collection).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique identifier |
| user_id | UUID | NOT NULL, FK -> users(id) ON DELETE CASCADE | Reference to user |
| book_isbn | VARCHAR(13) | NOT NULL, FK -> books(isbn) ON DELETE CASCADE | Reference to book |
| expiration_date | TIMESTAMPTZ | NOT NULL | Reservation expiry time |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Record creation timestamp |

**Unique Constraint**: (user_id, book_isbn) - prevents duplicate reservations

**Indexes**: 
- `idx_reservations_user` on `user_id`
- `idx_reservations_book` on `book_isbn`
- `idx_reservations_expiration` on `expiration_date`

**Design Decision**: Split from the polymorphic `issueDetails` collection. The UNIQUE constraint on (user_id, book_isbn) replaces the composite string key pattern (`userId + 'R' + bookId`) used in MongoDB. Reservation duration is 12 hours (0.5 days) as defined in the application logic.

### 10. borrowed_books

Stores borrowed book records (split from polymorphic issueDetails collection).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique identifier |
| user_id | UUID | NOT NULL, FK -> users(id) ON DELETE CASCADE | Reference to user |
| book_isbn | VARCHAR(13) | NOT NULL, FK -> books(isbn) ON DELETE CASCADE | Reference to book |
| borrow_date | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | When book was borrowed |
| due_date | TIMESTAMPTZ | NOT NULL | When book is due |
| returned | BOOLEAN | NOT NULL, DEFAULT FALSE | Return status |
| returned_date | TIMESTAMPTZ | | Actual return date |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Record creation timestamp |

**Indexes**: 
- `idx_borrowed_user` on `user_id`
- `idx_borrowed_book` on `book_isbn`
- `idx_borrowed_user_returned` on `(user_id, returned)`
- `idx_borrowed_active` partial index on `book_isbn` WHERE `returned = FALSE`

**Design Decision**: Split from the polymorphic `issueDetails` collection. Unlike reservations, borrowed_books does NOT have a unique constraint on (user_id, book_isbn) because a user can borrow the same book multiple times (after returning it). The partial index on active borrows optimizes availability calculations. Borrow duration is 21 days as defined in the application logic.

## Database View

### v_book_availability

Computes real-time book availability (replaces MongoDB's computed `available` field).

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

**Design Decision**: Uses a database view instead of a trigger-maintained column. This approach:
- Ensures real-time accuracy without synchronization issues
- Simplifies the schema (no need for triggers on reservations/borrowed_books)
- Can be optimized to a materialized view if performance requires

## Triggers

### update_updated_at_column()

Automatically updates the `updated_at` timestamp on record modifications.

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';
```

Applied to: `users`, `authors`, `books`

## Key Design Decisions

### 1. Polymorphic Collection Split

The MongoDB `issueDetails` collection used a polymorphic pattern with a `recordType` discriminator field to store both reservations and borrowed books. This has been split into two separate tables:

- **reservations**: For active book holds (12-hour expiration)
- **borrowed_books**: For checked-out books (21-day loan period)

**Rationale**: Separate tables provide better type safety, clearer constraints, and easier querying. Each table can have type-specific columns and constraints.

### 2. Composite String Key Replacement

MongoDB used composite string keys like `userId + 'R' + bookId` for uniqueness. This has been replaced with:

- UUID primary keys for global uniqueness
- UNIQUE constraints on (user_id, book_isbn) for reservations
- Proper foreign key references

**Rationale**: Standard relational patterns are more maintainable and support proper referential integrity.

### 3. Computed Field as View

The `available` field in MongoDB was computed at query time using aggregation pipelines. In Postgres, this is implemented as a database view.

**Rationale**: Views provide the same real-time computation without the complexity of triggers. If performance becomes an issue, this can be converted to a materialized view with periodic refresh.

### 4. Embedded Array Normalization

Embedded arrays in MongoDB have been normalized into separate tables:

| MongoDB Pattern | Postgres Tables |
|-----------------|-----------------|
| books.genres[] | book_genres |
| books.attributes[] | book_attributes |
| books.authors[] | book_authors |
| books.reviews[] | reviews |
| authors.aliases[] | author_aliases |
| authors.books[] | book_authors (reverse) |

**Rationale**: Normalization enables proper foreign key constraints, better query flexibility, and eliminates data duplication.

### 5. Extended Reference Pattern Removal

MongoDB's extended reference pattern (embedding `{_id, name}` subsets) has been replaced with proper foreign key joins.

**Rationale**: Foreign keys with JOINs provide data consistency and eliminate the risk of stale denormalized data.

## Migration Order for Phase 3

When migrating data, tables must be populated in this order to respect foreign key dependencies:

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

## Supabase Project Details

- **Project Name**: library-demo
- **Project ID**: bskflqvoxurbxrhjqqqj
- **Region**: us-east-1
- **Database Host**: db.bskflqvoxurbxrhjqqqj.supabase.co

## Applied Migrations

| Version | Name |
|---------|------|
| 20260107191709 | create_users_table |
| 20260107191722 | create_authors_table |
| 20260107191734 | create_author_aliases_table |
| 20260107191747 | create_books_table |
| 20260107191822 | create_book_genres_table |
| 20260107191823 | create_book_attributes_table |
| 20260107191835 | create_book_authors_junction_table |
| 20260107191856 | create_reviews_table |
| 20260107191914 | create_reservations_table_v2 |
| 20260107191927 | create_borrowed_books_issue_tracking |
| 20260107191956 | create_book_availability_view |
| 20260107192017 | add_updated_at_triggers |

## Next Steps (Phase 3)

1. Create ETL scripts to migrate data from MongoDB to Supabase
2. Handle ObjectId to UUID mapping for users and authors
3. Parse composite string keys in issueDetails to extract user_id and book_isbn
4. Deduplicate reviews from both standalone collection and embedded arrays
5. Validate data integrity after migration
