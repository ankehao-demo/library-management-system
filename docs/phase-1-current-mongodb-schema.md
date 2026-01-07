# Phase 1: Current MongoDB Schema Documentation

This document provides a comprehensive analysis of the current MongoDB schema used in the Library Management System, including actual data samples from the database, relationships between collections, and MongoDB-specific patterns.

## Overview

The Library Management System uses MongoDB with five collections:

| Collection | Document Count | Primary Key Type | Description |
|------------|---------------|------------------|-------------|
| books | 12 | String (ISBN) | Book catalog with embedded reviews |
| users | 9 | ObjectId | Library users with admin flag |
| issueDetails | 3 | Composite String | Reservations and borrowed books (polymorphic) |
| authors | 8 | ObjectId | Author information with book references |
| reviews | 28 | ObjectId | Standalone reviews collection |

## Collection Schemas

### 1. Books Collection

**Location**: `server/src/models/book.ts`

The books collection uses ISBN as the primary key (`_id`), which is a string rather than the default ObjectId. This is a deliberate design choice to use a natural key.

**Schema Definition**:

```typescript
interface Book {
    _id: string;                    // ISBN (International Standard Book Number)
    title: string;
    year: number;
    cover?: string;                 // URL to cover image
    genres?: Array<string>;
    pages?: number;
    synopsis?: string;
    publisher?: string;
    longTitle?: string;
    language?: string;
    binding?: string;
    totalInventory: number;         // Total books in inventory
    available: number;              // Computed field - books currently available
    authors?: Array<{               // Extended reference pattern
        _id: ObjectId;
        name: string;
    }>;
    attributes: Array<{             // Attribute pattern (key-value pairs)
        key: string;
        value: string;
    }>;
    reviews: Array<{                // Subset pattern - embedded reviews
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

**Indexes**:
- `_id_` (default index on ISBN)

### 2. Users Collection

**Location**: `server/src/models/user.ts`

The users collection uses standard ObjectId primary keys with schema validation enforced at the database level.

**Schema Definition**:

```typescript
interface User {
    _id?: ObjectId;
    name: string;
    isAdmin?: boolean;
}
```

**Schema Validation** (from `server/src/schema-validation/apply-schema.ts` lines 13-27):

```javascript
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
[
  {
    "_id": "695c0a491f15c05b869c3c2e",
    "name": "Rowdy Quetzal",
    "isAdmin": true
  },
  {
    "_id": "695c0a4a1f15c05b869c3c2f",
    "name": "Sneaky Quetzal",
    "isAdmin": true
  },
  {
    "_id": "695c0a4a1f15c05b869c3c30",
    "name": "Luminous Rhino",
    "isAdmin": true
  }
]
```

**Indexes**:
- `_id_` (default index on ObjectId)

### 3. IssueDetails Collection (Polymorphic)

**Location**: `server/src/models/issue-detail.ts`

The issueDetails collection implements the **Single Collection Pattern** (polymorphic pattern) to store both reservations and borrowed books in the same collection. The `recordType` field serves as a discriminator.

**Schema Definition** (lines 3-9, 54-64):

```typescript
// Polymorphic type - can be either BorrowedBook or Reservation
type IssueDetail = BorrowedBook | Reservation;

enum IssueDetailType {
    Reservation = 'R',
    BorrowedBook = 'B'
}

interface IssueDetailBase {
    // Composite string key: userId + type + bookId
    _id: string;
    recordType: string;  // 'reservation' or 'borrowedBook'
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
    expirationDate: Date;  // TTL index applied for auto-removal
}

interface BorrowedBook extends IssueDetailBase {
    borrowDate: Date;
    dueDate: Date;
    returnedDate?: Date;
    returned: boolean;
}
```

**Composite Key Format** (from `server/src/controllers/issue-details.ts` lines 88-90):

```typescript
private getIssueDetailsId(bookId: string, userId: string, type: string) {
    return `${userId}${type}${bookId}`;
}
```

The composite key format is: `{userId}{type}{bookId}` where:
- `userId` is the ObjectId string of the user
- `type` is 'R' for reservation or 'B' for borrowed book
- `bookId` is the ISBN of the book

**Sample Documents from Database** (Reservations):

```json
[
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
  },
  {
    "_id": "695c0a4a1f15c05b869c3c32R9780451524935",
    "book": {
      "_id": "9780451524935",
      "title": "1984"
    },
    "user": {
      "_id": "695c0a4a1f15c05b869c3c32",
      "name": "Rowdy Scorpion"
    },
    "recordType": "reservation",
    "expirationDate": "2026-01-06T07:00:38.015Z"
  }
]
```

**Sample BorrowedBook Document** (from code model):

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
  "borrowDate": "2026-01-01T00:00:00.000Z",
  "dueDate": "2026-01-22T00:00:00.000Z",
  "returned": false
}
```

