#!/usr/bin/env python3
"""
ERD Generator for Library Management System Migration

This script generates Entity-Relationship Diagrams (ERDs) for both the
current MongoDB schema and the proposed PostgreSQL schema using Graphviz.

Usage:
    python generate_erd.py

Output:
    - mongodb_erd.png: Current MongoDB schema visualization
    - postgres_erd.png: Proposed PostgreSQL schema visualization
"""

from graphviz import Digraph
import os

OUTPUT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def escape_html(text: str) -> str:
    """Escape special characters for HTML/Graphviz labels."""
    return (text
            .replace('&', '&amp;')
            .replace('<', '&lt;')
            .replace('>', '&gt;')
            .replace('{', '&#123;')
            .replace('}', '&#125;'))


def create_table_html(name: str, columns: list[tuple[str, str, str]], color: str = "#E8E8E8") -> str:
    """
    Create an HTML-like label for a table node.
    
    Args:
        name: Table name
        columns: List of (column_name, data_type, constraints) tuples
        color: Background color for the header
    
    Returns:
        HTML-like string for graphviz label
    """
    rows = []
    for col_name, col_type, constraints in columns:
        escaped_type = escape_html(col_type)
        escaped_constraints = escape_html(constraints) if constraints else ""
        constraint_str = f" <font color='#666666'><i>{escaped_constraints}</i></font>" if escaped_constraints else ""
        rows.append(f'<tr><td align="left" port="{col_name}">{col_name}</td>'
                   f'<td align="left"><font color="#666666">{escaped_type}</font>{constraint_str}</td></tr>')
    
    return f'''<<table border="0" cellborder="1" cellspacing="0" cellpadding="4">
        <tr><td colspan="2" bgcolor="{color}"><b>{name}</b></td></tr>
        {''.join(rows)}
    </table>>'''


def generate_mongodb_erd():
    """Generate ERD for current MongoDB schema."""
    dot = Digraph('MongoDB Schema', format='png')
    dot.attr(rankdir='TB', splines='spline', nodesep='0.8', ranksep='1.0')
    dot.attr('node', shape='none', fontname='Helvetica')
    dot.attr('edge', fontname='Helvetica', fontsize='10')
    
    # Books collection
    books_cols = [
        ('_id', 'string', 'PK (ISBN)'),
        ('title', 'string', ''),
        ('year', 'number', ''),
        ('cover', 'string?', ''),
        ('genres', 'string[]', ''),
        ('pages', 'number?', ''),
        ('synopsis', 'string?', ''),
        ('publisher', 'string?', ''),
        ('totalInventory', 'number', ''),
        ('available', 'number', 'computed'),
        ('authors', 'Array<{_id, name}>', 'embedded'),
        ('attributes', 'Array<{key, value}>', 'embedded'),
        ('reviews', 'Array<Review>', 'embedded subset'),
    ]
    dot.node('books', create_table_html('books', books_cols, '#B8D4E8'))
    
    # Users collection
    users_cols = [
        ('_id', 'ObjectId', 'PK'),
        ('name', 'string', 'min 5 chars'),
        ('isAdmin', 'boolean?', ''),
    ]
    dot.node('users', create_table_html('users', users_cols, '#D4E8B8'))
    
    # IssueDetails collection (polymorphic)
    issue_cols = [
        ('_id', 'string', 'PK (composite)'),
        ('recordType', 'string', 'discriminator'),
        ('book', '{_id, title}', 'embedded ref'),
        ('user', '{_id, name}', 'embedded ref'),
        ('expirationDate', 'Date?', 'reservation'),
        ('borrowDate', 'Date?', 'borrowedBook'),
        ('dueDate', 'Date?', 'borrowedBook'),
        ('returnedDate', 'Date?', 'borrowedBook'),
        ('returned', 'boolean?', 'borrowedBook'),
    ]
    dot.node('issueDetails', create_table_html('issueDetails (polymorphic)', issue_cols, '#E8D4B8'))
    
    # Authors collection
    authors_cols = [
        ('_id', 'ObjectId', 'PK'),
        ('name', 'string', ''),
        ('sanitizedName', 'string', ''),
        ('aliases', 'string[]', ''),
        ('bio', 'string?', ''),
        ('books', 'string[]', 'ISBN refs'),
    ]
    dot.node('authors', create_table_html('authors', authors_cols, '#E8B8D4'))
    
    # Reviews collection
    reviews_cols = [
        ('_id', 'ObjectId', 'PK'),
        ('bookId', 'string', 'ISBN ref'),
        ('name', 'string', ''),
        ('text', 'string', ''),
        ('rating', 'number?', ''),
        ('timestamp', 'number', ''),
    ]
    dot.node('reviews', create_table_html('reviews', reviews_cols, '#D4B8E8'))
    
    # Relationships (denormalized references)
    dot.edge('issueDetails:book', 'books:_id', label='book._id', style='dashed', color='#666666')
    dot.edge('issueDetails:user', 'users:_id', label='user._id', style='dashed', color='#666666')
    dot.edge('reviews:bookId', 'books:_id', label='bookId', style='dashed', color='#666666')
    dot.edge('authors:books', 'books:_id', label='books[]', style='dashed', color='#666666')
    dot.edge('books:authors', 'authors:_id', label='authors[]._id', style='dashed', color='#666666')
    
    # Add legend
    with dot.subgraph(name='cluster_legend') as legend:
        legend.attr(label='Legend', style='rounded', color='#CCCCCC')
        legend.node('leg1', '<<table border="0"><tr><td>Dashed lines = denormalized references</td></tr>'
                   '<tr><td>Embedded = data stored within document</td></tr>'
                   '<tr><td>Composite PK = userId + type + bookId</td></tr></table>>', shape='none')
    
    output_path = os.path.join(OUTPUT_DIR, 'mongodb_erd')
    dot.render(output_path, cleanup=True)
    print(f"Generated: {output_path}.png")
    return output_path + '.png'


