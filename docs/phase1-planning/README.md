# Phase 1: MongoDB to PostgreSQL Migration Planning

This directory contains the planning documentation for migrating the Library Management System from MongoDB to PostgreSQL/Supabase.

## Contents

### Documentation

1. **[01-mongodb-current-schema.md](./01-mongodb-current-schema.md)** - Comprehensive documentation of the current MongoDB schema including:
   - All 5 collections with field definitions
   - Sample documents from the actual database
   - MongoDB-specific patterns (computed fields, embedded documents, polymorphic collections, etc.)
   - Current indexes and relationships

2. **[02-postgres-schema-design.md](./02-postgres-schema-design.md)** - Proposed PostgreSQL schema design including:
   - 10 normalized tables with SQL CREATE statements
   - Foreign key relationships
   - Index recommendations
   - Computed availability field implementation options
   - Query migration examples

3. **[03-migration-considerations.md](./03-migration-considerations.md)** - Migration challenges and recommendations including:
   - Data migration challenges (key transformation, polymorphic split, etc.)
   - Application code changes required
   - Data integrity considerations
   - Performance optimization strategies
   - Risk assessment and rollback strategy

### ERD Diagrams

Generated programmatically using Graphviz:

- **[mongodb-current-erd.png](./mongodb-current-erd.png)** - Visual representation of current MongoDB schema
- **[postgres-proposed-erd.png](./postgres-proposed-erd.png)** - Visual representation of proposed PostgreSQL schema
- **[migration-comparison.png](./migration-comparison.png)** - Side-by-side comparison showing schema transformation

### Scripts

- **[scripts/generate_erd.py](./scripts/generate_erd.py)** - Python script to regenerate ERD diagrams

## Schema Transformation Summary

| MongoDB | PostgreSQL | Transformation |
|---------|------------|----------------|
| books (12 docs) | books, book_genres, book_attributes | Split embedded arrays |
| users (9 docs) | users | ObjectId to UUID |
| issueDetails (3 docs) | reservations, borrowed_books | Split polymorphic collection |
| authors (8 docs) | authors, author_aliases, book_authors | Normalize arrays, add junction table |
| reviews (28 docs) | reviews | Add foreign key constraint |

## Key Migration Challenges

1. **Composite String Keys**: Parse `userId + type + bookId` format into proper foreign keys
2. **Polymorphic Collection**: Split `issueDetails` into `reservations` and `borrowed_books`
3. **Computed Fields**: Implement `available` field via database view or triggers
4. **Embedded Documents**: Extract to normalized tables while maintaining relationships
5. **ID Mapping**: Track MongoDB ObjectIds to new PostgreSQL UUIDs

## Regenerating ERD Diagrams

To regenerate the ERD diagrams:

```bash
cd docs/phase1-planning
python3 scripts/generate_erd.py
```

Requirements:
- Python 3.x
- graphviz Python package (`pip install graphviz`)
- Graphviz system package (`apt install graphviz`)

## Next Phases

- **Phase 2**: Create PostgreSQL schema in Supabase
- **Phase 3**: Develop and test migration scripts
- **Phase 4**: Migrate application code
- **Phase 5**: Execute migration and cutover
