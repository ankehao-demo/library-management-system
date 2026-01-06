# Proposed Postgres Schema Design

This document describes the proposed normalized PostgreSQL database schema for the Library Management System migration from MongoDB.

## Design Principles

1. **Normalization**: Convert embedded documents to proper relational tables with foreign keys
2. **Referential Integrity**: Use foreign key constraints to maintain data consistency
3. **Type Safety**: Use appropriate PostgreSQL data types
4. **Performance**: Add indexes for common query patterns
5. **Clarity**: Split polymorphic collections into separate tables

## Schema Overview

The proposed schema converts 5 MongoDB collections into 8 PostgreSQL tables:

| MongoDB Collection | PostgreSQL Table(s) | Rationale |
|-------------------|---------------------|-----------|
| books | books, book_attributes | Normalize attributes to separate table |
| users | users | Direct mapping |
| issueDetails | reservations, borrowed_books | Split polymorphic collection |
| authors | authors, book_authors | Add junction table for many-to-many |
| reviews | reviews | Direct mapping with proper FK |

Additionally, we add:
- `book_reviews_embedded` view for backward compatibility with embedded reviews pattern

## Table Definitions

### 1. books

Stores the book catalog. Uses ISBN as primary key (preserving the natural key pattern).

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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for common queries
CREATE INDEX idx_books_title ON books(title);
CREATE INDEX idx_books_year ON books(year);
CREATE INDEX idx_books_language ON books(language);
```

**Migration Notes**:
- `_id` (ISBN) maps to `isbn` primary key
- `genres` array will be handled via a separate `book_genres` table or ARRAY type
- `available` field is now computed via a view or trigger (see below)
- `authors` embedded array replaced by `book_authors` junction table
- `reviews` embedded array replaced by `reviews` table with foreign key
- `attributes` array moved to `book_attributes` table

---

### 2. book_attributes

Normalizes the attribute pattern (key-value pairs) from the books collection.

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

---

### 3. book_genres

Normalizes the genres array from books.

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

---

### 4. users

Stores library users and administrators.

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL CHECK (length(name) >= 5),
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for name lookups
CREATE INDEX idx_users_name ON users(name);
CREATE INDEX idx_users_is_admin ON users(is_admin) WHERE is_admin = TRUE;
```

**Migration Notes**:
- MongoDB ObjectId maps to PostgreSQL UUID
- `name` constraint enforces minimum 5 characters (matching MongoDB validation)

---

### 5. authors

Stores author information.

```sql
CREATE TABLE authors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    sanitized_name VARCHAR(255) NOT NULL UNIQUE,
    bio TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_authors_name ON authors(name);
CREATE INDEX idx_authors_sanitized_name ON authors(sanitized_name);
```

---

### 6. author_aliases

Normalizes the aliases array from authors.

```sql
CREATE TABLE author_aliases (
    id SERIAL PRIMARY KEY,
    author_id UUID NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
    alias VARCHAR(255) NOT NULL,
    UNIQUE(author_id, alias)
);

CREATE INDEX idx_author_aliases_author_id ON author_aliases(author_id);
```

---

### 7. book_authors (Junction Table)

Replaces the many-to-many relationship between books and authors.

```sql
CREATE TABLE book_authors (
    book_isbn VARCHAR(13) NOT NULL REFERENCES books(isbn) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
    PRIMARY KEY (book_isbn, author_id)
);

CREATE INDEX idx_book_authors_book ON book_authors(book_isbn);
CREATE INDEX idx_book_authors_author ON book_authors(author_id);
```

**Migration Notes**:
- Replaces `authors.books[]` array (ISBNs) in MongoDB
- Replaces `books.authors[]` embedded array in MongoDB
- Enables proper foreign key constraints in both directions

---

### 8. reviews

Stores all book reviews with proper foreign key relationships.

```sql
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_isbn VARCHAR(13) NOT NULL REFERENCES books(isbn) ON DELETE CASCADE,
    reviewer_name VARCHAR(255) NOT NULL,
    text TEXT NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reviews_book ON reviews(book_isbn);
CREATE INDEX idx_reviews_rating ON reviews(rating);
CREATE INDEX idx_reviews_created_at ON reviews(created_at DESC);
```

**Migration Notes**:
- `timestamp` (Unix epoch) converts to `created_at` (TIMESTAMP)
- `bookId` (ISBN string) becomes `book_isbn` foreign key
- `name` becomes `reviewer_name` for clarity
- Removes dual storage pattern (embedded + standalone)

---

### 9. reservations

Stores book reservations (split from polymorphic `issueDetails`).