def generate_postgres_erd():
    """Generate ERD for proposed PostgreSQL schema."""
    dot = Digraph('PostgreSQL Schema', format='png')
    dot.attr(rankdir='TB', splines='spline', nodesep='0.5', ranksep='0.8')
    dot.attr('node', shape='none', fontname='Helvetica')
    dot.attr('edge', fontname='Helvetica', fontsize='9')
    
    # Books table
    books_cols = [
        ('isbn', 'VARCHAR(13)', 'PK'),
        ('title', 'VARCHAR(500)', 'NOT NULL'),
        ('year', 'INTEGER', 'NOT NULL'),
        ('cover_url', 'TEXT', ''),
        ('pages', 'INTEGER', ''),
        ('synopsis', 'TEXT', ''),
        ('publisher', 'VARCHAR(255)', ''),
        ('long_title', 'VARCHAR(1000)', ''),
        ('language', 'VARCHAR(50)', ''),
        ('binding', 'VARCHAR(50)', ''),
        ('total_inventory', 'INTEGER', 'NOT NULL'),
        ('available', 'INTEGER', 'trigger-maintained'),
        ('book_of_the_month', 'BOOLEAN', ''),
        ('created_at', 'TIMESTAMPTZ', ''),
        ('updated_at', 'TIMESTAMPTZ', ''),
    ]
    dot.node('books', create_table_html('books', books_cols, '#B8D4E8'))
    
    # Book attributes table
    book_attrs_cols = [
        ('id', 'SERIAL', 'PK'),
        ('book_isbn', 'VARCHAR(13)', 'FK'),
        ('key', 'VARCHAR(100)', 'NOT NULL'),
        ('value', 'TEXT', 'NOT NULL'),
    ]
    dot.node('book_attributes', create_table_html('book_attributes', book_attrs_cols, '#C8D8E8'))
    
    # Book genres table
    book_genres_cols = [
        ('id', 'SERIAL', 'PK'),
        ('book_isbn', 'VARCHAR(13)', 'FK'),
        ('genre', 'VARCHAR(100)', 'NOT NULL'),
    ]
    dot.node('book_genres', create_table_html('book_genres', book_genres_cols, '#C8D8E8'))
    
    # Users table
    users_cols = [
        ('id', 'UUID', 'PK'),
        ('name', 'VARCHAR(255)', 'NOT NULL, CHECK'),
        ('is_admin', 'BOOLEAN', 'DEFAULT FALSE'),
        ('created_at', 'TIMESTAMPTZ', ''),
        ('updated_at', 'TIMESTAMPTZ', ''),
    ]
    dot.node('users', create_table_html('users', users_cols, '#D4E8B8'))
    
    # Authors table
    authors_cols = [
        ('id', 'UUID', 'PK'),
        ('name', 'VARCHAR(255)', 'NOT NULL'),
        ('sanitized_name', 'VARCHAR(255)', 'UNIQUE'),
        ('bio', 'TEXT', ''),
        ('created_at', 'TIMESTAMPTZ', ''),
        ('updated_at', 'TIMESTAMPTZ', ''),
    ]
    dot.node('authors', create_table_html('authors', authors_cols, '#E8B8D4'))
    
    # Author aliases table
    author_aliases_cols = [
        ('id', 'SERIAL', 'PK'),
        ('author_id', 'UUID', 'FK'),
        ('alias', 'VARCHAR(255)', 'NOT NULL'),
    ]
    dot.node('author_aliases', create_table_html('author_aliases', author_aliases_cols, '#E8C8D8'))
    
    # Book authors junction table
    book_authors_cols = [
        ('book_isbn', 'VARCHAR(13)', 'PK, FK'),
        ('author_id', 'UUID', 'PK, FK'),
    ]
    dot.node('book_authors', create_table_html('book_authors', book_authors_cols, '#D8C8E8'))
    
    # Reviews table
    reviews_cols = [
        ('id', 'UUID', 'PK'),
        ('book_isbn', 'VARCHAR(13)', 'FK'),
        ('reviewer_name', 'VARCHAR(255)', 'NOT NULL'),
        ('text', 'TEXT', 'NOT NULL'),
        ('rating', 'INTEGER', 'CHECK 1-5'),
        ('created_at', 'TIMESTAMPTZ', ''),
    ]
    dot.node('reviews', create_table_html('reviews', reviews_cols, '#D4B8E8'))
    
    # Reservations table
    reservations_cols = [
        ('id', 'UUID', 'PK'),
        ('user_id', 'UUID', 'FK'),
        ('book_isbn', 'VARCHAR(13)', 'FK'),
        ('expiration_date', 'TIMESTAMPTZ', 'NOT NULL'),
        ('created_at', 'TIMESTAMPTZ', ''),
    ]
    dot.node('reservations', create_table_html('reservations', reservations_cols, '#E8D4B8'))
    
    # Borrowed books table
    borrowed_books_cols = [
        ('id', 'UUID', 'PK'),
        ('user_id', 'UUID', 'FK'),
        ('book_isbn', 'VARCHAR(13)', 'FK'),
        ('borrow_date', 'TIMESTAMPTZ', 'NOT NULL'),
        ('due_date', 'TIMESTAMPTZ', 'NOT NULL'),
        ('returned_date', 'TIMESTAMPTZ', ''),
        ('returned', 'BOOLEAN', 'NOT NULL'),
        ('created_at', 'TIMESTAMPTZ', ''),
        ('updated_at', 'TIMESTAMPTZ', ''),
    ]
    dot.node('borrowed_books', create_table_html('borrowed_books', borrowed_books_cols, '#E8D4B8'))
    
    # Foreign key relationships
    dot.edge('book_attributes:book_isbn', 'books:isbn', label='FK', color='#0066CC')
    dot.edge('book_genres:book_isbn', 'books:isbn', label='FK', color='#0066CC')
    dot.edge('book_authors:book_isbn', 'books:isbn', label='FK', color='#0066CC')
    dot.edge('book_authors:author_id', 'authors:id', label='FK', color='#0066CC')
    dot.edge('author_aliases:author_id', 'authors:id', label='FK', color='#0066CC')
    dot.edge('reviews:book_isbn', 'books:isbn', label='FK', color='#0066CC')
    dot.edge('reservations:user_id', 'users:id', label='FK', color='#0066CC')
    dot.edge('reservations:book_isbn', 'books:isbn', label='FK', color='#0066CC')
    dot.edge('borrowed_books:user_id', 'users:id', label='FK', color='#0066CC')
    dot.edge('borrowed_books:book_isbn', 'books:isbn', label='FK', color='#0066CC')
    
    # Add legend
    with dot.subgraph(name='cluster_legend') as legend:
        legend.attr(label='Legend', style='rounded', color='#CCCCCC')
        legend.node('leg1', '<<table border="0"><tr><td>Blue lines = Foreign Key constraints</td></tr>'
                   '<tr><td>PK = Primary Key</td></tr>'
                   '<tr><td>FK = Foreign Key</td></tr></table>>', shape='none')
    
    output_path = os.path.join(OUTPUT_DIR, 'postgres_erd')
    dot.render(output_path, cleanup=True)
    print(f"Generated: {output_path}.png")
    return output_path + '.png'


