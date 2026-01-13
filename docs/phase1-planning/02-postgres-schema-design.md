# Proposed Postgres Schema Design

This document describes the proposed PostgreSQL/Supabase schema design for migrating the Library Management System from MongoDB.

## Design Principles

1. **Proper Normalization**: Convert embedded documents and arrays to separate tables with foreign key relationships
2. **Referential Integrity**: Use foreign keys to enforce data consistency
3. **Type Safety**: Use appropriate PostgreSQL data types
4. **Performance**: Add indexes for common query patterns
5. **Maintainability**: Replace composite string keys with proper primary keys and indexes

## Schema Overview

The proposed schema converts 5 MongoDB collections into 8 PostgreSQL tables:

| MongoDB Collection | PostgreSQL Table(s) | Notes |
|-------------------|---------------------|-------|
| books | books, book_attributes | Split attributes to separate table |
| users | users | Direct mapping |
| issueDetails | reservations, borrowed_books | Split polymorphic collection |
| authors | authors, book_authors | Add junction table for many-to-many |
| reviews | reviews | Direct mapping with foreign key |

## Table Definitions

### 1. books

Stores book information. Uses ISBN as primary key (preserving MongoDB pattern).

```sql
CREATE TABLE books (
    isbn VARCHAR(13) PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    year INTEGER NOT NULL,
    cover_url TEXT,
    pages INTEGER,
    synopsis TEXT,
    publisher VARCHAR(255),
    long_title VARCHAR(1000),
    language VARCHAR(50),
    binding VARCHAR(50),
    total_inventory INTEGER NOT NULL DEFAULT 0,
    book_of_the_month BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_books_title ON books(title);
CREATE INDEX idx_books_year ON books(year);
CREATE INDEX idx_books_publisher ON books(publisher);
```

**Notes**:
- The `available` field is NOT stored directly; it will be computed via a view or function
- ISBN is kept as primary key to maintain compatibility with existing data
- `genres` array moved to separate table (see book_genres below)

### 2. book_genres

Stores book genres (normalized from array in MongoDB).

```sql
CREATE TABLE book_genres (
    id SERIAL PRIMARY KEY,
    book_isbn VARCHAR(13) NOT NULL REFERENCES books(isbn) ON DELETE CASCADE,
    genre VARCHAR(100) NOT NULL,
    UNIQUE(book_isbn, genre)
);

CREATE INDEX idx_book_genres_isbn ON book_genres(book_isbn);
CREATE INDEX idx_book_genres_genre ON book_genres(genre);
```

### 3. book_attributes

Stores flexible key-value attributes (normalized from attribute pattern).

```sql
CREATE TABLE book_attributes (
    id SERIAL PRIMARY KEY,
    book_isbn VARCHAR(13) NOT NULL REFERENCES books(isbn) ON DELETE CASCADE,
    key VARCHAR(100) NOT NULL,
    value TEXT NOT NULL,
    UNIQUE(book_isbn, key)
);

CREATE INDEX idx_book_attributes_isbn ON book_attributes(book_isbn);
CREATE INDEX idx_book_attributes_key ON book_attributes(key);
```

### 4. users

Stores library user information.

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mongo_id VARCHAR(24),  -- Preserve original MongoDB ObjectId for migration
    name VARCHAR(255) NOT NULL CHECK (char_length(name) >= 5),
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_users_mongo_id ON users(mongo_id) WHERE mongo_id IS NOT NULL;
CREATE INDEX idx_users_name ON users(name);
```

**Notes**:
- Uses UUID as primary key for new records
- Preserves MongoDB ObjectId in `mongo_id` column for migration reference
- Enforces minimum name length via CHECK constraint

### 5. authors

Stores author information.

```sql
CREATE TABLE authors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mongo_id VARCHAR(24),  -- Preserve original MongoDB ObjectId for migration
    name VARCHAR(255) NOT NULL,
    sanitized_name VARCHAR(255) NOT NULL,
    bio TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_authors_mongo_id ON authors(mongo_id) WHERE mongo_id IS NOT NULL;
CREATE UNIQUE INDEX idx_authors_sanitized_name ON authors(sanitized_name);
CREATE INDEX idx_authors_name ON authors(name);
```

### 6. author_aliases

Stores author aliases (normalized from array in MongoDB).

```sql
CREATE TABLE author_aliases (
    id SERIAL PRIMARY KEY,
    author_id UUID NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
    alias VARCHAR(255) NOT NULL,
    UNIQUE(author_id, alias)
);

