# Phase 1: MongoDB to Supabase/Postgres Migration Plan

## Executive Summary

This document outlines the migration plan from MongoDB to Supabase/Postgres for the Library Management System. It includes a complete analysis of the current MongoDB schema, a detailed Entity-Relationship Diagram (ERD) for the target Postgres database, and documentation of how MongoDB-specific patterns will be handled in the relational model.

---

## 1. Current MongoDB Schema Analysis

### 1.1 Collections Overview

The Library Management System uses 5 MongoDB collections defined in `server/src/database.ts`:

| Collection | Primary Key Type | Description |
|------------|------------------|-------------|
| `books` | String (ISBN) | Book catalog with inventory tracking |
| `authors` | ObjectId | Author information with book references |
| `users` | ObjectId | User accounts with admin flag |
| `reviews` | ObjectId | Book reviews with ratings |
| `issueDetails` | Composite String | Reservations and borrowed books (polymorphic) |

### 1.2 Detailed Collection Schemas

#### 1.2.1 Books Collection

**Source**: `server/src/models/book.ts`

```typescript
interface Book {
    _id: string;              // ISBN as primary key
    title: string;
    year: number;
    cover?: string;           // URL to cover image
    genres?: Array<string>;
    pages?: number;
    synopsis?: string;
    publisher?: string;
    longTitle?: string;
    language?: string;
    binding?: string;
    totalInventory: number;
    available: number;        // COMPUTED FIELD
    authors?: Array<{         // Extended reference pattern
        _id: ObjectId;
        name: string;
    }>;
    attributes: Array<{       // Attribute pattern (key-value pairs)
        key: string;
        value: string;
    }>;
    reviews: Array<{          // Subset pattern (embedded reviews)
        text: string;
        name: string;
        rating?: number;
        timestamp: number;
    }>;
    bookOfTheMonth?: boolean;
}
```

**MongoDB Patterns Used**:
- **Computed Pattern**: `available` field is calculated dynamically via aggregation pipeline
- **Extended Reference Pattern**: Authors embedded with `_id` and `name` for denormalization
- **Attribute Pattern**: Flexible key-value pairs for custom attributes
- **Subset Pattern**: Up to 5 reviews embedded directly in the book document

#### 1.2.2 Authors Collection

**Source**: `server/src/models/author.ts`

```typescript
interface Author {
    _id: ObjectId;
    name: string;
    sanitizedName: string;    // URL-friendly name
    aliases: Array<string>;
    bio?: string;
    books: Array<string>;     // Array of ISBNs (book references)
}
```

**MongoDB Patterns Used**:
- **Array of References**: Books stored as array of ISBN strings

#### 1.2.3 Users Collection

**Source**: `server/src/models/user.ts` and `server/src/schema-validation/apply-schema.ts`

```typescript
interface User {
    _id?: ObjectId;
    name: string;             // Required, minimum 5 characters
    isAdmin?: boolean;        // Required boolean
}
```

**Schema Validation** (from `apply-schema.ts`):
- `name`: Required string with minimum length of 5 characters
- `isAdmin`: Required boolean

#### 1.2.4 Reviews Collection

**Source**: `server/src/models/review.ts`

```typescript
interface Review {
    _id: ObjectId;
    text: string;
    name: string;             // Reviewer name
    rating?: number;
    timestamp: number;
    bookId: string;           // Foreign key to books collection
}
```

#### 1.2.5 IssueDetails Collection (Polymorphic)

**Source**: `server/src/models/issue-detail.ts`

This collection uses the **Single Collection Pattern** (polymorphic) to store both reservations and borrowed books:

```typescript
type IssueDetail = BorrowedBook | Reservation;

interface IssueDetailBase {
    _id: string;              // COMPOSITE KEY: userId + type + bookId
    recordType: string;       // Discriminator: 'reservation' or 'borrowedBook'
    book: {                   // Extended reference
        _id: string;
        title: string;
    };
    user: {                   // Extended reference
        _id: ObjectId;
        name: string;
    };
}

interface Reservation extends IssueDetailBase {
    expirationDate: Date;     // TTL index for auto-expiration
}

interface BorrowedBook extends IssueDetailBase {
    borrowDate: Date;
    dueDate: Date;
    returnedDate?: Date;
    returned: boolean;
}
```

