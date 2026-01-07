-- Phase 1: PostgreSQL Schema for Library Management System
-- Migration from MongoDB to PostgreSQL
-- Generated: 2026-01-07

-- =============================================================================
-- EXTENSIONS
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- DROP EXISTING TABLES (for clean migration)
-- =============================================================================
DROP TABLE IF EXISTS migration_id_mapping CASCADE;
DROP TABLE IF EXISTS borrowed_books CASCADE;
DROP TABLE IF EXISTS reservations CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS book_attributes CASCADE;
DROP TABLE IF EXISTS book_authors CASCADE;
DROP TABLE IF EXISTS books CASCADE;
DROP TABLE IF EXISTS authors CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- =============================================================================
-- USERS TABLE
-- =============================================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT users_name_min_length CHECK (LENGTH(name) >= 5),
    CONSTRAINT users_name_unique UNIQUE (name)
);

-- Indexes
CREATE INDEX idx_users_name ON users(name);
CREATE INDEX idx_users_is_admin ON users(is_admin);

COMMENT ON TABLE users IS 'Library users with admin privileges. Migrated from MongoDB users collection.';
COMMENT ON COLUMN users.name IS 'User name, minimum 5 characters required';
COMMENT ON COLUMN users.is_admin IS 'Whether user has admin privileges';

-- =============================================================================
-- AUTHORS TABLE
-- =============================================================================
CREATE TABLE authors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    sanitized_name VARCHAR(255) NOT NULL,
    aliases TEXT[] DEFAULT '{}',
    bio TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT authors_sanitized_name_unique UNIQUE (sanitized_name)
);

-- Indexes
CREATE INDEX idx_authors_name ON authors(name);
CREATE INDEX idx_authors_sanitized_name ON authors(sanitized_name);

COMMENT ON TABLE authors IS 'Author information. Migrated from MongoDB authors collection.';
COMMENT ON COLUMN authors.sanitized_name IS 'URL-friendly version of author name';
COMMENT ON COLUMN authors.aliases IS 'Alternative names for the author';

-- =============================================================================
-- BOOKS TABLE
-- =============================================================================
CREATE TABLE books (
    isbn VARCHAR(20) PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    year INTEGER,
    cover VARCHAR(500),
    genres VARCHAR(100)[] DEFAULT '{}',
    pages INTEGER,
    synopsis TEXT,
    publisher VARCHAR(255),
    long_title VARCHAR(500),
    language VARCHAR(50),
    binding VARCHAR(50),
    total_inventory INTEGER NOT NULL DEFAULT 0,
    book_of_the_month BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT books_total_inventory_non_negative CHECK (total_inventory >= 0),
    CONSTRAINT books_pages_positive CHECK (pages IS NULL OR pages > 0),
    CONSTRAINT books_year_reasonable CHECK (year IS NULL OR (year > 0 AND year <= EXTRACT(YEAR FROM CURRENT_DATE) + 1))
);

-- Indexes
CREATE INDEX idx_books_title ON books(title);
CREATE INDEX idx_books_year ON books(year);
CREATE INDEX idx_books_publisher ON books(publisher);

COMMENT ON TABLE books IS 'Book catalog. Uses ISBN as natural primary key. Migrated from MongoDB books collection.';
COMMENT ON COLUMN books.isbn IS 'International Standard Book Number - natural primary key';
COMMENT ON COLUMN books.total_inventory IS 'Total number of copies in library inventory';
COMMENT ON COLUMN books.cover IS 'URL to book cover image';

-- =============================================================================
-- BOOK_AUTHORS JUNCTION TABLE
-- =============================================================================
CREATE TABLE book_authors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_isbn VARCHAR(20) NOT NULL,
    author_id UUID NOT NULL,
    display_order INTEGER DEFAULT 0,
    
    -- Foreign Keys
    CONSTRAINT fk_book_authors_book FOREIGN KEY (book_isbn) 
        REFERENCES books(isbn) ON DELETE CASCADE,
    CONSTRAINT fk_book_authors_author FOREIGN KEY (author_id) 
        REFERENCES authors(id) ON DELETE CASCADE,
    
    -- Constraints
    CONSTRAINT book_authors_unique UNIQUE (book_isbn, author_id)
);

