# Current MongoDB Schema Documentation

This document describes the current MongoDB database schema for the Library Management System, including all collections, their fields, relationships, and MongoDB-specific patterns used.

## Database Overview

The Library Management System uses a MongoDB database named `library` with five collections:

| Collection | Document Count | Primary Key Type | Description |
|------------|----------------|------------------|-------------|
| books | 12 | String (ISBN) | Book catalog with inventory tracking |
| users | 9 | ObjectId | Library users/members |
| issueDetails | 3 | Composite String | Reservations and borrowed books |
| authors | 8 | ObjectId | Author information |
| reviews | 28 | ObjectId | Book reviews |

## Collections

### 1. Books Collection

The `books` collection stores book information using ISBN as the primary key (`_id`). This is a notable deviation from MongoDB's default ObjectId pattern.

**Schema Definition** (from `server/src/models/book.ts`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| _id | String | Yes | ISBN (International Standard Book Number) |
| title | String | Yes | Book title |
| year | Number | Yes | Publication year |
| cover | String | No | URL to cover image |
| genres | Array\<String\> | No | List of genres |
| pages | Number | No | Number of pages |
| synopsis | String | No | Book description |
| publisher | String | No | Publisher name |
| longTitle | String | No | Extended title |
| language | String | No | Language of the book |
| binding | String | No | Binding type |
| totalInventory | Number | Yes | Total copies in library |
| available | Number | Yes | Currently available copies (computed) |
| authors | Array\<Object\> | No | Embedded author references |
| attributes | Array\<Object\> | Yes | Key-value attribute pairs |
| reviews | Array\<Object\> | Yes | Embedded reviews (subset pattern) |
| bookOfTheMonth | Boolean | No | Featured book flag |

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

**All Books in Database**:

| ISBN | Title | Total Inventory | Available |
|------|-------|-----------------|-----------|
| 9780743273565 | The Great Gatsby | 5 | 4 |
| 9780061120084 | To Kill a Mockingbird | 5 | 5 |
| 9780451524935 | 1984 | 5 | 4 |
| 9780452284234 | Animal Farm | 5 | 5 |
| 9780141439518 | Pride and Prejudice | 5 | 4 |
| 9780141439662 | Emma | 5 | 5 |
| 9780316769174 | The Catcher in the Rye | 5 | 5 |
| 9780571056866 | Lord of the Flies | 5 | 5 |
| 9780439708180 | Harry Potter and the Sorcerer's Stone | 5 | 5 |
| 9780439064873 | Harry Potter and the Chamber of Secrets | 5 | 5 |
| 9780062073488 | Murder on the Orient Express | 5 | 5 |
| 9780062073471 | And Then There Were None | 5 | 5 |

### 2. Users Collection

The `users` collection stores library member information with schema validation requiring a minimum name length of 5 characters.

**Schema Definition** (from `server/src/models/user.ts`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| _id | ObjectId | Yes | Auto-generated unique identifier |
| name | String | Yes | User's name (min 5 characters) |
| isAdmin | Boolean | No | Administrator flag |

**Sample Documents**:

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

**All Users in Database**:

| ObjectId | Name | Is Admin |
|----------|------|----------|
| 695c0a491f15c05b869c3c2e | Rowdy Quetzal | true |
| 695c0a4a1f15c05b869c3c2f | Sneaky Quetzal | true |
| 695c0a4a1f15c05b869c3c30 | Luminous Rhino | true |
| 695c0a4a1f15c05b869c3c31 | Pompous Narwhal | true |
| 695c0a4a1f15c05b869c3c32 | Rowdy Scorpion | true |
| 695c0a4a1f15c05b869c3c33 | Ignominious Narwhal | true |
| 695c0a4b1f15c05b869c3c34 | Golden Barracuda | true |
| 695c0a4b1f15c05b869c3c35 | Chill Rhino | true |
| 695c0a4b1f15c05b869c3c36 | Abrasive Quetzal | true |

### 3. IssueDetails Collection (Polymorphic Pattern)

The `issueDetails` collection uses a **polymorphic/single-collection pattern** to store both reservations and borrowed books in the same collection. The `recordType` field acts as a discriminator.

**Schema Definition** (from `server/src/models/issue-detail.ts`):

**Base Fields (Common to both types)**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| _id | String | Yes | Composite key: `userId + type + bookId` |
| recordType | String | Yes | Discriminator: "reservation" or "borrowedBook" |
| book | Object | Yes | Embedded book reference (Extended Reference Pattern) |
| book._id | String | Yes | Book ISBN |
| book.title | String | Yes | Book title |
| user | Object | Yes | Embedded user reference (Extended Reference Pattern) |
| user._id | ObjectId | Yes | User ObjectId |
| user.name | String | Yes | User name |

**Reservation-specific Fields**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| expirationDate | Date | Yes | When reservation expires (TTL index) |

**BorrowedBook-specific Fields**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| borrowDate | Date | Yes | When book was borrowed |
| dueDate | Date | Yes | When book is due |
| returnedDate | Date | No | When book was returned |
| returned | Boolean | Yes | Whether book has been returned |

**Composite Key Format**:
- Reservation: `{userId}R{bookId}` (e.g., `695c0a4a1f15c05b869c3c30R9780743273565`)
- Borrowed Book: `{userId}B{bookId}` (e.g., `695c0a4a1f15c05b869c3c30B9780743273565`)

**Duration Constants** (from `server/src/controllers/issue-details.ts`, lines 30-31):
- Reservation duration: 0.5 days (12 hours)
- Borrow duration: 21 days

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

**Sample Borrowed Book Document** (from code, no current data):

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
  "borrowDate": "2026-01-06T00:00:00.000Z",
  "dueDate": "2026-01-27T00:00:00.000Z",
  "returned": false
}
```

**All Current Issue Details**:

| Composite ID | Type | User | Book | Expiration/Due Date |
|--------------|------|------|------|---------------------|
| 695c0a4a1f15c05b869c3c30R9780743273565 | reservation | Luminous Rhino | The Great Gatsby | 2026-01-06T07:00:37.753Z |
| 695c0a4a1f15c05b869c3c32R9780451524935 | reservation | Rowdy Scorpion | 1984 | 2026-01-06T07:00:38.015Z |
| 695c0a4a1f15c05b869c3c2fR9780141439518 | reservation | Sneaky Quetzal | Pride and Prejudice | 2026-01-06T07:00:38.267Z |

### 4. Authors Collection

The `authors` collection stores author information with a reference to their books via ISBN array.

**Schema Definition** (from `server/src/models/author.ts`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| _id | ObjectId | Yes | Auto-generated unique identifier |
| name | String | Yes | Author's full name |
| sanitizedName | String | Yes | URL-friendly name slug |
| aliases | Array\<String\> | Yes | Alternative names |
| bio | String | No | Author biography |
| books | Array\<String\> | Yes | Array of ISBNs |

**Sample Documents**:

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

**All Authors in Database**:

| ObjectId | Name | Books (ISBNs) |
|----------|------|---------------|
| 695c0a4c0850c6486d5504c6 | F. Scott Fitzgerald | 9780743273565 |
| 695c0a4c0850c6486d5504c7 | Harper Lee | 9780061120084 |
| 695c0a4d0850c6486d5504c8 | George Orwell | 9780451524935, 9780452284234 |
| 695c0a4d0850c6486d5504c9 | Jane Austen | 9780141439518, 9780141439662 |
| 695c0a4d0850c6486d5504ca | J.D. Salinger | 9780316769174 |
| 695c0a4d0850c6486d5504cb | William Golding | 9780571056866 |
| 695c0a4d0850c6486d5504cc | J.K. Rowling | 9780439708180, 9780439064873 |
| 695c0a4d0850c6486d5504cd | Agatha Christie | 9780062073488, 9780062073471 |

### 5. Reviews Collection

The `reviews` collection stores all book reviews. Note that reviews are also embedded in books (subset pattern).

**Schema Definition** (from `server/src/models/review.ts`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| _id | ObjectId | Yes | Auto-generated unique identifier |
| text | String | Yes | Review text |
| name | String | Yes | Reviewer name |
| rating | Number | No | Rating (1-5) |
| timestamp | Number | Yes | Unix timestamp |
| bookId | String | Yes | ISBN of reviewed book |

**Sample Documents**:

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

## MongoDB-Specific Patterns

### 1. Computed Fields Pattern

The `available` field in books is computed at query time using aggregation pipelines rather than being stored directly.

**Implementation** (from `server/src/controllers/books.ts`, lines 42-76):

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
      available: {
        $subtract: ['$totalInventory', { $size: '$details' }]
      }
    }
  },
  { $unset: 'details' }
]).toArray();
```

### 2. Extended Reference Pattern

Both `issueDetails` and `books` use the extended reference pattern to embed frequently-accessed fields from related documents.

**In issueDetails**:
- `book` embeds `{ _id, title }` from books collection
- `user` embeds `{ _id, name }` from users collection

**In books**:
- `authors` embeds `{ _id, name }` from authors collection

### 3. Subset Pattern

Books embed up to 5 recent reviews directly in the document, while all reviews are also stored in the separate `reviews` collection.

**Embedded reviews in books** (omit `_id` and `bookId`):
```javascript
reviews: Array<Omit<Review, '_id' | 'bookId'>>
```

### 4. Polymorphic/Single-Collection Pattern

The `issueDetails` collection stores both reservations and borrowed books using a `recordType` discriminator field.

### 5. Composite String Keys

Issue details use composite string keys in format `userId + type + bookId`:
- Enables efficient regex queries: `db.issueDetails.find({ _id: /^userId/ })`
- Type indicators: `R` for reservation, `B` for borrowed book

### 6. Attribute Pattern

Books use an `attributes` array for flexible key-value pairs:
```javascript
attributes: Array<{ key: string; value: string }>
```

### 7. Atomic Operations

Inventory updates use MongoDB's `$inc` operator for atomic operations (from `server/src/controllers/books.ts`, lines 152-158):

```javascript
private updateBookInventory(bookId: string, count: number): Promise<UpdateResult> {
  const result = collections?.books?.updateOne(
    { _id: bookId },
    { $inc: { available: count } }
  );
  return result;
}
```

## Indexes

Currently, all collections only have the default `_id` index:

| Collection | Index Name | Key |
|------------|------------|-----|
| books | _id_ | { _id: 1 } |
| users | _id_ | { _id: 1 } |
| issueDetails | _id_ | { _id: 1 } |
| authors | _id_ | { _id: 1 } |
| reviews | _id_ | { _id: 1 } |

## Relationships Summary

```
books (ISBN) <---> authors (ObjectId)
    |                   |
    |                   +-- books[] (array of ISBNs)
    |
    +-- authors[] (embedded {_id, name})
    +-- reviews[] (embedded subset)
    |
    v
reviews (ObjectId)
    +-- bookId (ISBN reference)

users (ObjectId) <---> issueDetails (composite string)
                            |
                            +-- user (embedded {_id, name})
                            +-- book (embedded {_id, title})
```