CREATE INDEX idx_author_aliases_author_id ON author_aliases(author_id);
```

### 7. book_authors (Junction Table)

Replaces the bidirectional references between books and authors with a proper many-to-many relationship.

```sql
CREATE TABLE book_authors (
    id SERIAL PRIMARY KEY,
    book_isbn VARCHAR(13) NOT NULL REFERENCES books(isbn) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
    display_order INTEGER DEFAULT 0,  -- For ordering multiple authors
    UNIQUE(book_isbn, author_id)
);

CREATE INDEX idx_book_authors_isbn ON book_authors(book_isbn);
CREATE INDEX idx_book_authors_author_id ON book_authors(author_id);
```

**Notes**:
- Replaces both `books.authors[]` array and `authors.books[]` array
- `display_order` preserves author ordering for books with multiple authors

### 8. reviews

Stores all book reviews (replaces both embedded reviews and reviews collection).

```sql
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mongo_id VARCHAR(24),  -- Preserve original MongoDB ObjectId for migration
    book_isbn VARCHAR(13) NOT NULL REFERENCES books(isbn) ON DELETE CASCADE,
    reviewer_name VARCHAR(255) NOT NULL,
    text TEXT NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    timestamp BIGINT NOT NULL,  -- Unix timestamp in milliseconds
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_reviews_mongo_id ON reviews(mongo_id) WHERE mongo_id IS NOT NULL;
CREATE INDEX idx_reviews_book_isbn ON reviews(book_isbn);
CREATE INDEX idx_reviews_timestamp ON reviews(timestamp DESC);
CREATE INDEX idx_reviews_rating ON reviews(rating);
```

**Notes**:
- Consolidates embedded reviews and reviews collection into single table
- `timestamp` kept as BIGINT to preserve original Unix timestamp format

### 9. reservations

Stores book reservations (split from polymorphic issueDetails collection).

```sql
CREATE TABLE reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    book_isbn VARCHAR(13) NOT NULL REFERENCES books(isbn) ON DELETE CASCADE,
    expiration_date TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, book_isbn)  -- One reservation per user per book
);

CREATE INDEX idx_reservations_user_id ON reservations(user_id);
CREATE INDEX idx_reservations_book_isbn ON reservations(book_isbn);
CREATE INDEX idx_reservations_expiration ON reservations(expiration_date);
```

**Notes**:
- Replaces composite string key with proper UUID primary key
- Unique constraint on (user_id, book_isbn) enforces business rule
- TTL behavior can be implemented via pg_cron or application logic

### 10. borrowed_books

Stores borrowed book records (split from polymorphic issueDetails collection).

```sql
CREATE TABLE borrowed_books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    book_isbn VARCHAR(13) NOT NULL REFERENCES books(isbn) ON DELETE CASCADE,
    borrow_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    due_date TIMESTAMP WITH TIME ZONE NOT NULL,
    returned_date TIMESTAMP WITH TIME ZONE,
    returned BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_borrowed_books_user_id ON borrowed_books(user_id);
CREATE INDEX idx_borrowed_books_book_isbn ON borrowed_books(book_isbn);
CREATE INDEX idx_borrowed_books_due_date ON borrowed_books(due_date);
CREATE INDEX idx_borrowed_books_returned ON borrowed_books(returned);
CREATE INDEX idx_borrowed_books_user_active ON borrowed_books(user_id) WHERE returned = FALSE;
```

**Notes**:
- Allows multiple borrow records per user per book (for history)
- Partial index on active borrows for efficient queries

## Computed Available Field

The `available` field is computed dynamically. Two approaches are possible:

### Option A: Database View (Recommended)

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

### Option B: Trigger-Maintained Column

```sql
-- Add available column to books
ALTER TABLE books ADD COLUMN available INTEGER NOT NULL DEFAULT 0;

-- Create function to recalculate availability
CREATE OR REPLACE FUNCTION update_book_availability()
RETURNS TRIGGER AS $$
DECLARE
    target_isbn VARCHAR(13);
    active_count INTEGER;
BEGIN
    -- Determine which book to update
    IF TG_TABLE_NAME = 'reservations' THEN
        target_isbn := COALESCE(NEW.book_isbn, OLD.book_isbn);
    ELSIF TG_TABLE_NAME = 'borrowed_books' THEN
        target_isbn := COALESCE(NEW.book_isbn, OLD.book_isbn);
    END IF;
    
    -- Count active reservations and borrows
    SELECT COUNT(*) INTO active_count
    FROM (
        SELECT book_isbn FROM reservations WHERE book_isbn = target_isbn
        UNION ALL
        SELECT book_isbn FROM borrowed_books WHERE book_isbn = target_isbn AND returned = FALSE
    ) active;
    
    -- Update the book's available count
    UPDATE books 
    SET available = total_inventory - active_count,
        updated_at = NOW()
    WHERE isbn = target_isbn;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER trg_reservation_availability