-- Indexes
CREATE INDEX idx_book_authors_book ON book_authors(book_isbn);
CREATE INDEX idx_book_authors_author ON book_authors(author_id);

COMMENT ON TABLE book_authors IS 'Junction table for many-to-many book-author relationship. Replaces embedded authors in MongoDB.';
COMMENT ON COLUMN book_authors.display_order IS 'Order for displaying multiple authors (0 = primary author)';

-- =============================================================================
-- BOOK_ATTRIBUTES TABLE
-- =============================================================================
CREATE TABLE book_attributes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_isbn VARCHAR(20) NOT NULL,
    key VARCHAR(100) NOT NULL,
    value VARCHAR(500) NOT NULL,
    
    -- Foreign Keys
    CONSTRAINT fk_book_attributes_book FOREIGN KEY (book_isbn) 
        REFERENCES books(isbn) ON DELETE CASCADE,
    
    -- Constraints
    CONSTRAINT book_attributes_unique UNIQUE (book_isbn, key)
);

-- Indexes
CREATE INDEX idx_book_attributes_book ON book_attributes(book_isbn);
CREATE INDEX idx_book_attributes_key ON book_attributes(key);

COMMENT ON TABLE book_attributes IS 'Flexible key-value attributes for books. Implements attribute pattern from MongoDB.';

-- =============================================================================
-- REVIEWS TABLE
-- =============================================================================
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_isbn VARCHAR(20) NOT NULL,
    user_id UUID,
    text TEXT NOT NULL,
    reviewer_name VARCHAR(255) NOT NULL,
    rating INTEGER,
    timestamp BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    CONSTRAINT fk_reviews_book FOREIGN KEY (book_isbn) 
        REFERENCES books(isbn) ON DELETE CASCADE,
    CONSTRAINT fk_reviews_user FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE SET NULL,
    
    -- Constraints
    CONSTRAINT reviews_rating_range CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5))
);

-- Indexes
CREATE INDEX idx_reviews_book ON reviews(book_isbn);
CREATE INDEX idx_reviews_user ON reviews(user_id);
CREATE INDEX idx_reviews_rating ON reviews(rating);
CREATE INDEX idx_reviews_timestamp ON reviews(timestamp DESC);

COMMENT ON TABLE reviews IS 'Book reviews. Normalized from embedded reviews in MongoDB books collection.';
COMMENT ON COLUMN reviews.reviewer_name IS 'Denormalized reviewer name for display purposes';
COMMENT ON COLUMN reviews.timestamp IS 'Unix timestamp in milliseconds';
COMMENT ON COLUMN reviews.user_id IS 'Nullable - user may be deleted but review preserved';

-- =============================================================================
-- RESERVATIONS TABLE
-- =============================================================================
CREATE TABLE reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_isbn VARCHAR(20) NOT NULL,
    user_id UUID NOT NULL,
    expiration_date TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    CONSTRAINT fk_reservations_book FOREIGN KEY (book_isbn) 
        REFERENCES books(isbn) ON DELETE CASCADE,
    CONSTRAINT fk_reservations_user FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE CASCADE,
    
    -- Constraints
    CONSTRAINT reservations_unique_active UNIQUE (book_isbn, user_id)
);

-- Indexes
CREATE INDEX idx_reservations_book ON reservations(book_isbn);
CREATE INDEX idx_reservations_user ON reservations(user_id);
CREATE INDEX idx_reservations_expiration ON reservations(expiration_date);

COMMENT ON TABLE reservations IS 'Book reservations. Split from polymorphic MongoDB issueDetails collection (recordType=reservation).';
COMMENT ON COLUMN reservations.expiration_date IS 'Reservation expires after 12 hours (0.5 days)';

-- =============================================================================
-- BORROWED_BOOKS TABLE
-- =============================================================================
CREATE TABLE borrowed_books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_isbn VARCHAR(20) NOT NULL,
    user_id UUID NOT NULL,
    borrow_date TIMESTAMP WITH TIME ZONE NOT NULL,
    due_date TIMESTAMP WITH TIME ZONE NOT NULL,
    returned_date TIMESTAMP WITH TIME ZONE,
    returned BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    CONSTRAINT fk_borrowed_books_book FOREIGN KEY (book_isbn) 
        REFERENCES books(isbn) ON DELETE CASCADE,
    CONSTRAINT fk_borrowed_books_user FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE CASCADE,
    
    -- Constraints
    CONSTRAINT borrowed_books_dates_valid CHECK (due_date > borrow_date),
    CONSTRAINT borrowed_books_returned_consistency CHECK (
        (returned = FALSE AND returned_date IS NULL) OR
        (returned = TRUE AND returned_date IS NOT NULL)
    )
);