**Composite Key Format** (from `server/src/controllers/issue-details.ts`):
- Reservation: `${userId}R${bookId}` (e.g., `507f1f77bcf86cd799439011R9780743273565`)
- Borrowed Book: `${userId}B${bookId}` (e.g., `507f1f77bcf86cd799439011B9780743273565`)

**Duration Constants**:
- `RESERVATION_DURATION`: 0.5 days (12 hours)
- `BORROWED_DURATION`: 21 days

---

## 2. MongoDB-Specific Patterns Documentation

### 2.1 Computed Fields

**Current Implementation** (`server/src/controllers/books.ts`, lines 42-76):

The `available` field is computed at query time using an aggregation pipeline:

```javascript
const books = await collections?.books?.aggregate<Book>([
    { $match: { _id: bookId } },
    {
        $lookup: {
            from: 'issueDetails',
            localField: '_id',
            foreignField: 'book._id',
            pipeline: [
                {
                    $match: {
                        $or: [
                            { recordType: 'reservation' },
                            { recordType: 'borrowedBook', returned: false }
                        ]
                    }
                }
            ],
            as: 'details'
        }
    },
    {
        $set: {
            available: { $subtract: ['$totalInventory', { $size: '$details' }] }
        }
    },
    { $unset: 'details' }
]).toArray();
```

**Formula**: `available = totalInventory - (active reservations + unreturned borrows)`

### 2.2 Atomic Operations

**Current Implementation** (`server/src/controllers/books.ts`, lines 152-158):

Inventory updates use MongoDB's `$inc` operator for atomic operations:

```javascript
private updateBookInventory(bookId: string, count: number): Promise<UpdateResult> {
    const result = collections?.books?.updateOne(
        { _id: bookId },
        { $inc: { available: count } }
    );
    return result;
}
```

### 2.3 Regex Queries

**Current Implementation** (`server/src/controllers/books.ts`, lines 85-94):

Search functionality uses regex for case-insensitive matching:

```javascript
public async searchBooks(query: string): Promise<Book[]> {
    const books = await collections?.books?.find({
        $or: [
            { title: { $regex: new RegExp(query, 'i') } },
            { 'authors.name': { $regex: new RegExp(query, 'i') } },
        ]
    }).limit(25).toArray();
    return books;
}
```

### 2.4 Polymorphic Collection Pattern

**Current Implementation** (`server/src/controllers/issue-details.ts`):

The `issueDetails` collection stores both reservations and borrowed books, discriminated by `recordType`:

```javascript
const filter = {
    recordType: (type === IssueDetailType.BorrowedBook) ? 'borrowedBook' : 'reservation',
};
```

User-specific queries use regex on the composite key:

```javascript
const filter = {
    '_id': new RegExp(`^${userId}${type}`)
};
```

### 2.5 Inventory Synchronization Logic

**Current Implementation** (`server/src/controllers/issue-details.ts`, lines 215-223):

When borrowing a book, the system checks if a reservation exists to avoid double-decrementing inventory:

```javascript
// Delete matching reservation if one then re-compute computed fields
const reservationId = this.getReservationId(bookId, userId);
const deleteResult = await collections?.issueDetails?.deleteOne({ _id: reservationId });

const borrowReplacesReservation = deleteResult.deletedCount === 1;
const borrowIsRenewal = upsertResult.modifiedCount === 1;
if (!borrowReplacesReservation && !borrowIsRenewal) {
    await bookController.decrementBookInventory(book._id);
}
```

---

## 3. Postgres ERD Design