def generate_comparison_erd():
    """Generate a side-by-side comparison diagram."""
    dot = Digraph('Schema Comparison', format='png')
    dot.attr(rankdir='LR', splines='line', nodesep='1.0', ranksep='2.0')
    dot.attr('node', shape='box', fontname='Helvetica', style='rounded')
    
    # MongoDB subgraph
    with dot.subgraph(name='cluster_mongodb') as mongo:
        mongo.attr(label='Current MongoDB Schema', style='rounded,filled', 
                  fillcolor='#FFF8E8', color='#CC9900')
        mongo.node('m_books', 'books\n(ISBN as _id)\n+ embedded reviews\n+ embedded authors', 
                  fillcolor='#B8D4E8', style='filled,rounded')
        mongo.node('m_users', 'users\n(ObjectId)', fillcolor='#D4E8B8', style='filled,rounded')
        mongo.node('m_issueDetails', 'issueDetails\n(polymorphic)\nreservations + borrows\ncomposite string key', 
                  fillcolor='#E8D4B8', style='filled,rounded')
        mongo.node('m_authors', 'authors\n(ObjectId)\n+ books[] array', fillcolor='#E8B8D4', style='filled,rounded')
        mongo.node('m_reviews', 'reviews\n(ObjectId)\n+ bookId ref', fillcolor='#D4B8E8', style='filled,rounded')
    
    # PostgreSQL subgraph
    with dot.subgraph(name='cluster_postgres') as pg:
        pg.attr(label='Proposed PostgreSQL Schema', style='rounded,filled', 
               fillcolor='#E8F8FF', color='#0066CC')
        pg.node('p_books', 'books\n(ISBN PK)', fillcolor='#B8D4E8', style='filled,rounded')
        pg.node('p_book_attrs', 'book_attributes', fillcolor='#C8D8E8', style='filled,rounded')
        pg.node('p_book_genres', 'book_genres', fillcolor='#C8D8E8', style='filled,rounded')
        pg.node('p_users', 'users\n(UUID PK)', fillcolor='#D4E8B8', style='filled,rounded')
        pg.node('p_authors', 'authors\n(UUID PK)', fillcolor='#E8B8D4', style='filled,rounded')
        pg.node('p_author_aliases', 'author_aliases', fillcolor='#E8C8D8', style='filled,rounded')
        pg.node('p_book_authors', 'book_authors\n(junction)', fillcolor='#D8C8E8', style='filled,rounded')
        pg.node('p_reviews', 'reviews\n(UUID PK)', fillcolor='#D4B8E8', style='filled,rounded')
        pg.node('p_reservations', 'reservations\n(UUID PK)', fillcolor='#E8D4B8', style='filled,rounded')
        pg.node('p_borrowed', 'borrowed_books\n(UUID PK)', fillcolor='#E8D4B8', style='filled,rounded')
    
    # Migration arrows
    dot.edge('m_books', 'p_books', label='normalize', style='dashed', color='#666666')
    dot.edge('m_books', 'p_book_attrs', label='extract', style='dashed', color='#666666')
    dot.edge('m_books', 'p_book_genres', label='extract', style='dashed', color='#666666')
    dot.edge('m_users', 'p_users', label='map ObjectId->UUID', style='dashed', color='#666666')
    dot.edge('m_authors', 'p_authors', label='normalize', style='dashed', color='#666666')
    dot.edge('m_authors', 'p_author_aliases', label='extract', style='dashed', color='#666666')
    dot.edge('m_authors', 'p_book_authors', label='junction', style='dashed', color='#666666')
    dot.edge('m_reviews', 'p_reviews', label='add FK', style='dashed', color='#666666')
    dot.edge('m_issueDetails', 'p_reservations', label='split', style='dashed', color='#666666')
    dot.edge('m_issueDetails', 'p_borrowed', label='split', style='dashed', color='#666666')
    
    output_path = os.path.join(OUTPUT_DIR, 'schema_comparison')
    dot.render(output_path, cleanup=True)
    print(f"Generated: {output_path}.png")
    return output_path + '.png'


def main():
    """Generate all ERD diagrams."""
    print("Generating ERD diagrams for Library Management System migration...\n")
    
    mongodb_path = generate_mongodb_erd()
    postgres_path = generate_postgres_erd()
    comparison_path = generate_comparison_erd()
    
    print(f"\nAll diagrams generated successfully!")
    print(f"\nOutput files:")
    print(f"  - {mongodb_path}")
    print(f"  - {postgres_path}")
    print(f"  - {comparison_path}")


if __name__ == '__main__':
    main()
