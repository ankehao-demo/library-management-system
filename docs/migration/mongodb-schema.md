# Current MongoDB Schema Documentation

This document describes the current MongoDB database schema for the Library Management System, including actual data examples from the production database.

## Overview

The Library Management System uses MongoDB with five collections:

| Collection | Document Count | Primary Key Type | Description |
|------------|---------------|------------------|-------------|
| books | 12 | String (ISBN) | Book catalog with embedded reviews |
| users | 9 | ObjectId | Library users and administrators |
| issueDetails | 3 | Composite String | Reservations and borrowed books (polymorphic) |
| authors | 8 | ObjectId | Author information with book references |
| reviews | 28 | ObjectId | Standalone reviews collection |

## Collections

### 1. Books Collection

The `books` collection uses ISBN as the primary key (`_id`) instead of MongoDB's default ObjectId. This is a deliberate design choice for natural key usage.

**Schema Definition** (from `server/src/models/book.ts`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| _id | string | Yes | ISBN (International Standard Book Number) |
| title | string | Yes | Book title |
| year | number | Yes | Publication year |
| cover | string | No | URL to cover image |
| genres | string[] | No | Array of genre strings |
| pages | number | No | Page count |
| synopsis | string | No | Book description |
| publisher | string | No | Publisher name |
| longTitle | string | No | Extended title |
| language | string | No | Language of the book |
| binding | string | No | Binding type |
| totalInventory | number | Yes | Total copies in library |
| available | number | Yes | **Computed field** - copies currently available |
| authors | Array<{_id: ObjectId, name: string}> | No | Extended reference pattern |
| attributes | Array<{key: string, value: string}> | Yes | Attribute pattern for flexible metadata |
| reviews | Array<Review> | Yes | **Embedded subset** - up to 5 recent reviews |
| bookOfTheMonth | boolean | No | Featured book flag |

**Sample Document**:

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

**MongoDB-Specific Patterns**:

1. **Computed Pattern**: The `available` field is computed at query time using aggregation pipelines (see `server/src/controllers/books.ts`, lines 42-76):
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

2. **Extended Reference Pattern**: Authors are stored with both `_id` and `name` to avoid joins for common queries.

3. **Subset Pattern**: Reviews are embedded directly in the book document (limited to recent reviews) for fast access.

4. **Attribute Pattern**: Flexible key-value pairs for extensible metadata.

5. **Atomic Operations**: Inventory uses `$inc` for atomic updates (see `server/src/controllers/books.ts`, lines 152-158):
   ```javascript
   collections?.books?.updateOne(
     { _id: bookId },
     { $inc: { available: count } }
   );
   ```

---

### 2. Users Collection

The `users` collection stores library members and administrators.

**Schema Definition** (from `server/src/models/user.ts`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| _id | ObjectId | Yes (auto) | MongoDB ObjectId |
| name | string | Yes | User name (min 5 characters) |
| isAdmin | boolean | No | Administrator flag |

**Sample Documents**:

```json
{
  "_id": "695c0a491f15c05b869c3c2e",
  "name": "Rowdy Quetzal",
  "isAdmin": true
}
```

```json
{
  "_id": "695c0a4a1f15c05b869c3c2f",
  "name": "Sneaky Quetzal",
  "isAdmin": true
}
```

**Validation**: The schema requires `name` to have a minimum of 5 characters.

---

### 3. IssueDetails Collection (Polymorphic)

The `issueDetails` collection implements the **Single Collection Pattern** (polymorphic design) to store both reservations and borrowed books in the same collection. This is one of the most complex MongoDB patterns in the system.

**Schema Definition** (from `server/src/models/issue-detail.ts`):

**Base Fields (all records)**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| _id | string | Yes | **Composite key**: `userId + type + bookId` |
| recordType | string | Yes | Discriminator: `'reservation'` or `'borrowedBook'` |
| book | {_id: string, title: string} | Yes | Extended reference to book |
| user | {_id: ObjectId, name: string} | Yes | Extended reference to user |

**Reservation-specific Fields**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| expirationDate | Date | Yes | TTL-indexed expiration (0.5 days from creation) |

**BorrowedBook-specific Fields**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| borrowDate | Date | Yes | Date when book was borrowed |
| dueDate | Date | Yes | Due date (21 days from borrow) |
| returnedDate | Date | No | Date when returned (if returned) |
| returned | boolean | Yes | Return status flag |

**Composite Key Format** (from `server/src/controllers/issue-details.ts`, lines 88-90):

```javascript
getIssueDetailsId(bookId, userId, type) {
  return `${userId}${type}${bookId}`;
}
```

Where `type` is:
- `'R'` for Reservation
- `'B'` for BorrowedBook

**Sample Reservation Document**:

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

**Sample BorrowedBook Document** (structure from code):

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
  "borrowDate": "2026-01-06T07:00:37.753Z",
  "dueDate": "2026-01-27T07:00:37.753Z",
  "returned": false
}
```

**Duration Constants** (from `server/src/controllers/issue-details.ts`, lines 30-31):
- Reservation duration: 0.5 days (12 hours)
- Borrow duration: 21 days

**Query Pattern**: The composite key enables efficient user-based queries using regex:
```javascript
db.issueDetails.find({ _id: /^userId/ })
```

---

### 4. Authors Collection

The `authors` collection stores author information with references to their books.

**Schema Definition** (from `server/src/models/author.ts`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| _id | ObjectId | Yes (auto) | MongoDB ObjectId |
| name | string | Yes | Author's full name |
| sanitizedName | string | Yes | URL-friendly name slug |
| aliases | string[] | Yes | Alternative names |
| bio | string | No | Author biography |
| books | string[] | Yes | Array of ISBNs (references to books collection) |

**Sample Documents**:

```json
{
  "_id": "695c0a4c0850c6486d5504c6",
  "name": "F. Scott Fitzgerald",
  "sanitizedName": "f-scott-fitzgerald",
  "aliases": ["Francis Scott Key Fitzgerald"],
  "bio": "American novelist, essayist, and short story writer known for depicting the flamboyance and excess of the Jazz Age.",
  "books": ["9780743273565"]
}
```

```json
{
  "_id": "695c0a4c0850c6486d5504c8",
  "name": "George Orwell",
  "sanitizedName": "george-orwell",
  "aliases": ["Eric Arthur Blair"],
  "bio": "English novelist, essayist, journalist and critic known for works like 1984 and Animal Farm.",
  "books": ["9780451524935", "9780452284234"]
}
```

**Relationship Pattern**: This creates a many-to-many relationship between books and authors:
- Authors store an array of book ISBNs
- Books store an array of author references (with embedded name)

---

### 5. Reviews Collection

The `reviews` collection stores all reviews as standalone documents. Note that reviews are also embedded in the `books` collection (subset pattern).

**Schema Definition** (from `server/src/models/review.ts`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| _id | ObjectId | Yes (auto) | MongoDB ObjectId |
| text | string | Yes | Review content |
| name | string | Yes | Reviewer name |
| rating | number | No | Numeric rating |
| timestamp | number | Yes | Unix timestamp |
| bookId | string | Yes | Reference to book (ISBN) |

**Sample Documents**:

```json
{
  "_id": "695c0a4f1f15c05b869c3c37",
  "text": "A masterpiece of American literature! Fitzgerald's prose is beautiful.",
  "name": "Sneaky Quetzal",
  "rating": 5,
  "timestamp": 1767639631992,
  "bookId": "9780743273565"
}
```

```json
{
  "_id": "695c0a501f15c05b869c3c38",
  "text": "The symbolism of the green light is haunting and powerful.",
  "name": "Luminous Rhino",
  "rating": 4,
  "timestamp": 1767639632183,
  "bookId": "9780743273565"
}
```

**Dual Storage Pattern**: Reviews exist in two places:
1. Standalone in the `reviews` collection (complete history)
2. Embedded in `books.reviews` (subset of recent reviews for fast access)

---

## Current Indexes

All collections currently only have the default `_id` index:

| Collection | Index Name | Key |
|------------|------------|-----|
| books | _id_ | { _id: 1 } |
| users | _id_ | { _id: 1 } |
| issueDetails | _id_ | { _id: 1 } |
| authors | _id_ | { _id: 1 } |
| reviews | _id_ | { _id: 1 } |

**Note**: The `issueDetails` collection would benefit from a TTL index on `expirationDate` for automatic reservation cleanup, but this is not currently configured.

---

## Relationships Summary

```
books (ISBN) <---> authors (ObjectId)
    |                    |
    | (embedded)         | (array of ISBNs)
    v                    v
reviews (ObjectId)   books array
    |
    | (bookId reference)
    v
books (ISBN)

users (ObjectId) <---> issueDetails (composite string)
                            |
                            | (book._id reference)
                            v
                       books (ISBN)
```

## Key MongoDB Patterns Used

1. **Natural Key Pattern**: Books use ISBN as `_id` instead of ObjectId
2. **Extended Reference Pattern**: Embedded author/user info to avoid joins
3. **Subset Pattern**: Recent reviews embedded in books
4. **Attribute Pattern**: Flexible key-value metadata on books
5. **Computed Pattern**: `available` field calculated at query time
6. **Single Collection Pattern**: Polymorphic `issueDetails` for reservations and borrows
7. **Composite Key Pattern**: String concatenation for unique identifiers