### 3.1 Entity-Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                         │
│  ┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐        │
│  │      users       │         │   book_authors   │         │     authors      │        │
│  ├──────────────────┤         ├──────────────────┤         ├──────────────────┤        │
│  │ id (UUID) PK     │         │ book_isbn FK     │◄───────►│ id (UUID) PK     │        │
│  │ name VARCHAR(255)│         │ author_id FK     │         │ name VARCHAR(255)│        │
│  │ is_admin BOOLEAN │         │ PRIMARY KEY      │         │ sanitized_name   │        │
│  │ created_at       │         │ (book_isbn,      │         │ bio TEXT         │        │
│  │ updated_at       │         │  author_id)      │         │ created_at       │        │
│  └────────┬─────────┘         └──────────────────┘         │ updated_at       │        │
│           │                            ▲                   └──────────────────┘        │
│           │                            │                                               │
│           │                   ┌────────┴─────────┐                                     │
│           │                   │                  │                                     │
│           │         ┌─────────┴──────────┐       │                                     │
│           │         │       books        │       │                                     │
│           │         ├────────────────────┤       │                                     │
│           │         │ isbn VARCHAR(13) PK│───────┘                                     │
│           │         │ title VARCHAR(500) │                                             │
│           │         │ year INTEGER       │                                             │
│           │         │ cover_url TEXT     │                                             │
│           │         │ pages INTEGER      │                                             │
│           │         │ synopsis TEXT      │                                             │
│           │         │ publisher          │                                             │
│           │         │ long_title         │                                             │
│           │         │ language           │                                             │
│           │         │ binding            │                                             │
│           │         │ total_inventory INT│                                             │
│           │         │ book_of_the_month  │                                             │
│           │         │ created_at         │                                             │
│           │         │ updated_at         │                                             │
│           │         └─────────┬──────────┘                                             │
│           │                   │                                                        │
│           │         ┌─────────┼─────────┬─────────────────┐                            │
│           │         │         │         │                 │                            │
│           │         ▼         ▼         ▼                 ▼                            │
│           │  ┌────────────┐ ┌────────────┐ ┌────────────────┐ ┌──────────────────┐     │
│           │  │book_genres │ │book_attrs  │ │    reviews     │ │  author_aliases  │     │
│           │  ├────────────┤ ├────────────┤ ├────────────────┤ ├──────────────────┤     │
│           │  │id (UUID) PK│ │id (UUID) PK│ │ id (UUID) PK   │ │ id (UUID) PK     │     │
│           │  │book_isbn FK│ │book_isbn FK│ │ book_isbn FK   │ │ author_id FK     │     │
│           │  │genre       │ │key VARCHAR │ │ user_id FK     │◄┤ alias VARCHAR    │     │
│           │  └────────────┘ │value       │ │ text TEXT      │ └──────────────────┘     │
│           │                 └────────────┘ │ rating INTEGER │                          │
│           │                                │ reviewer_name  │                          │
│           │                                │ created_at     │                          │
│           │                                └────────────────┘                          │
│           │                                        ▲                                   │
│           │                                        │                                   │
│           │                                        │                                   │
│           ▼                                        │                                   │
│  ┌──────────────────┐                              │                                   │
│  │   reservations   │                              │                                   │
│  ├──────────────────┤                              │                                   │
│  │ id (UUID) PK     │                              │                                   │
│  │ user_id FK       │──────────────────────────────┘                                   │
│  │ book_isbn FK     │                                                                  │
│  │ expiration_date  │                                                                  │
│  │ created_at       │                                                                  │
│  │ UNIQUE(user_id,  │                                                                  │
│  │        book_isbn)│                                                                  │
│  └──────────────────┘                                                                  │
│                                                                                        │
│  ┌──────────────────┐                                                                  │
│  │  borrowed_books  │                                                                  │
│  ├──────────────────┤                                                                  │
│  │ id (UUID) PK     │                                                                  │
│  │ user_id FK       │                                                                  │
│  │ book_isbn FK     │                                                                  │
│  │ borrow_date      │                                                                  │
│  │ due_date         │                                                                  │
│  │ returned_date    │                                                                  │
│  │ returned BOOLEAN │                                                                  │
│  │ created_at       │                                                                  │
│  │ updated_at       │                                                                  │
│  │ UNIQUE(user_id,  │                                                                  │
│  │   book_isbn) WHERE│                                                                 │
│  │   returned=false │                                                                  │
│  └──────────────────┘                                                                  │
│                                                                                        │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Table Definitions

#### 3.2.1 users

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    is_admin BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT users_name_min_length CHECK (char_length(name) >= 5)
);

CREATE INDEX idx_users_name ON users(name);
CREATE INDEX idx_users_is_admin ON users(is_admin);
```

#### 3.2.2 authors

```sql
CREATE TABLE authors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    sanitized_name VARCHAR(255) NOT NULL,
    bio TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_authors_sanitized_name ON authors(sanitized_name);
CREATE INDEX idx_authors_name ON authors(name);
```

#### 3.2.3 author_aliases

```sql
CREATE TABLE author_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id UUID NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
    alias VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_author_aliases_author_id ON author_aliases(author_id);