**Indexes**:
- `_id_` (default index on composite string key)

### 4. Authors Collection

**Location**: `server/src/models/author.ts`

The authors collection stores author information with an array of ISBNs referencing their books.

**Schema Definition**:

```typescript
interface Author {
    _id: ObjectId;
    name: string;
    sanitizedName: string;      // URL-friendly name
    aliases: Array<string>;     // Alternative names
    bio?: string;
    books: Array<string>;       // Array of ISBNs
}
```

**Sample Documents from Database**:

```json
[
  {
    "_id": "695c0a4c0850c6486d5504c6",
    "name": "F. Scott Fitzgerald",
    "sanitizedName": "f-scott-fitzgerald",
    "aliases": ["Francis Scott Key Fitzgerald"],
    "bio": "American novelist, essayist, and short story writer known for depicting the flamboyance and excess of the Jazz Age.",
    "books": ["9780743273565"]
  },
  {
    "_id": "695c0a4d0850c6486d5504c8",
    "name": "George Orwell",
    "sanitizedName": "george-orwell",
    "aliases": ["Eric Arthur Blair"],
    "bio": "English novelist, essayist, journalist and critic known for works like 1984 and Animal Farm.",
    "books": ["9780451524935", "9780452284234"]
  },
  {
    "_id": "695c0a4d0850c6486d5504cc",
    "name": "J.K. Rowling",
    "sanitizedName": "jk-rowling",
    "aliases": ["Joanne Rowling"],
    "bio": "British author, best known for the Harry Potter series of fantasy novels.",
    "books": ["9780439708180", "9780439064873"]
  }
]
```

**Indexes**:
- `_id_` (default index on ObjectId)

### 5. Reviews Collection

**Location**: `server/src/models/review.ts`

The reviews collection stores standalone reviews with a foreign key reference to books.

**Schema Definition**:

```typescript
interface Review {
    _id: ObjectId;
    text: string;
    name: string;           // Reviewer name (denormalized)
    rating?: number;
    timestamp: number;      // Unix timestamp in milliseconds
    bookId: string;         // Foreign key to books collection (ISBN)
}
```

**Sample Documents from Database**:

```json
[
  {
    "_id": "695c0a4f1f15c05b869c3c37",
    "text": "A masterpiece of American literature! Fitzgerald's prose is beautiful.",
    "name": "Sneaky Quetzal",
    "rating": 5,
    "timestamp": 1767639631992,
    "bookId": "9780743273565"
  },
  {
    "_id": "695c0a501f15c05b869c3c38",
    "text": "The symbolism of the green light is haunting and powerful.",
    "name": "Luminous Rhino",
    "rating": 4,
    "timestamp": 1767639632183,
    "bookId": "9780743273565"
  }
]
```

**Indexes**:
- `_id_` (default index on ObjectId)

## Relationships Between Collections

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   authors   │────<│    books    │>────│   reviews   │
│  (ObjectId) │     │   (ISBN)    │     │  (ObjectId) │
└─────────────┘     └─────────────┘     └─────────────┘
      │                   │                    │
      │                   │                    │
      │ books[]           │ authors[]          │ bookId
      │ (ISBN array)      │ (embedded ref)     │ (ISBN FK)
      │                   │                    │
      │                   │ reviews[]          │
      │                   │ (embedded subset)  │
      │                   │                    │
      │             ┌─────────────┐            │
      │             │issueDetails │            │
      │             │(composite)  │            │
      │             └─────────────┘            │
      │                   │                    │
      │                   │ book._id (ISBN)    │
      │                   │ user._id (ObjectId)│
      │                   │                    │
      │             ┌─────────────┐            │
      └─────────────│    users    │────────────┘
                    │  (ObjectId) │
                    └─────────────┘
