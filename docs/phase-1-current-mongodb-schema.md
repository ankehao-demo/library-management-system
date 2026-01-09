# Phase 1: Current MongoDB Schema Documentation

This document provides a comprehensive analysis of the current MongoDB schema used in the Library Management System. It serves as the foundation for planning the migration to Supabase/Postgres.

## Database Overview

The Library Management System uses MongoDB Atlas with a database named `library` containing five collections:

| Collection | Document Count | Primary Key Type | Description |
|------------|----------------|------------------|-------------|
| books | 12 | String (ISBN) | Book catalog with inventory tracking |
| users | 9 | ObjectId | User accounts with admin flag |
| issueDetails | 3 | Composite String | Reservations and borrowed books |
| authors | 8 | ObjectId | Author information with book references |
| reviews | 28 | ObjectId | Book reviews (also embedded in books) |

## Collection Schemas

### 1. Books Collection

The `books` collection uses ISBN as the primary key (`_id`) instead of MongoDB's default ObjectId. This is a deliberate design choice for natural key usage.

**Schema Definition** (from `server/src/models/book.ts`):

```typescript
interface Book {
    _id: string;              // ISBN - International Standard Book Number
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
    totalInventory: number;   // Total copies owned
    available: number;        // Computed field - copies currently available
    authors?: Array<{         // Extended reference pattern
        _id: ObjectId;
        name: string;
    }>;
    attributes: Array<{       // Attribute pattern for flexible key-value pairs
        key: string;
        value: string;
    }>;
    reviews: Array<{          // Subset pattern - embedded reviews (up to 5)
        _id: ObjectId;
        text: string;
        name: string;
        rating?: number;
        timestamp: number;
    }>;
    bookOfTheMonth?: boolean;
}
```

**Sample Document from Database**:

```json
{
  "_id": "9780743273565",
  "title": "The Great Gatsby",
  "year": 1925,
  "authors": [
    {
      "_id": "695c0a4c0850c6486d5504c6",
      "name": "F. Scott Fitzgerald"
    }
  ],
  "synopsis": "A classic American novel about the Jazz Age and the American Dream.",
  "publisher": "Scribner",
  "pages": 180,
  "language": "English",
  "totalInventory": 5,
  "available": 4,
  "attributes": [],
  "reviews": [
    {
      "_id": "695c0a501f15c05b869c3c39",
      "text": "A tragic tale of the American Dream. Beautifully written.",
      "name": "Pompous Narwhal",
      "rating": 5,
      "timestamp": 1767639632410
    },
    {
      "_id": "695c0a501f15c05b869c3c38",
      "text": "The symbolism of the green light is haunting and powerful.",
      "name": "Luminous Rhino",
      "rating": 4,
      "timestamp": 1767639632183
    },
    {
      "_id": "695c0a4f1f15c05b869c3c37",
      "text": "A masterpiece of American literature! Fitzgerald's prose is beautiful.",
      "name": "Sneaky Quetzal",
      "rating": 5,
      "timestamp": 1767639631992
    }
  ]
}
```

**MongoDB-Specific Patterns Used**:

1. **Natural Key Pattern**: Uses ISBN as `_id` instead of ObjectId
2. **Extended Reference Pattern**: Authors array contains `_id` and `name` for denormalization
3. **Subset Pattern**: Reviews are embedded directly (limited to recent reviews)
4. **Attribute Pattern**: Flexible key-value pairs for variable attributes
5. **Computed Pattern**: The `available` field is computed at query time

**Computed Field Implementation** (from `server/src/controllers/books.ts` lines 42-76):

```typescript
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
            available: {
                $subtract: ['$totalInventory', { $size: '$details' }]
            }
        }
    },
    { $unset: 'details' }
]).toArray();
```

### 2. Users Collection

The `users` collection uses standard ObjectId primary keys with schema validation enforced at the database level.

**Schema Definition** (from `server/src/models/user.ts`):

```typescript
interface User {
    _id?: ObjectId;
    name: string;
    isAdmin?: boolean;
}
```

**MongoDB Schema Validation** (from `server/src/schema-validation/apply-schema.ts` lines 13-27):

```typescript
const userSchema = {
    bsonType: 'object',
    required: ['name', 'isAdmin'],
    properties: {
        name: {
            bsonType: 'string',
            minLength: 5,
            description: 'must be a string and is required'
        },
        isAdmin: {
            bsonType: 'bool',
            description: 'must be a boolean and is required'
        }
    }
};
```

**Sample Documents from Database**:

```json
{
  "_id": "695c0a491f15c05b869c3c2e",
  "name": "Rowdy Quetzal",
  "isAdmin": true
}

{
  "_id": "695c0a4a1f15c05b869c3c2f",
  "name": "Sneaky Quetzal",
  "isAdmin": true
}

{
  "_id": "695c0a4a1f15c05b869c3c30",
  "name": "Luminous Rhino",
  "isAdmin": true
}
```