CREATE INDEX idx_author_aliases_alias ON author_aliases(alias);
```

#### 3.2.4 books

```sql
CREATE TABLE books (
    isbn VARCHAR(13) PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    year INTEGER,
    cover_url TEXT,
    pages INTEGER,
    synopsis TEXT,
    publisher VARCHAR(255),
    long_title VARCHAR(500),
    language VARCHAR(50),
    binding VARCHAR(50),
    total_inventory INTEGER NOT NULL DEFAULT 0,
    book_of_the_month BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT books_total_inventory_non_negative CHECK (total_inventory >= 0)
);

CREATE INDEX idx_books_title ON books(title);
CREATE INDEX idx_books_year ON books(year);
CREATE INDEX idx_books_title_trgm ON books USING gin(title gin_trgm_ops);
```

#### 3.2.5 book_authors (Junction Table)

```sql
CREATE TABLE book_authors (
    book_isbn VARCHAR(13) NOT NULL REFERENCES books(isbn) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (book_isbn, author_id)
);

CREATE INDEX idx_book_authors_author_id ON book_authors(author_id);
CREATE INDEX idx_book_authors_book_isbn ON book_authors(book_isbn);
```

#### 3.2.6 book_genres

```sql
CREATE TABLE book_genres (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_isbn VARCHAR(13) NOT NULL REFERENCES books(isbn) ON DELETE CASCADE,
    genre VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE (book_isbn, genre)
);

CREATE INDEX idx_book_genres_book_isbn ON book_genres(book_isbn);
CREATE INDEX idx_book_genres_genre ON book_genres(genre);
```

#### 3.2.7 book_attributes

```sql
CREATE TABLE book_attributes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_isbn VARCHAR(13) NOT NULL REFERENCES books(isbn) ON DELETE CASCADE,
    key VARCHAR(100) NOT NULL,
    value TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE (book_isbn, key)
);

CREATE INDEX idx_book_attributes_book_isbn ON book_attributes(book_isbn);
CREATE INDEX idx_book_attributes_key ON book_attributes(key);
```

#### 3.2.8 reviews

```sql
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_isbn VARCHAR(13) NOT NULL REFERENCES books(isbn) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    text TEXT NOT NULL,
    reviewer_name VARCHAR(255) NOT NULL,
    rating INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT reviews_rating_range CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5))
);

CREATE INDEX idx_reviews_book_isbn ON reviews(book_isbn);
CREATE INDEX idx_reviews_user_id ON reviews(user_id);
CREATE INDEX idx_reviews_rating ON reviews(rating);
CREATE INDEX idx_reviews_created_at ON reviews(created_at DESC);
```

#### 3.2.9 reservations

```sql
CREATE TABLE reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    book_isbn VARCHAR(13) NOT NULL REFERENCES books(isbn) ON DELETE CASCADE,
    expiration_date TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE (user_id, book_isbn)
);

CREATE INDEX idx_reservations_user_id ON reservations(user_id);
CREATE INDEX idx_reservations_book_isbn ON reservations(book_isbn);
CREATE INDEX idx_reservations_expiration_date ON reservations(expiration_date);
```

#### 3.2.10 borrowed_books

```sql
CREATE TABLE borrowed_books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    book_isbn VARCHAR(13) NOT NULL REFERENCES books(isbn) ON DELETE CASCADE,
    borrow_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    due_date TIMESTAMPTZ NOT NULL,
    returned_date TIMESTAMPTZ,
    returned BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_borrowed_books_user_id ON borrowed_books(user_id);
CREATE INDEX idx_borrowed_books_book_isbn ON borrowed_books(book_isbn);
CREATE INDEX idx_borrowed_books_returned ON borrowed_books(returned);
CREATE INDEX idx_borrowed_books_due_date ON borrowed_books(due_date);

-- Partial unique index: only one active borrow per user-book combination
CREATE UNIQUE INDEX idx_borrowed_books_active_unique 
    ON borrowed_books(user_id, book_isbn) 
    WHERE returned = false;
```

### 3.3 Views for Computed Fields

#### 3.3.1 books_with_availability

```sql
CREATE OR REPLACE VIEW books_with_availability AS
SELECT 
    b.*,
    b.total_inventory - COALESCE(active_holds.count, 0) AS available
