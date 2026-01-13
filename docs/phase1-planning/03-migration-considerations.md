# Migration Considerations and Challenges

This document outlines the key considerations, challenges, and recommendations for migrating the Library Management System from MongoDB to PostgreSQL/Supabase.

## Executive Summary

The migration involves converting 5 MongoDB collections into 10 PostgreSQL tables, transforming document-based patterns into normalized relational structures. Key challenges include handling the polymorphic `issueDetails` collection, managing computed fields, and maintaining data integrity during the transition.

## Data Migration Challenges

### 1. Primary Key Transformation

**Challenge**: MongoDB uses different primary key strategies across collections.

| Collection | MongoDB Key | PostgreSQL Key | Migration Strategy |
|------------|-------------|----------------|-------------------|
| books | String (ISBN) | VARCHAR(13) | Direct mapping |
| users | ObjectId | UUID | Generate new UUID, store ObjectId in `mongo_id` |
| authors | ObjectId | UUID | Generate new UUID, store ObjectId in `mongo_id` |
| reviews | ObjectId | UUID | Generate new UUID, store ObjectId in `mongo_id` |
| issueDetails | Composite string | UUID | Parse composite key, generate new UUID |

**Recommendation**: Create a migration mapping table to track old MongoDB IDs to new PostgreSQL UUIDs for reference integrity during and after migration.

### 2. Composite String Key Decomposition

**Challenge**: The `issueDetails` collection uses composite string keys in format `userId + type + bookId` (e.g., `695c0a4a1f15c05b869c3c30R9780743273565`).

**Migration Steps**:
1. Parse the composite key to extract:
   - `userId`: First 24 characters (MongoDB ObjectId)
   - `type`: Character at position 24 (`R` for reservation, `B` for borrowed)
   - `bookId`: Remaining characters (ISBN)
2. Look up the new UUID for the user from the migration mapping table
3. Create a new record in either `reservations` or `borrowed_books` table based on type

**Code Example**:
```javascript
function parseIssueDetailId(compositeId) {
    const userId = compositeId.substring(0, 24);
    const type = compositeId.charAt(24);
    const bookId = compositeId.substring(25);
    return { userId, type, bookId };
}
```

### 3. Polymorphic Collection Split

**Challenge**: The `issueDetails` collection stores two different record types (reservations and borrowed books) in a single collection using a `recordType` discriminator.

**Migration Approach**:
- Split into two separate tables: `reservations` and `borrowed_books`
- Filter by `recordType` during migration
- Map type-specific fields to appropriate table columns

**Field Mapping**:

| issueDetails Field | reservations | borrowed_books |
|-------------------|--------------|----------------|
| _id | (parsed) | (parsed) |
| recordType | (used for routing) | (used for routing) |
| book._id | book_isbn | book_isbn |
| user._id | user_id (mapped) | user_id (mapped) |
| expirationDate | expiration_date | - |
| borrowDate | - | borrow_date |
| dueDate | - | due_date |
| returnedDate | - | returned_date |
| returned | - | returned |

### 4. Embedded Document Extraction

**Challenge**: MongoDB documents contain embedded arrays that need to be normalized into separate tables.

**Embedded Arrays to Normalize**:

| Source | Embedded Array | Target Table | Notes |
|--------|---------------|--------------|-------|
| books | authors[] | book_authors | Junction table for M:N relationship |
| books | reviews[] | reviews | Merge with reviews collection |
| books | attributes[] | book_attributes | Key-value pairs |
| books | genres[] | book_genres | Simple array normalization |
| authors | aliases[] | author_aliases | Simple array normalization |
| authors | books[] | book_authors | Redundant with books.authors[] |

**Deduplication Concern**: Reviews are stored both embedded in books (subset pattern) and in the reviews collection. During migration:
1. Use the reviews collection as the source of truth
2. Verify embedded reviews match collection reviews by `_id`
3. Report any discrepancies for manual review

### 5. Computed Field Migration

**Challenge**: The `available` field in books is computed at query time using aggregation pipelines.

**Current MongoDB Implementation** (lines 42-76 in `books.ts`):
```javascript
available = totalInventory - count(active_reservations + active_borrows)
```

**PostgreSQL Options**:

| Option | Pros | Cons |
|--------|------|------|
| Database View | Always accurate, no maintenance | Slight query overhead |
| Trigger-maintained column | Fast reads | Complexity, potential race conditions |
| Application-level computation | Flexible | Inconsistent if bypassed |

**Recommendation**: Use a database view (`books_with_availability`) for initial migration, with option to add trigger-maintained column later if performance requires.

## Application Code Changes

### 1. Query Pattern Migrations

**Regex-based User Queries**:
```javascript
// MongoDB
db.issueDetails.find({ _id: /^userId/ })

// PostgreSQL
SELECT * FROM reservations WHERE user_id = $1
UNION ALL
SELECT * FROM borrowed_books WHERE user_id = $1 AND returned = FALSE
```

**Aggregation Pipeline to SQL**:
```javascript
// MongoDB aggregation for book availability
db.books.aggregate([
  { $match: { _id: bookId } },
  { $lookup: { from: 'issueDetails', ... } },
  { $set: { available: { $subtract: [...] } } }
])

// PostgreSQL
SELECT * FROM books_with_availability WHERE isbn = $1
```

### 2. Atomic Operations