AFTER INSERT OR UPDATE OR DELETE ON reservations
FOR EACH ROW EXECUTE FUNCTION update_book_availability();

CREATE TRIGGER trg_borrowed_availability
AFTER INSERT OR UPDATE OR DELETE ON borrowed_books
FOR EACH ROW EXECUTE FUNCTION update_book_availability();
```

## Query Pattern Migrations

### Original MongoDB: Get user's reservations by regex

```javascript
// MongoDB
db.issueDetails.find({ _id: /^userId/ })
```

```sql
-- PostgreSQL
SELECT * FROM reservations WHERE user_id = :user_id;
```

### Original MongoDB: Get book with computed availability

```javascript
// MongoDB aggregation pipeline
db.books.aggregate([
  { $match: { _id: bookId } },
  { $lookup: { from: 'issueDetails', ... } },
  { $set: { available: { $subtract: [...] } } }
])
```

```sql
-- PostgreSQL (using view)
SELECT * FROM books_with_availability WHERE isbn = :isbn;

-- Or with explicit calculation
SELECT 
    b.*,
    b.total_inventory - (
        SELECT COUNT(*) FROM reservations r WHERE r.book_isbn = b.isbn
    ) - (
        SELECT COUNT(*) FROM borrowed_books bb WHERE bb.book_isbn = b.isbn AND bb.returned = FALSE
    ) AS available
FROM books b
WHERE b.isbn = :isbn;
```

### Original MongoDB: Atomic inventory update

```javascript
// MongoDB
db.books.updateOne({ _id: bookId }, { $inc: { available: count } })
```

```sql
-- PostgreSQL (if using trigger approach, just insert/update/delete the reservation or borrow)
-- The trigger handles the availability update automatically

-- Or manual update if needed:
UPDATE books 
SET available = available + :count, updated_at = NOW() 
WHERE isbn = :isbn;
```

## Entity Relationship Summary

```
                    +------------------+
                    |     authors      |
                    +------------------+
                    | id (UUID) PK     |
                    | name             |
                    | sanitized_name   |
                    | bio              |
                    +--------+---------+
                             |
                             | 1:N
                             v
                    +------------------+
                    | author_aliases   |
                    +------------------+
                    | author_id FK     |
                    | alias            |
                    +------------------+
                             ^
                             | N:1
                             |
+------------------+         |         +------------------+
|     books        +---------+---------+   book_authors   |
+------------------+    N:M            +------------------+
| isbn (PK)        +-------------------+ book_isbn FK     |
| title            |                   | author_id FK     |
| year             |                   +------------------+
| total_inventory  |
| ...              |
+--------+---------+
         |
         | 1:N
         v
+------------------+     +------------------+     +------------------+
| book_genres      |     | book_attributes  |     |    reviews       |
+------------------+     +------------------+     +------------------+
| book_isbn FK     |     | book_isbn FK     |     | book_isbn FK     |
| genre            |     | key              |     | reviewer_name    |
+------------------+     | value            |     | text             |
                         +------------------+     | rating           |
                                                  +------------------+

+------------------+
|     users        |
+------------------+
| id (UUID) PK     |
| name             |
| is_admin         |
+--------+---------+
         |
         | 1:N
         +---------------------------+
         |                           |
         v                           v
+------------------+        +------------------+
|  reservations    |        | borrowed_books   |
+------------------+        +------------------+
| user_id FK       |        | user_id FK       |
| book_isbn FK     |        | book_isbn FK     |
| expiration_date  |        | borrow_date      |
+------------------+        | due_date         |
                            | returned         |
                            +------------------+
```

## Migration ID Mapping Strategy

To maintain referential integrity during migration:

1. **Users**: Map MongoDB ObjectId to new UUID, store original in `mongo_id`
2. **Authors**: Map MongoDB ObjectId to new UUID, store original in `mongo_id`
3. **Reviews**: Map MongoDB ObjectId to new UUID, store original in `mongo_id`
4. **Books**: Keep ISBN as primary key (no mapping needed)
5. **IssueDetails**: Parse composite string key to extract user_id and book_isbn, create new UUID

## Supabase-Specific Considerations

1. **Row Level Security (RLS)**: Enable RLS on all tables for multi-tenant security
2. **Realtime**: Enable realtime subscriptions for reservations and borrowed_books
3. **Storage**: Book cover images can use Supabase Storage
4. **Edge Functions**: Implement TTL cleanup for expired reservations
5. **Auth Integration**: Link users table to Supabase Auth for authentication