FROM books b
LEFT JOIN (
    SELECT book_isbn, COUNT(*) as count
    FROM (
        SELECT book_isbn FROM reservations
        UNION ALL
        SELECT book_isbn FROM borrowed_books WHERE returned = false
    ) AS holds
    GROUP BY book_isbn
) AS active_holds ON b.isbn = active_holds.book_isbn;
```

#### 3.3.2 books_with_authors

```sql
CREATE OR REPLACE VIEW books_with_authors AS
SELECT 
    b.*,
    COALESCE(
        json_agg(
            json_build_object('id', a.id, 'name', a.name)
            ORDER BY ba.display_order
        ) FILTER (WHERE a.id IS NOT NULL),
        '[]'::json
    ) AS authors
FROM books b
LEFT JOIN book_authors ba ON b.isbn = ba.book_isbn
LEFT JOIN authors a ON ba.author_id = a.id
GROUP BY b.isbn;
```

---

## 4. MongoDB to Postgres Mapping

### 4.1 Collection to Table Mapping

| MongoDB Collection | Postgres Table(s) | Notes |
|-------------------|-------------------|-------|
| `books` | `books`, `book_genres`, `book_attributes` | Normalized arrays to separate tables |
| `books.authors` | `book_authors` (junction) | Many-to-many relationship |
| `books.reviews` | `reviews` | Embedded reviews moved to separate table |
| `authors` | `authors`, `author_aliases` | Aliases normalized to separate table |
| `authors.books` | `book_authors` (junction) | Replaced array with junction table |
| `users` | `users` | Direct mapping with UUID |
| `reviews` | `reviews` | Direct mapping with foreign keys |
| `issueDetails` (reservations) | `reservations` | Split polymorphic collection |
| `issueDetails` (borrowedBooks) | `borrowed_books` | Split polymorphic collection |

### 4.2 Primary Key Conversions

| MongoDB Field | MongoDB Type | Postgres Type | Notes |
|--------------|--------------|---------------|-------|
| `books._id` | String (ISBN) | `VARCHAR(13)` | Keep ISBN as primary key |
| `authors._id` | ObjectId | `UUID` | Convert to UUID |
| `users._id` | ObjectId | `UUID` | Convert to UUID |
| `reviews._id` | ObjectId | `UUID` | Convert to UUID |
| `issueDetails._id` | Composite String | `UUID` + unique constraint | Replace composite key |

### 4.3 MongoDB Pattern Conversions

| MongoDB Pattern | Postgres Solution |
|-----------------|-------------------|
| Computed `available` field | Database view `books_with_availability` |
| Embedded reviews (subset pattern) | Separate `reviews` table with FK |
| Embedded authors (extended reference) | Junction table `book_authors` |
| Array of genres | Separate `book_genres` table |
| Array of attributes | Separate `book_attributes` table |
| Array of aliases | Separate `author_aliases` table |
| Polymorphic `issueDetails` | Split into `reservations` and `borrowed_books` tables |
| Composite string keys | UUID primary keys with unique constraints |
| Regex search | PostgreSQL `ILIKE` or trigram indexes |
| `$inc` atomic operations | Standard SQL `UPDATE ... SET col = col + 1` |

---

## 5. Index Strategy

### 5.1 Primary Key Indexes (Automatic)

All primary keys automatically have unique indexes.

### 5.2 Foreign Key Indexes

| Table | Index | Purpose |
|-------|-------|---------|
| `book_authors` | `idx_book_authors_author_id` | Author lookup |
| `book_authors` | `idx_book_authors_book_isbn` | Book lookup |
| `book_genres` | `idx_book_genres_book_isbn` | Genre lookup by book |
| `book_attributes` | `idx_book_attributes_book_isbn` | Attribute lookup by book |
| `author_aliases` | `idx_author_aliases_author_id` | Alias lookup by author |
| `reviews` | `idx_reviews_book_isbn` | Reviews by book |
| `reviews` | `idx_reviews_user_id` | Reviews by user |
| `reservations` | `idx_reservations_user_id` | User reservations |
| `reservations` | `idx_reservations_book_isbn` | Book reservations |
| `borrowed_books` | `idx_borrowed_books_user_id` | User borrows |
| `borrowed_books` | `idx_borrowed_books_book_isbn` | Book borrows |

### 5.3 Search Indexes

| Table | Index | Type | Purpose |
|-------|-------|------|---------|
| `books` | `idx_books_title_trgm` | GIN (trigram) | Full-text search on title |
| `authors` | `idx_authors_name` | B-tree | Author name lookup |
| `author_aliases` | `idx_author_aliases_alias` | B-tree | Alias search |

### 5.4 Query Optimization Indexes

| Table | Index | Purpose |
|-------|-------|---------|
| `books` | `idx_books_year` | Filter by publication year |
| `reviews` | `idx_reviews_rating` | Filter by rating |
| `reviews` | `idx_reviews_created_at` | Sort by date |
| `reservations` | `idx_reservations_expiration_date` | Expiration cleanup |
| `borrowed_books` | `idx_borrowed_books_returned` | Active borrows filter |
| `borrowed_books` | `idx_borrowed_books_due_date` | Overdue detection |

### 5.5 Partial/Conditional Indexes

| Table | Index | Condition | Purpose |
|-------|-------|-----------|---------|
| `borrowed_books` | `idx_borrowed_books_active_unique` | `WHERE returned = false` | Ensure one active borrow per user-book |

---

## 6. Business Logic Changes

### 6.1 Computed Availability

**MongoDB Approach**: Aggregation pipeline computes `available` at query time.

**Postgres Approach**: Use the `books_with_availability` view for queries that need availability. For high-performance scenarios, consider:

Option A: **Database View** (Recommended for simplicity)
```sql
SELECT * FROM books_with_availability WHERE isbn = '9780743273565';
```

Option B: **Trigger-Maintained Column** (For performance)
```sql
-- Add available column to books table
ALTER TABLE books ADD COLUMN available INTEGER;