```

### Relationship Summary

| From | To | Type | Field | Description |
|------|-----|------|-------|-------------|
| books | authors | Many-to-Many | `books.authors[]._id` | Embedded author references in books |
| authors | books | Many-to-Many | `authors.books[]` | Array of ISBNs in authors |
| books | reviews | One-to-Many | `books.reviews[]` | Embedded reviews (subset pattern) |
| reviews | books | Many-to-One | `reviews.bookId` | Foreign key to book ISBN |
| issueDetails | books | Many-to-One | `issueDetails.book._id` | Embedded book reference |
| issueDetails | users | Many-to-One | `issueDetails.user._id` | Embedded user reference |

## MongoDB-Specific Patterns

### 1. Computed Fields Pattern

**Location**: `server/src/controllers/books.ts` lines 42-76

The `available` field in books is computed at query time using an aggregation pipeline. This calculates availability by subtracting active reservations and unreturned borrows from total inventory.

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

### 2. Embedded Documents (Subset Pattern)

**Location**: `server/src/models/book.ts` lines 53-57

Books embed up to 5 reviews directly within the document following the subset pattern. This allows for efficient retrieval of recent reviews without a separate query.

```typescript
reviews: Array<Omit<Review, '_id' | 'bookId'>>;
```

The embedded reviews contain all review fields except `_id` and `bookId` since those are implicit from the parent document.

### 3. Polymorphic Pattern (Single Collection)

**Location**: `server/src/models/issue-detail.ts` lines 3-9, 61-64

The `issueDetails` collection stores both reservations and borrowed books using a `recordType` discriminator field. This pattern allows querying all issue details together while maintaining type-specific fields.

```typescript
type IssueDetail = BorrowedBook | Reservation;

interface IssueDetailBase {
    _id: string;
    recordType: string;  // 'reservation' or 'borrowedBook'
    // ... common fields
}
```

### 4. Composite String Keys

**Location**: `server/src/models/issue-detail.ts` lines 54-59, `server/src/controllers/issue-details.ts` lines 88-90

Issue details use a composite string key format: `{userId}{type}{bookId}`. This enables:
- Efficient prefix-based queries by user: `db.issueDetails.find({ _id: /^userId/ })`
- Uniqueness constraint per user-book-type combination
- Natural ordering by user

```typescript
private getIssueDetailsId(bookId: string, userId: string, type: string) {
    return `${userId}${type}${bookId}`;
}
```

### 5. Atomic Operations ($inc)

**Location**: `server/src/controllers/books.ts` lines 152-158

Inventory updates use MongoDB's `$inc` operator for atomic increment/decrement operations, preventing race conditions.

```typescript
private updateBookInventory(bookId: string, count: number): Promise<UpdateResult> {
    const result = collections?.books?.updateOne(
        { _id: bookId },
        { $inc: { available: count } }
    );
    return result;
}
```

### 6. Extended Reference Pattern

**Location**: `server/src/models/book.ts` lines 36-42, `server/src/models/issue-detail.ts` lines 66-76

Both books and issueDetails embed partial copies of related documents (authors, books, users) to reduce the need for joins while maintaining referential integrity.

```typescript
// In books - embedded author reference
authors?: Array<{
    _id: ObjectId;
    name: string;
}>;

// In issueDetails - embedded book and user references
book: {
    _id: string;
    title: string;
};
user: {
    _id: ObjectId;
    name: string;
};
```

### 7. Duration Constants

**Location**: `server/src/controllers/issue-details.ts` lines 30-31

Business rules for reservation and borrow durations are defined as constants:

```typescript
RESERVATION_DURATION = 0.5;  // 0.5 days -> 12 hours
BORROWED_DURATION = 21;      // 21 days
```

## Data Observations and Edge Cases

### Observed Data Patterns

1. **All users are admins**: In the current database, all 9 users have `isAdmin: true`. This may be test data.

2. **Reviews are duplicated**: Reviews exist both embedded in books and in the standalone reviews collection. This is intentional for the subset pattern but requires synchronization.

3. **Author-Book relationship is bidirectional**: Books reference authors (embedded) and authors reference books (ISBN array). This denormalization requires careful synchronization.

4. **ObjectId stored as string**: In issueDetails, the `user._id` field stores ObjectId values but they appear as strings in the JSON representation.

5. **Timestamp format inconsistency**: Reviews use Unix timestamps in milliseconds (`timestamp: 1767639631992`) while issueDetails use ISO date strings (`expirationDate: "2026-01-06T07:00:37.753Z"`).

### Potential Data Integrity Issues

1. **No foreign key constraints**: MongoDB doesn't enforce referential integrity. A book could be deleted while still referenced in issueDetails or reviews.

2. **Embedded data staleness**: If an author's name changes, the embedded reference in books would become stale.

3. **Composite key parsing**: The composite key format relies on string concatenation without delimiters, which could cause issues if IDs contain the type characters ('R' or 'B').

## Summary Statistics

| Metric | Value |
|--------|-------|
| Total Collections | 5 |
| Total Documents | 60 |
| Books | 12 |
| Users | 9 |
| Authors | 8 |
| Reviews (standalone) | 28 |
| Issue Details | 3 |
| Embedded Reviews | ~36 (3 per book average) |
