# Migration Considerations and Challenges

This document outlines the key considerations, challenges, and recommendations for migrating the Library Management System from MongoDB to PostgreSQL/Supabase.

## Executive Summary

The migration involves converting 5 MongoDB collections into 10 PostgreSQL tables, transforming denormalized document structures into a normalized relational schema. The primary challenges include handling the polymorphic `issueDetails` collection, managing the computed `available` field, and maintaining data integrity during the transition.

## Key Migration Challenges

### 1. Polymorphic Collection Split

**Challenge**: The `issueDetails` collection uses the Single Collection Pattern to store both reservations and borrowed books with different schemas in the same collection.

**Current MongoDB Structure**:
- Single collection with `recordType` discriminator (`'reservation'` or `'borrowedBook'`)
- Composite string key: `userId + type + bookId`
- Different fields per record type (e.g., `expirationDate` for reservations, `borrowDate`/`dueDate`/`returned` for borrows)

**Migration Approach**:
1. Split into two separate tables: `reservations` and `borrowed_books`
2. Replace composite string keys with UUID primary keys
3. Add proper foreign key constraints to `users` and `books` tables
4. Migrate data based on `recordType` field value

**Code Changes Required**:
- Update `server/src/controllers/issue-details.ts` to use separate table queries
- Replace regex-based user queries (`/^userId/`) with proper WHERE clauses
- Update all CRUD operations to target the correct table based on operation type

**Risk Level**: High - This is a fundamental schema change affecting core business logic.

---

### 2. Computed Field Migration

**Challenge**: The `available` field in books is computed at query time using MongoDB aggregation pipelines.

**Current MongoDB Implementation** (from `server/src/controllers/books.ts`):
```javascript
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
    available: {
      $subtract: ['$totalInventory', { $size: '$details' }]
    }
  }
}
```

**Migration Options**:

| Option | Pros | Cons |
|--------|------|------|
| **View-based** | Always accurate, no maintenance | Slower queries, can't index |
| **Trigger-maintained column** | Fast queries, indexable | Complexity, potential sync issues |
| **Application-level calculation** | Simple, no DB changes | Inconsistent if multiple apps access DB |

**Recommended Approach**: Trigger-maintained column with periodic validation job.

**Implementation**:
1. Add `available` column to `books` table
2. Create trigger function to update on `reservations` and `borrowed_books` changes
3. Add validation job to detect and fix any drift

---

### 3. Embedded Documents Extraction

**Challenge**: MongoDB documents contain embedded arrays that need to be normalized into separate tables.

**Affected Patterns**:

| Source | Embedded Data | Target Table |
|--------|---------------|--------------|
| `books.authors[]` | Author references | `book_authors` junction |
| `books.attributes[]` | Key-value pairs | `book_attributes` |
| `books.genres[]` | Genre strings | `book_genres` |
| `books.reviews[]` | Recent reviews | (removed - use `reviews` table) |
| `authors.aliases[]` | Name aliases | `author_aliases` |
| `authors.books[]` | ISBN references | `book_authors` junction |

**Migration Steps**:
1. Extract embedded arrays during data migration
2. Create junction table records for many-to-many relationships
3. Remove embedded data from source documents
4. Update application code to use JOINs instead of embedded access

**Risk Level**: Medium - Requires careful data extraction and code updates.

---

### 4. ID Type Conversion

**Challenge**: MongoDB uses ObjectId (24-character hex string) while PostgreSQL uses UUID.

**Affected Collections**:
- `users._id`: ObjectId -> UUID
- `authors._id`: ObjectId -> UUID
- `reviews._id`: ObjectId -> UUID
- `issueDetails.user._id`: ObjectId reference -> UUID foreign key
- `books.authors[]._id`: ObjectId reference -> UUID foreign key

**Note**: `books._id` (ISBN) remains as VARCHAR(13) - no conversion needed.

**Migration Strategy**:
1. Create ID mapping table during migration
2. Generate new UUIDs for each MongoDB ObjectId
3. Update all foreign key references using the mapping
4. Validate referential integrity after migration

**Code Changes**:
- Update TypeScript interfaces to use `string` (UUID format) instead of `ObjectId`
- Update all ID generation to use `gen_random_uuid()` or application-level UUID generation
- Update all ID comparisons and queries

---

### 5. Extended Reference Pattern Removal

**Challenge**: MongoDB uses the Extended Reference Pattern to embed frequently-accessed fields from related documents to avoid joins.

**Current Embedded References**:
- `books.authors[].name` - Author name embedded in book
- `issueDetails.book.title` - Book title embedded in issue detail
- `issueDetails.user.name` - User name embedded in issue detail

**Migration Impact**:
- These denormalized fields will be removed
- Application must JOIN to get related data
- Potential performance impact on read-heavy operations

**Mitigation Strategies**:
1. Create database views that pre-join common data
2. Use Supabase's real-time subscriptions for caching
3. Consider materialized views for complex aggregations
4. Optimize with proper indexing

---

### 6. Dual Storage Pattern (Reviews)

**Challenge**: Reviews are stored in two places - embedded in `books.reviews[]` (subset) and standalone in `reviews` collection.

**Current Behavior**:
- New reviews added to both locations
- `books.reviews[]` limited to recent reviews (subset pattern)
- Full history available in `reviews` collection