-- Create trigger function
CREATE OR REPLACE FUNCTION update_book_availability()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE books 
    SET available = total_inventory - (
        SELECT COUNT(*) FROM (
            SELECT book_isbn FROM reservations WHERE book_isbn = NEW.book_isbn
            UNION ALL
            SELECT book_isbn FROM borrowed_books WHERE book_isbn = NEW.book_isbn AND returned = false
        ) AS holds
    )
    WHERE isbn = NEW.book_isbn;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers on reservations and borrowed_books
CREATE TRIGGER trg_reservation_availability
    AFTER INSERT OR DELETE ON reservations
    FOR EACH ROW EXECUTE FUNCTION update_book_availability();

CREATE TRIGGER trg_borrow_availability
    AFTER INSERT OR UPDATE OF returned ON borrowed_books
    FOR EACH ROW EXECUTE FUNCTION update_book_availability();
```

### 6.2 Search Functionality

**MongoDB Approach**: Regex queries with `$regex` operator.

**Postgres Approach**: Use `ILIKE` for simple searches or trigram indexes for fuzzy matching:

```sql
-- Enable trigram extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Simple search
SELECT * FROM books WHERE title ILIKE '%gatsby%';

-- Fuzzy search with trigram similarity
SELECT *, similarity(title, 'gatsby') AS sim
FROM books
WHERE title % 'gatsby'
ORDER BY sim DESC;

-- Search with author name (using view)
SELECT DISTINCT b.*
FROM books_with_authors b
WHERE b.title ILIKE '%query%'
   OR EXISTS (
       SELECT 1 FROM json_array_elements(b.authors) AS author
       WHERE author->>'name' ILIKE '%query%'
   );
```

### 6.3 Reservation Expiration

**MongoDB Approach**: TTL index on `expirationDate` for automatic deletion.

**Postgres Approach**: Use Supabase Edge Functions or pg_cron for scheduled cleanup:

```sql
-- Option 1: pg_cron job (if available)
SELECT cron.schedule('cleanup-expired-reservations', '*/5 * * * *', $$
    DELETE FROM reservations WHERE expiration_date < NOW();
$$);

-- Option 2: Application-level cleanup
DELETE FROM reservations WHERE expiration_date < NOW();
```

### 6.4 Inventory Synchronization

**MongoDB Approach**: `$inc` operator for atomic updates.

**Postgres Approach**: Standard SQL with transaction isolation:

```sql
-- Atomic increment (in a transaction)
BEGIN;
UPDATE books SET total_inventory = total_inventory + 1 WHERE isbn = '9780743273565';
COMMIT;

-- Or use the view for availability (no direct update needed)
```

### 6.5 User-Book Queries

**MongoDB Approach**: Regex on composite key `^${userId}R` or `^${userId}B`.

**Postgres Approach**: Direct foreign key queries:

```sql
-- Get user's reservations
SELECT r.*, b.title, b.isbn
FROM reservations r
JOIN books b ON r.book_isbn = b.isbn
WHERE r.user_id = 'user-uuid-here';