-- Indexes
CREATE INDEX idx_borrowed_books_book ON borrowed_books(book_isbn);
CREATE INDEX idx_borrowed_books_user ON borrowed_books(user_id);
CREATE INDEX idx_borrowed_books_returned ON borrowed_books(returned);
CREATE INDEX idx_borrowed_books_due_date ON borrowed_books(due_date);
CREATE INDEX idx_borrowed_books_active ON borrowed_books(book_isbn, user_id) WHERE returned = FALSE;

COMMENT ON TABLE borrowed_books IS 'Borrowed book records. Split from polymorphic MongoDB issueDetails collection (recordType=borrowedBook).';
COMMENT ON COLUMN borrowed_books.due_date IS 'Default 21 days from borrow_date';
COMMENT ON COLUMN borrowed_books.returned_date IS 'Set when book is returned';

-- =============================================================================
-- MIGRATION ID MAPPING TABLE (Temporary)
-- =============================================================================
CREATE TABLE migration_id_mapping (
    id SERIAL PRIMARY KEY,
    collection_name VARCHAR(50) NOT NULL,
    mongo_id VARCHAR(50) NOT NULL,
    postgres_id UUID NOT NULL,
    migrated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT migration_id_mapping_unique UNIQUE (collection_name, mongo_id)
);

-- Indexes
CREATE INDEX idx_migration_mapping_mongo ON migration_id_mapping(collection_name, mongo_id);
CREATE INDEX idx_migration_mapping_postgres ON migration_id_mapping(postgres_id);

COMMENT ON TABLE migration_id_mapping IS 'Temporary table for tracking MongoDB ObjectId to PostgreSQL UUID mappings during migration.';

-- =============================================================================
-- VIEW: BOOKS WITH AVAILABILITY
-- =============================================================================
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

COMMENT ON VIEW books_with_availability IS 'Books with computed available field. Replaces MongoDB computed pattern.';

-- =============================================================================
-- TRIGGER: UPDATE TIMESTAMPS
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_authors_updated_at
    BEFORE UPDATE ON authors
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_books_updated_at
    BEFORE UPDATE ON books
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_borrowed_books_updated_at
    BEFORE UPDATE ON borrowed_books
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- OPTIONAL: TRIGGER-MAINTAINED AVAILABLE COLUMN
-- Uncomment if view performance is insufficient
-- =============================================================================
/*
ALTER TABLE books ADD COLUMN available INTEGER NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION update_book_availability()
RETURNS TRIGGER AS $$
DECLARE
    target_isbn VARCHAR(20);
BEGIN
    -- Determine which book to update
    IF TG_OP = 'DELETE' THEN
        target_isbn := OLD.book_isbn;
    ELSE
        target_isbn := NEW.book_isbn;
    END IF;
    
    -- Update the available count
    UPDATE books SET available = (
        total_inventory - (
            SELECT COUNT(*) FROM reservations WHERE book_isbn = target_isbn
        ) - (
            SELECT COUNT(*) FROM borrowed_books WHERE book_isbn = target_isbn AND returned = FALSE
        )
    ) WHERE isbn = target_isbn;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reservation_insert_availability
    AFTER INSERT ON reservations
    FOR EACH ROW EXECUTE FUNCTION update_book_availability();

CREATE TRIGGER trg_reservation_delete_availability
    AFTER DELETE ON reservations
    FOR EACH ROW EXECUTE FUNCTION update_book_availability();

CREATE TRIGGER trg_borrowed_insert_availability
    AFTER INSERT ON borrowed_books
    FOR EACH ROW EXECUTE FUNCTION update_book_availability();

CREATE TRIGGER trg_borrowed_update_availability
    AFTER UPDATE OF returned ON borrowed_books
    FOR EACH ROW EXECUTE FUNCTION update_book_availability();
*/