**Constraints**:
- `name` is required and must be at least 5 characters
- `isAdmin` is required and must be a boolean
- Validation level is set to `strict` with action `error`

### 3. IssueDetails Collection (Polymorphic Pattern)

The `issueDetails` collection implements a **polymorphic/single-collection pattern** where both reservations and borrowed books are stored in the same collection, differentiated by a `recordType` discriminator field.

**Schema Definition** (from `server/src/models/issue-detail.ts` lines 3-9, 54-64):

```typescript
// Polymorphic type - can be either BorrowedBook or Reservation
type IssueDetail = BorrowedBook | Reservation;

interface IssueDetailBase {
    // Composite string key: userId + type + bookId
    _id: string;
    recordType: string;  // 'borrowedBook' or 'reservation'
    book: {
        _id: string;     // ISBN reference
        title: string;
    };
    user: {
        _id: ObjectId;
        name: string;
    };
}

interface Reservation extends IssueDetailBase {
    expirationDate: Date;  // TTL index for auto-removal
}

interface BorrowedBook extends IssueDetailBase {
    borrowDate: Date;
    dueDate: Date;
    returnedDate?: Date;
    returned: boolean;
}
```

**Composite String Key Format** (from `server/src/controllers/issue-details.ts` lines 88-98):

```typescript
// Key format: userId + type + bookId
// Example: "695c0a4a1f15c05b869c3c30R9780743273565"
//          |_______userId_______||type||___bookId___|

private getIssueDetailsId(bookId: string, userId: string, type: string) {
    return `${userId}${type}${bookId}`;
}

// Type indicators:
// 'R' = Reservation
// 'B' = BorrowedBook
```

**Sample Reservation Document from Database**:

```json
{
  "_id": "695c0a4a1f15c05b869c3c30R9780743273565",
  "book": {
    "_id": "9780743273565",
    "title": "The Great Gatsby"
  },
  "user": {
    "_id": "695c0a4a1f15c05b869c3c30",
    "name": "Luminous Rhino"
  },
  "recordType": "reservation",
  "expirationDate": "2026-01-06T07:00:37.753Z"
}
```

**BorrowedBook Document Structure** (from code - no current data):

```json
{
  "_id": "695c0a4a1f15c05b869c3c30B9780743273565",
  "book": {
    "_id": "9780743273565",
    "title": "The Great Gatsby"
  },
  "user": {
    "_id": "695c0a4a1f15c05b869c3c30",
    "name": "Luminous Rhino"
  },
  "recordType": "borrowedBook",
  "borrowDate": "2026-01-05T19:00:37.753Z",
  "dueDate": "2026-01-26T19:00:37.753Z",
  "returned": false,
  "returnedDate": null
}
```

**Duration Constants** (from `server/src/controllers/issue-details.ts` lines 30-31):

```typescript
RESERVATION_DURATION = 0.5;  // 0.5 days = 12 hours
BORROWED_DURATION = 21;      // 21 days
```

**Query Patterns**:

```typescript
// Find all reservations for a user using regex prefix match
const filter = { '_id': new RegExp(`^${userId}R`) };

// Find all borrowed books for a user
const filter = { '_id': new RegExp(`^${userId}B`), returned: false };
```

### 4. Authors Collection

The `authors` collection uses ObjectId primary keys and maintains a denormalized array of book ISBNs.

**Schema Definition** (from `server/src/models/author.ts`):

```typescript
interface Author {
    _id: ObjectId;
    name: string;
    sanitizedName: string;    // URL-friendly slug
    aliases: Array<string>;   // Alternative names
    bio?: string;
    books: Array<string>;     // Array of ISBNs
}
```

**Sample Documents from Database**:

```json
{
  "_id": "695c0a4c0850c6486d5504c6",
  "name": "F. Scott Fitzgerald",
  "sanitizedName": "f-scott-fitzgerald",
  "aliases": ["Francis Scott Key Fitzgerald"],
  "bio": "American novelist, essayist, and short story writer known for depicting the flamboyance and excess of the Jazz Age.",
  "books": ["9780743273565"]
}

{
  "_id": "695c0a4d0850c6486d5504c8",
  "name": "George Orwell",
  "sanitizedName": "george-orwell",
  "aliases": ["Eric Arthur Blair"],
  "bio": "English novelist, essayist, journalist and critic known for works like 1984 and Animal Farm.",
  "books": ["9780451524935", "9780452284234"]
}

{
  "_id": "695c0a4d0850c6486d5504cc",
  "name": "J.K. Rowling",
  "sanitizedName": "jk-rowling",
  "aliases": ["Joanne Rowling"],
  "bio": "British author, best known for the Harry Potter series of fantasy novels.",
  "books": ["9780439708180", "9780439064873"]
}
```