-- Get user's active borrows
SELECT bb.*, b.title, b.isbn
FROM borrowed_books bb
JOIN books b ON bb.book_isbn = b.isbn
WHERE bb.user_id = 'user-uuid-here' AND bb.returned = false;

-- Get user's borrow history
SELECT bb.*, b.title, b.isbn
FROM borrowed_books bb
JOIN books b ON bb.book_isbn = b.isbn
WHERE bb.user_id = 'user-uuid-here' AND bb.returned = true;
```

---

## 7. Data Migration Considerations

### 7.1 ObjectId to UUID Mapping

Create a mapping table during migration to preserve relationships:

```sql
CREATE TABLE migration_id_mapping (
    collection_name VARCHAR(50) NOT NULL,
    mongo_object_id VARCHAR(24) NOT NULL,
    postgres_uuid UUID NOT NULL,
    PRIMARY KEY (collection_name, mongo_object_id)
);
```

### 7.2 Migration Order

1. **users** - No dependencies
2. **authors** - No dependencies
3. **author_aliases** - Depends on authors
4. **books** - No dependencies
5. **book_authors** - Depends on books and authors
6. **book_genres** - Depends on books
7. **book_attributes** - Depends on books
8. **reviews** - Depends on books and users
9. **reservations** - Depends on books and users
10. **borrowed_books** - Depends on books and users

### 7.3 Embedded Data Extraction

For embedded reviews in books (subset pattern), extract and insert into the reviews table:

```javascript
// Pseudo-code for migration script
for (const book of mongoBooks) {
    if (book.reviews && book.reviews.length > 0) {
        for (const review of book.reviews) {
            await insertReview({
                book_isbn: book._id,
                text: review.text,
                reviewer_name: review.name,
                rating: review.rating,
                created_at: new Date(review.timestamp)
            });
        }
    }
}
```

---

## 8. Supabase-Specific Features

### 8.1 Row Level Security (RLS)

```sql
-- Enable RLS on tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE borrowed_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users can view own profile"
    ON users FOR SELECT
    USING (auth.uid() = id);

-- Users can only manage their own reservations
CREATE POLICY "Users can manage own reservations"
    ON reservations FOR ALL
    USING (auth.uid() = user_id);

-- Admins can see all data
CREATE POLICY "Admins can view all users"
    ON users FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true
        )
    );
```

### 8.2 Real-time Subscriptions

Supabase provides real-time capabilities out of the box:

```javascript
// Subscribe to reservation changes
const subscription = supabase
    .channel('reservations')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, 
        (payload) => console.log('Reservation changed:', payload))
    .subscribe();
```

### 8.3 Edge Functions for TTL

Replace MongoDB TTL indexes with Supabase Edge Functions:

```typescript
// supabase/functions/cleanup-expired-reservations/index.ts
import { createClient } from '@supabase/supabase-js';

Deno.serve(async () => {
    const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    const { error } = await supabase
        .from('reservations')
        .delete()
        .lt('expiration_date', new Date().toISOString());
    
    return new Response(JSON.stringify({ success: !error }));
});
```

---

## 9. Summary

This migration plan provides a comprehensive roadmap for converting the Library Management System from MongoDB to Supabase/Postgres. Key transformations include:

1. **Normalization**: Embedded arrays (genres, attributes, reviews, aliases) are extracted to separate tables with proper foreign key relationships.

2. **Polymorphic Split**: The single `issueDetails` collection is split into `reservations` and `borrowed_books` tables for clearer data modeling.

3. **Computed Fields**: The `available` field is handled via a database view that calculates availability in real-time.

4. **Search**: MongoDB regex queries are replaced with PostgreSQL `ILIKE` and trigram indexes for efficient text search.

5. **Composite Keys**: The composite string keys (`userId + type + bookId`) are replaced with UUID primary keys and unique constraints.

6. **Junction Tables**: Many-to-many relationships (books-authors) use proper junction tables instead of embedded arrays.

The next phases will cover:
- **Phase 2**: Database schema creation and Supabase setup
- **Phase 3**: Data migration scripts
- **Phase 4**: Application code updates
- **Phase 5**: Testing and validation