```sql
CREATE TABLE reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    book_isbn VARCHAR(13) NOT NULL REFERENCES books(isbn) ON DELETE CASCADE,
    expiration_date TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, book_isbn)
);

CREATE INDEX idx_reservations_user ON reservations(user_id);
CREATE INDEX idx_reservations_book ON reservations(book_isbn);
CREATE INDEX idx_reservations_expiration ON reservations(expiration_date);
```

**Migration Notes**:
- Composite string key `userId + 'R' + bookId` replaced by proper UUID primary key
- `UNIQUE(user_id, book_isbn)` constraint prevents duplicate reservations
- `expirationDate` becomes `expiration_date`
- Embedded `book` and `user` objects replaced by foreign keys

---

### 10. borrowed_books

Stores borrowed book records (split from polymorphic `issueDetails`).

```sql
CREATE TABLE borrowed_books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    book_isbn VARCHAR(13) NOT NULL REFERENCES books(isbn) ON DELETE CASCADE,
    borrow_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    due_date TIMESTAMP WITH TIME ZONE NOT NULL,
    returned_date TIMESTAMP WITH TIME ZONE,
    returned BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_borrowed_books_user ON borrowed_books(user_id);
CREATE INDEX idx_borrowed_books_book ON borrowed_books(book_isbn);
CREATE INDEX idx_borrowed_books_returned ON borrowed_books(returned) WHERE returned = FALSE;
CREATE INDEX idx_borrowed_books_due_date ON borrowed_books(due_date) WHERE returned = FALSE;
```

**Migration Notes**:
- Composite string key `userId + 'B' + bookId` replaced by proper UUID primary key
- Unlike reservations, borrowed_books allows multiple records per user/book (for history)
- `returned` boolean and `returned_date` track return status

---

## Computed Fields and Views

### Book Availability View

Replaces the MongoDB computed `available` field with a PostgreSQL view.

```sql
CREATE VIEW books_with_availability AS
SELECT 
    b.*,
    b.total_inventory - COALESCE(
        (SELECT COUNT(*) 
         FROM reservations r 
         WHERE r.book_isbn = b.isbn)
        +
        (SELECT COUNT(*) 
         FROM borrowed_books bb 
         WHERE bb.book_isbn = b.isbn AND bb.returned = FALSE)
    , 0) AS available
FROM books b;
```

Alternatively, use a trigger-maintained column for better query performance:

```sql
-- Add available column to books
ALTER TABLE books ADD COLUMN available INTEGER NOT NULL DEFAULT 0;

-- Function to recalculate availability
CREATE OR REPLACE FUNCTION update_book_availability()
RETURNS TRIGGER AS $$
DECLARE
    target_isbn VARCHAR(13);
BEGIN
    -- Determine which book to update
    IF TG_TABLE_NAME = 'reservations' THEN
        target_isbn := COALESCE(NEW.book_isbn, OLD.book_isbn);
    ELSIF TG_TABLE_NAME = 'borrowed_books' THEN
        target_isbn := COALESCE(NEW.book_isbn, OLD.book_isbn);
    END IF;
    
    -- Update the available count
    UPDATE books 
    SET available = total_inventory - (
        SELECT COUNT(*) FROM reservations WHERE book_isbn = target_isbn
    ) - (
        SELECT COUNT(*) FROM borrowed_books WHERE book_isbn = target_isbn AND returned = FALSE
    ),
    updated_at = CURRENT_TIMESTAMP
    WHERE isbn = target_isbn;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Triggers for reservations
CREATE TRIGGER trg_reservations_availability
AFTER INSERT OR UPDATE OR DELETE ON reservations
FOR EACH ROW EXECUTE FUNCTION update_book_availability();

-- Triggers for borrowed_books
CREATE TRIGGER trg_borrowed_books_availability
AFTER INSERT OR UPDATE OR DELETE ON borrowed_books
FOR EACH ROW EXECUTE FUNCTION update_book_availability();
```

---

### Recent Reviews View

Provides backward compatibility with the embedded reviews pattern (subset of recent reviews per book).

```sql
CREATE VIEW book_recent_reviews AS
SELECT 
    b.isbn as book_isbn,
    b.title as book_title,
    r.id as review_id,
    r.reviewer_name,
    r.text,
    r.rating,
    r.created_at
FROM books b
LEFT JOIN LATERAL (
    SELECT * FROM reviews 
    WHERE book_isbn = b.isbn 
    ORDER BY created_at DESC 
    LIMIT 5
) r ON true;
```

---

## ID Mapping Strategy

During migration, we need to map MongoDB ObjectIds to PostgreSQL UUIDs:

```sql
-- Temporary mapping table for migration
CREATE TABLE id_mapping (
    collection_name VARCHAR(50) NOT NULL,
    mongo_id VARCHAR(24) NOT NULL,
    postgres_id UUID NOT NULL,
    PRIMARY KEY (collection_name, mongo_id)
);
```

---

## Complete Schema Diagram

```
+------------------+       +------------------+       +------------------+
|      users       |       |      books       |       |     authors      |
+------------------+       +------------------+       +------------------+
| id (UUID) PK     |       | isbn (VARCHAR) PK|       | id (UUID) PK     |
| name             |       | title            |       | name             |
| is_admin         |       | year             |       | sanitized_name   |
| created_at       |       | cover_url        |       | bio              |
| updated_at       |       | pages            |       | created_at       |
+--------+---------+       | synopsis         |       | updated_at       |
         |                 | publisher        |       +--------+---------+
         |                 | long_title       |                |
         |                 | language         |                |
         |                 | binding          |                |
         |                 | total_inventory  |       +--------+---------+
         |                 | available        |       | author_aliases   |
         |                 | book_of_the_month|       +------------------+
         |                 | created_at       |       | id (SERIAL) PK   |
         |                 | updated_at       |       | author_id FK     |
         |                 +--------+---------+       | alias            |
         |                          |                 +------------------+
         |                          |
+--------+---------+       +--------+---------+       +------------------+
|   reservations   |       |   book_authors   |       |     reviews      |
+------------------+       +------------------+       +------------------+
| id (UUID) PK     |       | book_isbn FK     |       | id (UUID) PK     |
| user_id FK       +------>| author_id FK     |<------+ book_isbn FK     |
| book_isbn FK     |       +------------------+       | reviewer_name    |
| expiration_date  |                                  | text             |
| created_at       |       +------------------+       | rating           |
+------------------+       | book_attributes  |       | created_at       |
                           +------------------+       +------------------+
+------------------+       | id (SERIAL) PK   |
|  borrowed_books  |       | book_isbn FK     |       +------------------+
+------------------+       | key              |       |   book_genres    |
| id (UUID) PK     |       | value            |       +------------------+
| user_id FK       |       +------------------+       | id (SERIAL) PK   |
| book_isbn FK     |                                  | book_isbn FK     |
| borrow_date      |                                  | genre            |
| due_date         |                                  +------------------+
| returned_date    |
| returned         |
| created_at       |
| updated_at       |
+------------------+
```

---

## Foreign Key Relationships

| Parent Table | Child Table | Foreign Key | On Delete |
|--------------|-------------|-------------|-----------|
| books | book_attributes | book_isbn | CASCADE |
| books | book_genres | book_isbn | CASCADE |
| books | book_authors | book_isbn | CASCADE |
| books | reviews | book_isbn | CASCADE |
| books | reservations | book_isbn | CASCADE |
| books | borrowed_books | book_isbn | CASCADE |
| authors | book_authors | author_id | CASCADE |
| authors | author_aliases | author_id | CASCADE |
| users | reservations | user_id | CASCADE |
| users | borrowed_books | user_id | CASCADE |

---

## Supabase-Specific Considerations

When deploying to Supabase:

1. **Row Level Security (RLS)**: Enable RLS on all tables and create appropriate policies
2. **Realtime**: Enable realtime subscriptions for tables that need live updates
3. **Auth Integration**: Consider linking `users` table to Supabase Auth
4. **Storage**: Book cover images can use Supabase Storage instead of URLs

Example RLS policies:

```sql
-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE borrowed_books ENABLE ROW LEVEL SECURITY;

-- Users can read their own data
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid() = id);

-- Users can view their own reservations
CREATE POLICY "Users can view own reservations" ON reservations
    FOR SELECT USING (auth.uid() = user_id);

-- Admins can view all data
CREATE POLICY "Admins can view all users" ON users
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = TRUE)
    );
```

---

## Migration Sequence

1. Create all tables without foreign keys
2. Migrate `users` collection (map ObjectId to UUID)
3. Migrate `authors` collection (map ObjectId to UUID)
4. Migrate `author_aliases` from `authors.aliases[]`
5. Migrate `books` collection (ISBN as-is)
6. Migrate `book_attributes` from `books.attributes[]`
7. Migrate `book_genres` from `books.genres[]`
8. Migrate `book_authors` junction table
9. Migrate `reviews` collection
10. Migrate `issueDetails` to `reservations` and `borrowed_books`
11. Add all foreign key constraints
12. Create views and triggers
13. Validate data integrity