**Relationship Pattern**:
- Authors store an array of book ISBNs (one-to-many from author perspective)
- Books store an array of author references with `_id` and `name` (many-to-many relationship)
- This creates bidirectional denormalization for query optimization

### 5. Reviews Collection

The `reviews` collection stores all reviews with a reference to the book. Reviews are also embedded in the `books` collection following the subset pattern.

**Schema Definition** (from `server/src/models/review.ts`):

```typescript
interface Review {
    _id: ObjectId;
    text: string;
    name: string;           // Reviewer name (denormalized)
    rating?: number;        // 1-5 star rating
    timestamp: number;      // Unix timestamp in milliseconds
    bookId: string;         // ISBN reference
}
```

**Sample Documents from Database**:

```json
{
  "_id": "695c0a4f1f15c05b869c3c37",
  "text": "A masterpiece of American literature! Fitzgerald's prose is beautiful.",
  "name": "Sneaky Quetzal",
  "rating": 5,
  "timestamp": 1767639631992,
  "bookId": "9780743273565"
}

{
  "_id": "695c0a501f15c05b869c3c38",
  "text": "The symbolism of the green light is haunting and powerful.",
  "name": "Luminous Rhino",
  "rating": 4,
  "timestamp": 1767639632183,
  "bookId": "9780743273565"
}

{
  "_id": "695c0a501f15c05b869c3c3a",
  "text": "An important book about justice and morality. Everyone should read this.",
  "name": "Sneaky Quetzal",
  "rating": 5,
  "timestamp": 1767639632710,
  "bookId": "9780061120084"
}
```

**Dual Storage Pattern**:
- Reviews exist in the standalone `reviews` collection (complete history)
- Recent reviews are also embedded in the `books.reviews` array (subset pattern for fast access)
- This denormalization optimizes read performance for book detail pages

## Collection Indexes

All collections currently have only the default `_id` index:

| Collection | Index Name | Key | Type |
|------------|------------|-----|------|
| books | _id_ | { _id: 1 } | Default |
| users | _id_ | { _id: 1 } | Default |
| issueDetails | _id_ | { _id: 1 } | Default |
| authors | _id_ | { _id: 1 } | Default |
| reviews | _id_ | { _id: 1 } | Default |

**Note**: The `issueDetails` collection relies on regex prefix matching on the `_id` field for user-specific queries, which is efficient due to the composite key structure.

## Relationships Summary

```
                    ┌─────────────┐
                    │   authors   │
                    │  (ObjectId) │
                    └──────┬──────┘
                           │ books[] (ISBNs)
                           │
                           ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    users    │     │    books    │     │   reviews   │
│  (ObjectId) │     │   (ISBN)    │     │  (ObjectId) │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │                   │ authors[] (refs)  │ bookId (ISBN)
       │                   │ reviews[] (embed) │
       │                   │                   │
       └───────────┬───────┴───────────────────┘
                   │
                   ▼
            ┌─────────────┐
            │issueDetails │
            │(Composite)  │
            │ userId+type │
            │  +bookId    │
            └─────────────┘
```

## MongoDB-Specific Patterns Summary

| Pattern | Location | Description |
|---------|----------|-------------|
| Natural Key | books._id | ISBN used as primary key instead of ObjectId |
| Computed Pattern | books.available | Calculated via aggregation pipeline at query time |
| Extended Reference | books.authors[], issueDetails.book, issueDetails.user | Embedded subset of related document fields |
| Subset Pattern | books.reviews[] | Recent reviews embedded for fast access |
| Attribute Pattern | books.attributes[] | Flexible key-value pairs for variable data |
| Single Collection (Polymorphic) | issueDetails | Both reservations and borrows in one collection |
| Composite String Key | issueDetails._id | Format: userId + type + bookId |
| Bidirectional Denormalization | authors.books[], books.authors[] | Both sides store references |
| Atomic Operations | books.available | Uses $inc for inventory updates |

## Business Rules and Constraints

1. **User Name Length**: Minimum 5 characters (enforced via MongoDB schema validation)
2. **Reservation Duration**: 12 hours (0.5 days) before expiration
3. **Borrow Duration**: 21 days standard loan period
4. **Inventory Management**: Atomic `$inc` operations ensure consistency
5. **Availability Calculation**: `available = totalInventory - (active reservations + unreturned borrows)`

## Data Integrity Considerations

1. **No Foreign Key Constraints**: MongoDB doesn't enforce referential integrity
2. **Denormalized Data**: Author names in books, user names in issueDetails may become stale
3. **Embedded Reviews**: May not reflect all reviews in the reviews collection
4. **Composite Keys**: Application-level enforcement of key format
5. **TTL Index**: Reservations should have TTL index on `expirationDate` (not currently visible in indexes)
