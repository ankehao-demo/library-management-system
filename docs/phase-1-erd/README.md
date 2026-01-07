# Phase 1 ERD Diagrams

This directory contains programmatically generated Entity-Relationship Diagrams (ERDs) for the MongoDB to Postgres migration planning.

## Contents

| File | Description |
|------|-------------|
| `generate_erd.py` | Python script to generate ERD diagrams |
| `mongodb_current_schema.png` | Current MongoDB schema visualization (PNG) |
| `mongodb_current_schema.svg` | Current MongoDB schema visualization (SVG) |
| `postgres_proposed_schema.png` | Proposed Postgres schema visualization (PNG) |
| `postgres_proposed_schema.svg` | Proposed Postgres schema visualization (SVG) |

## Regenerating Diagrams

To regenerate the ERD diagrams, ensure you have Python 3 and Graphviz installed:

```bash
# Install Graphviz (Ubuntu/Debian)
sudo apt-get install graphviz

# Install Python graphviz library
pip install graphviz

# Generate diagrams
python3 generate_erd.py
```

## Diagram Descriptions

### MongoDB Current Schema

Shows the current MongoDB collections and their relationships:
- **books** - Book catalog with embedded reviews and author references
- **users** - User accounts with admin flag
- **authors** - Author information with book ISBNs
- **reviews** - Standalone review collection
- **issueDetails** - Polymorphic collection for reservations and borrowed books

Key patterns visualized:
- Embedded documents (dotted lines)
- Denormalized references (dashed lines)
- Direct references (solid lines)
- Computed fields (italic)

### Postgres Proposed Schema

Shows the normalized Postgres schema with:
- Proper foreign key relationships
- Junction tables for many-to-many relationships
- Separate tables for reservations and borrowed_books
- Database view for computed availability

Color coding:
- Blue: Book-related tables
- Green: User-related tables
- Yellow: Author-related tables
- Purple: Review-related tables
- Red/Pink: Issue tracking tables (reservations, borrowed_books)
- Gray: Database views