**Challenge**: MongoDB's `$inc` operator provides atomic increment operations.

**MongoDB**:
```javascript
db.books.updateOne({ _id: bookId }, { $inc: { available: count } })
```

**PostgreSQL**:
```sql
-- If using trigger approach, just insert/delete reservations/borrows
-- The trigger handles availability updates automatically

-- Or for direct updates:
UPDATE books 
SET available = available + $1, updated_at = NOW() 
WHERE isbn = $2
```

**Recommendation**: Use database triggers to maintain `available` count, ensuring atomicity through PostgreSQL's transaction isolation.

### 3. Driver/ORM Changes

**Current Stack**: MongoDB Node.js driver with TypeScript interfaces

**Migration Options**:
1. **Supabase Client**: Use `@supabase/supabase-js` for direct database access
2. **Prisma ORM**: Type-safe ORM with PostgreSQL support
3. **Drizzle ORM**: Lightweight TypeScript ORM
4. **Raw SQL**: Use `pg` driver with parameterized queries

**Recommendation**: Use Supabase client for consistency with Supabase platform features (Auth, Realtime, Storage).

## Data Integrity Considerations

### 1. Foreign Key Constraints

**New Constraints to Enforce**:
- `book_genres.book_isbn` -> `books.isbn`
- `book_attributes.book_isbn` -> `books.isbn`
- `book_authors.book_isbn` -> `books.isbn`
- `book_authors.author_id` -> `authors.id`
- `author_aliases.author_id` -> `authors.id`
- `reviews.book_isbn` -> `books.isbn`
- `reservations.user_id` -> `users.id`
- `reservations.book_isbn` -> `books.isbn`
- `borrowed_books.user_id` -> `users.id`
- `borrowed_books.book_isbn` -> `books.isbn`

**Migration Order** (to satisfy foreign key constraints):
1. `books` (no dependencies)
2. `users` (no dependencies)
3. `authors` (no dependencies)
4. `book_genres` (depends on books)
5. `book_attributes` (depends on books)
6. `author_aliases` (depends on authors)
7. `book_authors` (depends on books, authors)
8. `reviews` (depends on books)
9. `reservations` (depends on users, books)
10. `borrowed_books` (depends on users, books)

### 2. Data Validation

**Validation Rules to Implement**:
- `users.name`: Minimum 5 characters (CHECK constraint)
- `reviews.rating`: Between 1 and 5 (CHECK constraint)
- `reservations`: Unique (user_id, book_isbn) combination
- `books.isbn`: Valid ISBN format (application-level or CHECK)

### 3. Orphaned Data Handling

**Potential Issues**:
- Reviews referencing non-existent books
- Issue details referencing non-existent users or books
- Author references in books pointing to non-existent authors

**Recommendation**: Run validation queries before migration to identify and resolve orphaned references.

## Performance Considerations

### 1. Index Strategy

**Recommended Indexes** (beyond primary keys):

| Table | Index | Purpose |
|-------|-------|---------|
| books | title | Search by title |
| books | year | Filter by publication year |
| book_authors | author_id | Find books by author |
| reviews | book_isbn | Get reviews for book |
| reviews | timestamp DESC | Recent reviews |
| reservations | user_id | User's reservations |
| reservations | expiration_date | TTL cleanup |
| borrowed_books | user_id, returned | Active borrows by user |
| borrowed_books | due_date | Overdue detection |

### 2. Query Optimization

**Expensive Queries to Optimize**:
1. Book availability calculation (use view or materialized view)
2. User's active borrows and reservations (partial indexes)
3. Book search by title/author (consider full-text search)

### 3. Connection Pooling

**Supabase Considerations**:
- Use connection pooling for serverless deployments
- Configure appropriate pool size for expected load
- Consider using Supabase Edge Functions for API endpoints

## Migration Execution Plan

### Phase 1: Preparation (Current)
- Document current schema
- Design target schema
- Create ERD diagrams
- Identify migration challenges

### Phase 2: Schema Creation
- Create PostgreSQL tables in Supabase
- Set up indexes
- Create views and triggers
- Configure Row Level Security (RLS)

### Phase 3: Data Migration
- Export MongoDB data
- Transform data format
- Load into PostgreSQL
- Validate data integrity

### Phase 4: Application Migration
- Update database connection
- Migrate queries to SQL
- Update API endpoints
- Test functionality

### Phase 5: Cutover
- Final data sync
- Switch traffic to new database
- Monitor for issues
- Decommission MongoDB

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Data loss during migration | High | Low | Full backups, validation scripts |
| Downtime during cutover | Medium | Medium | Blue-green deployment strategy |
| Performance regression | Medium | Medium | Load testing, index optimization |
| Application bugs | High | Medium | Comprehensive testing, staged rollout |
| Foreign key violations | Medium | Low | Pre-migration validation |

## Rollback Strategy

1. **Before Migration**: Full MongoDB backup
2. **During Migration**: Keep MongoDB running in read-only mode
3. **After Migration**: Maintain MongoDB for 30 days as fallback
4. **Rollback Trigger**: Critical bugs or data integrity issues
5. **Rollback Process**: Revert application to MongoDB connection, restore from backup if needed

## Next Steps

1. Review and approve schema design
2. Set up Supabase project
3. Create migration scripts
4. Develop and test application changes
5. Plan cutover timeline
6. Execute migration with monitoring