**Migration Decision**:
- **Remove dual storage** - Store reviews only in `reviews` table
- Create view `book_recent_reviews` for backward compatibility
- Update application to query `reviews` table directly

**Benefits**:
- Single source of truth
- No synchronization issues
- Simpler data model

---

### 7. Atomic Operations

**Challenge**: MongoDB's `$inc` operator provides atomic increment/decrement operations.

**Current Usage** (from `server/src/controllers/books.ts`):
```javascript
collections?.books?.updateOne(
  { _id: bookId },
  { $inc: { available: count } }
);
```

**PostgreSQL Equivalent**:
```sql
UPDATE books 
SET available = available + $1,
    updated_at = CURRENT_TIMESTAMP
WHERE isbn = $2;
```

**Considerations**:
- PostgreSQL UPDATE is also atomic within a single statement
- Use transactions for multi-table operations
- Consider row-level locking for high-concurrency scenarios

---

## Data Migration Strategy

### Phase 1: Schema Creation
1. Create all PostgreSQL tables without foreign key constraints
2. Create ID mapping table
3. Set up Supabase project and configure access

### Phase 2: Data Migration
1. Migrate `users` collection (generate UUID mapping)
2. Migrate `authors` collection (generate UUID mapping)
3. Extract `author_aliases` from `authors.aliases[]`
4. Migrate `books` collection (ISBN as-is)
5. Extract `book_attributes` from `books.attributes[]`
6. Extract `book_genres` from `books.genres[]`
7. Create `book_authors` junction records
8. Migrate `reviews` collection (map bookId, generate UUID)
9. Split `issueDetails` into `reservations` and `borrowed_books`

### Phase 3: Constraint Addition
1. Add all foreign key constraints
2. Create indexes for common query patterns
3. Set up triggers for computed fields
4. Enable Row Level Security (RLS)

### Phase 4: Validation
1. Compare document counts
2. Validate referential integrity
3. Test computed field accuracy
4. Run application test suite

---

## Application Code Changes

### Controller Updates

| File | Changes Required |
|------|------------------|
| `server/src/database.ts` | Replace MongoDB client with Supabase client |
| `server/src/controllers/books.ts` | Replace aggregation with SQL queries/views |
| `server/src/controllers/issue-details.ts` | Split into reservation and borrow controllers |
| `server/src/controllers/user.ts` | Update to use UUID, SQL queries |

### Model Updates

| File | Changes Required |
|------|------------------|
| `server/src/models/book.ts` | Remove embedded types, update ID types |
| `server/src/models/issue-detail.ts` | Split into separate interfaces |
| `server/src/models/author.ts` | Remove books array, update ID type |
| `server/src/models/review.ts` | Update ID types |
| `server/src/models/user.ts` | Update ID type to UUID string |

### Query Pattern Changes

| MongoDB Pattern | PostgreSQL Equivalent |
|-----------------|----------------------|
| `collection.find({})` | `SELECT * FROM table` |
| `collection.findOne({ _id })` | `SELECT * FROM table WHERE id = $1` |
| `collection.aggregate([...])` | SQL with JOINs or views |
| `{ _id: /^userId/ }` | `WHERE user_id = $1` |
| `$lookup` | `JOIN` |
| `$inc` | `SET column = column + value` |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Data loss during migration | Low | Critical | Backup, validation, rollback plan |
| Performance regression | Medium | High | Indexing, query optimization, caching |
| Application bugs | Medium | High | Comprehensive testing, staged rollout |
| Downtime during cutover | Medium | Medium | Blue-green deployment, feature flags |
| Referential integrity issues | Low | High | Constraint validation, data cleanup |

---

## Rollback Plan

1. **Pre-migration**: Full MongoDB backup
2. **During migration**: Keep MongoDB as primary, PostgreSQL as secondary
3. **Post-migration**: Maintain MongoDB read-only for 30 days
4. **Rollback trigger**: Application errors > 1%, data inconsistency detected
5. **Rollback procedure**: Switch connection string, restore from backup if needed

---

## Timeline Estimate

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Schema Creation | 1 day | Supabase project setup |
| Phase 2: Data Migration Scripts | 2-3 days | Schema finalized |
| Phase 3: Application Code Updates | 3-5 days | Migration scripts tested |
| Phase 4: Testing | 2-3 days | Code updates complete |
| Phase 5: Staged Rollout | 1-2 days | Testing passed |
| **Total** | **9-14 days** | |

---

## Supabase-Specific Considerations

### Row Level Security (RLS)
- Enable RLS on all tables
- Create policies for user data access
- Admin bypass policies for administrative operations

### Realtime Subscriptions
- Enable realtime on `reservations` and `borrowed_books` for live updates
- Consider realtime on `books` for availability changes

### Edge Functions
- Consider moving complex business logic to Edge Functions
- Potential for reservation expiration handling

### Storage
- Book cover images can migrate to Supabase Storage
- Update `cover_url` references accordingly

---

## Next Steps

1. Review and approve this migration plan
2. Set up Supabase project and configure access
3. Begin Phase 2: Create migration scripts
4. Set up CI/CD for PostgreSQL schema migrations
5. Create feature flags for gradual rollout
