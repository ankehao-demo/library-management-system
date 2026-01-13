#!/usr/bin/env python3
"""
ERD Generator for Library Management System Migration

This script generates Entity-Relationship Diagrams (ERDs) for:
1. Current MongoDB schema (document-based representation)
2. Proposed PostgreSQL schema (normalized relational design)

Uses Graphviz for diagram generation.
"""

import graphviz
import os

OUTPUT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def create_mongodb_erd():
    """Generate ERD representing current MongoDB schema."""
    
    dot = graphviz.Digraph(
        'MongoDB_Schema',
        comment='Current MongoDB Schema - Library Management System',
        format='png',
        engine='dot'
    )
    
    dot.attr(rankdir='TB', splines='ortho', nodesep='0.8', ranksep='1.2')
    dot.attr('node', shape='none', fontname='Helvetica')
    dot.attr('edge', fontname='Helvetica', fontsize='10')
    
    # Books Collection
    books_label = '''<<TABLE BORDER="1" CELLBORDER="1" CELLSPACING="0" CELLPADDING="4" BGCOLOR="#E8F4FD">
        <TR><TD COLSPAN="2" BGCOLOR="#2196F3"><FONT COLOR="white"><B>books</B></FONT></TD></TR>
        <TR><TD ALIGN="LEFT"><B>_id</B></TD><TD ALIGN="LEFT">String (ISBN) PK</TD></TR>
        <TR><TD ALIGN="LEFT">title</TD><TD ALIGN="LEFT">String</TD></TR>
        <TR><TD ALIGN="LEFT">year</TD><TD ALIGN="LEFT">Number</TD></TR>
        <TR><TD ALIGN="LEFT">cover</TD><TD ALIGN="LEFT">String?</TD></TR>
        <TR><TD ALIGN="LEFT">genres</TD><TD ALIGN="LEFT">Array&lt;String&gt;</TD></TR>
        <TR><TD ALIGN="LEFT">pages</TD><TD ALIGN="LEFT">Number?</TD></TR>
        <TR><TD ALIGN="LEFT">synopsis</TD><TD ALIGN="LEFT">String?</TD></TR>
        <TR><TD ALIGN="LEFT">publisher</TD><TD ALIGN="LEFT">String?</TD></TR>
        <TR><TD ALIGN="LEFT">language</TD><TD ALIGN="LEFT">String?</TD></TR>
        <TR><TD ALIGN="LEFT">totalInventory</TD><TD ALIGN="LEFT">Number</TD></TR>
        <TR><TD ALIGN="LEFT"><I>available</I></TD><TD ALIGN="LEFT"><I>Number (computed)</I></TD></TR>
        <TR><TD ALIGN="LEFT" BGCOLOR="#FFF3E0">authors[]</TD><TD ALIGN="LEFT" BGCOLOR="#FFF3E0">Embedded {_id, name}</TD></TR>
        <TR><TD ALIGN="LEFT" BGCOLOR="#FFF3E0">attributes[]</TD><TD ALIGN="LEFT" BGCOLOR="#FFF3E0">Embedded {key, value}</TD></TR>
        <TR><TD ALIGN="LEFT" BGCOLOR="#FFF3E0">reviews[]</TD><TD ALIGN="LEFT" BGCOLOR="#FFF3E0">Embedded (subset)</TD></TR>
    </TABLE>>'''
    dot.node('books', books_label)
    
    # Users Collection
    users_label = '''<<TABLE BORDER="1" CELLBORDER="1" CELLSPACING="0" CELLPADDING="4" BGCOLOR="#E8F5E9">
        <TR><TD COLSPAN="2" BGCOLOR="#4CAF50"><FONT COLOR="white"><B>users</B></FONT></TD></TR>
        <TR><TD ALIGN="LEFT"><B>_id</B></TD><TD ALIGN="LEFT">ObjectId PK</TD></TR>
        <TR><TD ALIGN="LEFT">name</TD><TD ALIGN="LEFT">String (min 5 chars)</TD></TR>
        <TR><TD ALIGN="LEFT">isAdmin</TD><TD ALIGN="LEFT">Boolean?</TD></TR>
    </TABLE>>'''
    dot.node('users', users_label)
    
    # IssueDetails Collection (Polymorphic)
    issue_label = '''<<TABLE BORDER="1" CELLBORDER="1" CELLSPACING="0" CELLPADDING="4" BGCOLOR="#FFF3E0">
        <TR><TD COLSPAN="2" BGCOLOR="#FF9800"><FONT COLOR="white"><B>issueDetails (Polymorphic)</B></FONT></TD></TR>
        <TR><TD ALIGN="LEFT"><B>_id</B></TD><TD ALIGN="LEFT">String (userId+type+bookId)</TD></TR>
        <TR><TD ALIGN="LEFT">recordType</TD><TD ALIGN="LEFT">"reservation" | "borrowedBook"</TD></TR>
        <TR><TD ALIGN="LEFT" BGCOLOR="#E3F2FD">book</TD><TD ALIGN="LEFT" BGCOLOR="#E3F2FD">Embedded {_id, title}</TD></TR>
        <TR><TD ALIGN="LEFT" BGCOLOR="#E8F5E9">user</TD><TD ALIGN="LEFT" BGCOLOR="#E8F5E9">Embedded {_id, name}</TD></TR>
        <TR><TD COLSPAN="2" BGCOLOR="#FFECB3"><I>Reservation fields:</I></TD></TR>
        <TR><TD ALIGN="LEFT">expirationDate</TD><TD ALIGN="LEFT">Date (TTL)</TD></TR>
        <TR><TD COLSPAN="2" BGCOLOR="#FFECB3"><I>BorrowedBook fields:</I></TD></TR>
        <TR><TD ALIGN="LEFT">borrowDate</TD><TD ALIGN="LEFT">Date</TD></TR>
        <TR><TD ALIGN="LEFT">dueDate</TD><TD ALIGN="LEFT">Date</TD></TR>
        <TR><TD ALIGN="LEFT">returnedDate</TD><TD ALIGN="LEFT">Date?</TD></TR>
        <TR><TD ALIGN="LEFT">returned</TD><TD ALIGN="LEFT">Boolean</TD></TR>
    </TABLE>>'''
    dot.node('issueDetails', issue_label)
    
    # Authors Collection
    authors_label = '''<<TABLE BORDER="1" CELLBORDER="1" CELLSPACING="0" CELLPADDING="4" BGCOLOR="#F3E5F5">
        <TR><TD COLSPAN="2" BGCOLOR="#9C27B0"><FONT COLOR="white"><B>authors</B></FONT></TD></TR>
        <TR><TD ALIGN="LEFT"><B>_id</B></TD><TD ALIGN="LEFT">ObjectId PK</TD></TR>
        <TR><TD ALIGN="LEFT">name</TD><TD ALIGN="LEFT">String</TD></TR>
        <TR><TD ALIGN="LEFT">sanitizedName</TD><TD ALIGN="LEFT">String</TD></TR>
        <TR><TD ALIGN="LEFT">aliases</TD><TD ALIGN="LEFT">Array&lt;String&gt;</TD></TR>
        <TR><TD ALIGN="LEFT">bio</TD><TD ALIGN="LEFT">String?</TD></TR>
        <TR><TD ALIGN="LEFT" BGCOLOR="#E3F2FD">books[]</TD><TD ALIGN="LEFT" BGCOLOR="#E3F2FD">Array&lt;ISBN&gt;</TD></TR>
    </TABLE>>'''
    dot.node('authors', authors_label)
    
    # Reviews Collection
    reviews_label = '''<<TABLE BORDER="1" CELLBORDER="1" CELLSPACING="0" CELLPADDING="4" BGCOLOR="#FFEBEE">
        <TR><TD COLSPAN="2" BGCOLOR="#F44336"><FONT COLOR="white"><B>reviews</B></FONT></TD></TR>
        <TR><TD ALIGN="LEFT"><B>_id</B></TD><TD ALIGN="LEFT">ObjectId PK</TD></TR>
        <TR><TD ALIGN="LEFT">text</TD><TD ALIGN="LEFT">String</TD></TR>
        <TR><TD ALIGN="LEFT">name</TD><TD ALIGN="LEFT">String</TD></TR>
        <TR><TD ALIGN="LEFT">rating</TD><TD ALIGN="LEFT">Number?</TD></TR>
        <TR><TD ALIGN="LEFT">timestamp</TD><TD ALIGN="LEFT">Number</TD></TR>
        <TR><TD ALIGN="LEFT" BGCOLOR="#E3F2FD">bookId</TD><TD ALIGN="LEFT" BGCOLOR="#E3F2FD">String (ISBN)</TD></TR>
    </TABLE>>'''
    dot.node('reviews', reviews_label)
    
    # Relationships
    dot.edge('books', 'authors', label='authors[] embeds\n{_id, name}', style='dashed', color='#9C27B0')
    dot.edge('authors', 'books', label='books[] references\nISBNs', style='dashed', color='#2196F3')
    dot.edge('reviews', 'books', label='bookId references\nISBN', color='#F44336')
    dot.edge('books', 'reviews', label='reviews[] embeds\nsubset', style='dashed', color='#F44336')
    dot.edge('issueDetails', 'books', label='book embeds\n{_id, title}', style='dashed', color='#2196F3')
    dot.edge('issueDetails', 'users', label='user embeds\n{_id, name}', style='dashed', color='#4CAF50')
    
    # Legend
    with dot.subgraph(name='cluster_legend') as legend:
        legend.attr(label='Legend', style='rounded', bgcolor='#FAFAFA')
        legend.node('leg1', '<<TABLE BORDER="0" CELLBORDER="0"><TR><TD>Solid line: Foreign key reference</TD></TR></TABLE>>', shape='none')
        legend.node('leg2', '<<TABLE BORDER="0" CELLBORDER="0"><TR><TD>Dashed line: Embedded/denormalized data</TD></TR></TABLE>>', shape='none')
        legend.node('leg3', '<<TABLE BORDER="0" CELLBORDER="0"><TR><TD BGCOLOR="#FFF3E0">Orange: Embedded arrays</TD></TR></TABLE>>', shape='none')
        legend.node('leg4', '<<TABLE BORDER="0" CELLBORDER="0"><TR><TD><I>Italic: Computed field</I></TD></TR></TABLE>>', shape='none')
    
    # Title
    dot.attr(label='\\nCurrent MongoDB Schema - Library Management System\\n', labelloc='t', fontsize='20')
    
    output_path = os.path.join(OUTPUT_DIR, 'mongodb-current-erd')
    dot.render(output_path, cleanup=True)
    print(f"Generated: {output_path}.png")
    return output_path


def create_postgres_erd():
    """Generate ERD for proposed PostgreSQL schema."""
    
    dot = graphviz.Digraph(
        'PostgreSQL_Schema',
        comment='Proposed PostgreSQL Schema - Library Management System',
        format='png',
        engine='dot'
    )
    
    dot.attr(rankdir='TB', splines='ortho', nodesep='0.6', ranksep='0.8')
    dot.attr('node', shape='none', fontname='Helvetica')
    dot.attr('edge', fontname='Helvetica', fontsize='9')
    
    # Books Table
    books_label = '''<<TABLE BORDER="1" CELLBORDER="1" CELLSPACING="0" CELLPADDING="3" BGCOLOR="#E8F4FD">
        <TR><TD COLSPAN="3" BGCOLOR="#2196F3"><FONT COLOR="white"><B>books</B></FONT></TD></TR>
        <TR><TD ALIGN="LEFT"><B>isbn</B></TD><TD ALIGN="LEFT">VARCHAR(13)</TD><TD>PK</TD></TR>
        <TR><TD ALIGN="LEFT">title</TD><TD ALIGN="LEFT">VARCHAR(500)</TD><TD>NOT NULL</TD></TR>
        <TR><TD ALIGN="LEFT">year</TD><TD ALIGN="LEFT">INTEGER</TD><TD>NOT NULL</TD></TR>
        <TR><TD ALIGN="LEFT">cover_url</TD><TD ALIGN="LEFT">TEXT</TD><TD></TD></TR>
        <TR><TD ALIGN="LEFT">pages</TD><TD ALIGN="LEFT">INTEGER</TD><TD></TD></TR>
        <TR><TD ALIGN="LEFT">synopsis</TD><TD ALIGN="LEFT">TEXT</TD><TD></TD></TR>
        <TR><TD ALIGN="LEFT">publisher</TD><TD ALIGN="LEFT">VARCHAR(255)</TD><TD></TD></TR>
        <TR><TD ALIGN="LEFT">long_title</TD><TD ALIGN="LEFT">VARCHAR(1000)</TD><TD></TD></TR>
        <TR><TD ALIGN="LEFT">language</TD><TD ALIGN="LEFT">VARCHAR(50)</TD><TD></TD></TR>
        <TR><TD ALIGN="LEFT">binding</TD><TD ALIGN="LEFT">VARCHAR(50)</TD><TD></TD></TR>
        <TR><TD ALIGN="LEFT">total_inventory</TD><TD ALIGN="LEFT">INTEGER</TD><TD>NOT NULL</TD></TR>
        <TR><TD ALIGN="LEFT">book_of_the_month</TD><TD ALIGN="LEFT">BOOLEAN</TD><TD></TD></TR>
        <TR><TD ALIGN="LEFT">created_at</TD><TD ALIGN="LEFT">TIMESTAMPTZ</TD><TD></TD></TR>
        <TR><TD ALIGN="LEFT">updated_at</TD><TD ALIGN="LEFT">TIMESTAMPTZ</TD><TD></TD></TR>
    </TABLE>>'''
    dot.node('books', books_label)
    
    # Book Genres Table
    genres_label = '''<<TABLE BORDER="1" CELLBORDER="1" CELLSPACING="0" CELLPADDING="3" BGCOLOR="#E8F4FD">
        <TR><TD COLSPAN="3" BGCOLOR="#64B5F6"><FONT COLOR="white"><B>book_genres</B></FONT></TD></TR>
        <TR><TD ALIGN="LEFT"><B>id</B></TD><TD ALIGN="LEFT">SERIAL</TD><TD>PK</TD></TR>
        <TR><TD ALIGN="LEFT">book_isbn</TD><TD ALIGN="LEFT">VARCHAR(13)</TD><TD>FK</TD></TR>
        <TR><TD ALIGN="LEFT">genre</TD><TD ALIGN="LEFT">VARCHAR(100)</TD><TD>NOT NULL</TD></TR>
    </TABLE>>'''
    dot.node('book_genres', genres_label)
    
    # Book Attributes Table
    attrs_label = '''<<TABLE BORDER="1" CELLBORDER="1" CELLSPACING="0" CELLPADDING="3" BGCOLOR="#E8F4FD">
        <TR><TD COLSPAN="3" BGCOLOR="#64B5F6"><FONT COLOR="white"><B>book_attributes</B></FONT></TD></TR>
        <TR><TD ALIGN="LEFT"><B>id</B></TD><TD ALIGN="LEFT">SERIAL</TD><TD>PK</TD></TR>
        <TR><TD ALIGN="LEFT">book_isbn</TD><TD ALIGN="LEFT">VARCHAR(13)</TD><TD>FK</TD></TR>
        <TR><TD ALIGN="LEFT">key</TD><TD ALIGN="LEFT">VARCHAR(100)</TD><TD>NOT NULL</TD></TR>
        <TR><TD ALIGN="LEFT">value</TD><TD ALIGN="LEFT">TEXT</TD><TD>NOT NULL</TD></TR>
    </TABLE>>'''
    dot.node('book_attributes', attrs_label)
    
    # Users Table
    users_label = '''<<TABLE BORDER="1" CELLBORDER="1" CELLSPACING="0" CELLPADDING="3" BGCOLOR="#E8F5E9">
        <TR><TD COLSPAN="3" BGCOLOR="#4CAF50"><FONT COLOR="white"><B>users</B></FONT></TD></TR>
        <TR><TD ALIGN="LEFT"><B>id</B></TD><TD ALIGN="LEFT">UUID</TD><TD>PK</TD></TR>
        <TR><TD ALIGN="LEFT">mongo_id</TD><TD ALIGN="LEFT">VARCHAR(24)</TD><TD></TD></TR>
        <TR><TD ALIGN="LEFT">name</TD><TD ALIGN="LEFT">VARCHAR(255)</TD><TD>NOT NULL</TD></TR>
        <TR><TD ALIGN="LEFT">is_admin</TD><TD ALIGN="LEFT">BOOLEAN</TD><TD></TD></TR>
        <TR><TD ALIGN="LEFT">created_at</TD><TD ALIGN="LEFT">TIMESTAMPTZ</TD><TD></TD></TR>
        <TR><TD ALIGN="LEFT">updated_at</TD><TD ALIGN="LEFT">TIMESTAMPTZ</TD><TD></TD></TR>
    </TABLE>>'''
    dot.node('users', users_label)
    
    # Authors Table
    authors_label = '''<<TABLE BORDER="1" CELLBORDER="1" CELLSPACING="0" CELLPADDING="3" BGCOLOR="#F3E5F5">
        <TR><TD COLSPAN="3" BGCOLOR="#9C27B0"><FONT COLOR="white"><B>authors</B></FONT></TD></TR>
        <TR><TD ALIGN="LEFT"><B>id</B></TD><TD ALIGN="LEFT">UUID</TD><TD>PK</TD></TR>
        <TR><TD ALIGN="LEFT">mongo_id</TD><TD ALIGN="LEFT">VARCHAR(24)</TD><TD></TD></TR>
        <TR><TD ALIGN="LEFT">name</TD><TD ALIGN="LEFT">VARCHAR(255)</TD><TD>NOT NULL</TD></TR>
        <TR><TD ALIGN="LEFT">sanitized_name</TD><TD ALIGN="LEFT">VARCHAR(255)</TD><TD>NOT NULL</TD></TR>
        <TR><TD ALIGN="LEFT">bio</TD><TD ALIGN="LEFT">TEXT</TD><TD></TD></TR>
        <TR><TD ALIGN="LEFT">created_at</TD><TD ALIGN="LEFT">TIMESTAMPTZ</TD><TD></TD></TR>
        <TR><TD ALIGN="LEFT">updated_at</TD><TD ALIGN="LEFT">TIMESTAMPTZ</TD><TD></TD></TR>
    </TABLE>>'''
    dot.node('authors', authors_label)
    
    # Author Aliases Table
    aliases_label = '''<<TABLE BORDER="1" CELLBORDER="1" CELLSPACING="0" CELLPADDING="3" BGCOLOR="#F3E5F5">
        <TR><TD COLSPAN="3" BGCOLOR="#BA68C8"><FONT COLOR="white"><B>author_aliases</B></FONT></TD></TR>
        <TR><TD ALIGN="LEFT"><B>id</B></TD><TD ALIGN="LEFT">SERIAL</TD><TD>PK</TD></TR>
        <TR><TD ALIGN="LEFT">author_id</TD><TD ALIGN="LEFT">UUID</TD><TD>FK</TD></TR>
        <TR><TD ALIGN="LEFT">alias</TD><TD ALIGN="LEFT">VARCHAR(255)</TD><TD>NOT NULL</TD></TR>
    </TABLE>>'''
    dot.node('author_aliases', aliases_label)
    
    # Book Authors Junction Table
    book_authors_label = '''<<TABLE BORDER="1" CELLBORDER="1" CELLSPACING="0" CELLPADDING="3" BGCOLOR="#FFF9C4">
        <TR><TD COLSPAN="3" BGCOLOR="#FBC02D"><FONT COLOR="white"><B>book_authors</B></FONT></TD></TR>
        <TR><TD ALIGN="LEFT"><B>id</B></TD><TD ALIGN="LEFT">SERIAL</TD><TD>PK</TD></TR>
        <TR><TD ALIGN="LEFT">book_isbn</TD><TD ALIGN="LEFT">VARCHAR(13)</TD><TD>FK</TD></TR>
        <TR><TD ALIGN="LEFT">author_id</TD><TD ALIGN="LEFT">UUID</TD><TD>FK</TD></TR>
        <TR><TD ALIGN="LEFT">display_order</TD><TD ALIGN="LEFT">INTEGER</TD><TD></TD></TR>
    </TABLE>>'''
    dot.node('book_authors', book_authors_label)
    
    # Reviews Table
    reviews_label = '''<<TABLE BORDER="1" CELLBORDER="1" CELLSPACING="0" CELLPADDING="3" BGCOLOR="#FFEBEE">
        <TR><TD COLSPAN="3" BGCOLOR="#F44336"><FONT COLOR="white"><B>reviews</B></FONT></TD></TR>
        <TR><TD ALIGN="LEFT"><B>id</B></TD><TD ALIGN="LEFT">UUID</TD><TD>PK</TD></TR>
        <TR><TD ALIGN="LEFT">mongo_id</TD><TD ALIGN="LEFT">VARCHAR(24)</TD><TD></TD></TR>
        <TR><TD ALIGN="LEFT">book_isbn</TD><TD ALIGN="LEFT">VARCHAR(13)</TD><TD>FK</TD></TR>
        <TR><TD ALIGN="LEFT">reviewer_name</TD><TD ALIGN="LEFT">VARCHAR(255)</TD><TD>NOT NULL</TD></TR>
        <TR><TD ALIGN="LEFT">text</TD><TD ALIGN="LEFT">TEXT</TD><TD>NOT NULL</TD></TR>
        <TR><TD ALIGN="LEFT">rating</TD><TD ALIGN="LEFT">INTEGER</TD><TD>CHECK 1-5</TD></TR>
        <TR><TD ALIGN="LEFT">timestamp</TD><TD ALIGN="LEFT">BIGINT</TD><TD>NOT NULL</TD></TR>
        <TR><TD ALIGN="LEFT">created_at</TD><TD ALIGN="LEFT">TIMESTAMPTZ</TD><TD></TD></TR>
    </TABLE>>'''
    dot.node('reviews', reviews_label)
    
    # Reservations Table
    reservations_label = '''<<TABLE BORDER="1" CELLBORDER="1" CELLSPACING="0" CELLPADDING="3" BGCOLOR="#FFF3E0">
        <TR><TD COLSPAN="3" BGCOLOR="#FF9800"><FONT COLOR="white"><B>reservations</B></FONT></TD></TR>
        <TR><TD ALIGN="LEFT"><B>id</B></TD><TD ALIGN="LEFT">UUID</TD><TD>PK</TD></TR>
        <TR><TD ALIGN="LEFT">user_id</TD><TD ALIGN="LEFT">UUID</TD><TD>FK</TD></TR>
        <TR><TD ALIGN="LEFT">book_isbn</TD><TD ALIGN="LEFT">VARCHAR(13)</TD><TD>FK</TD></TR>
        <TR><TD ALIGN="LEFT">expiration_date</TD><TD ALIGN="LEFT">TIMESTAMPTZ</TD><TD>NOT NULL</TD></TR>
        <TR><TD ALIGN="LEFT">created_at</TD><TD ALIGN="LEFT">TIMESTAMPTZ</TD><TD></TD></TR>
    </TABLE>>'''
    dot.node('reservations', reservations_label)
    
    # Borrowed Books Table
    borrowed_label = '''<<TABLE BORDER="1" CELLBORDER="1" CELLSPACING="0" CELLPADDING="3" BGCOLOR="#FFF3E0">
        <TR><TD COLSPAN="3" BGCOLOR="#F57C00"><FONT COLOR="white"><B>borrowed_books</B></FONT></TD></TR>
        <TR><TD ALIGN="LEFT"><B>id</B></TD><TD ALIGN="LEFT">UUID</TD><TD>PK</TD></TR>
        <TR><TD ALIGN="LEFT">user_id</TD><TD ALIGN="LEFT">UUID</TD><TD>FK</TD></TR>
        <TR><TD ALIGN="LEFT">book_isbn</TD><TD ALIGN="LEFT">VARCHAR(13)</TD><TD>FK</TD></TR>
        <TR><TD ALIGN="LEFT">borrow_date</TD><TD ALIGN="LEFT">TIMESTAMPTZ</TD><TD>NOT NULL</TD></TR>
        <TR><TD ALIGN="LEFT">due_date</TD><TD ALIGN="LEFT">TIMESTAMPTZ</TD><TD>NOT NULL</TD></TR>
        <TR><TD ALIGN="LEFT">returned_date</TD><TD ALIGN="LEFT">TIMESTAMPTZ</TD><TD></TD></TR>
        <TR><TD ALIGN="LEFT">returned</TD><TD ALIGN="LEFT">BOOLEAN</TD><TD>NOT NULL</TD></TR>
        <TR><TD ALIGN="LEFT">created_at</TD><TD ALIGN="LEFT">TIMESTAMPTZ</TD><TD></TD></TR>
        <TR><TD ALIGN="LEFT">updated_at</TD><TD ALIGN="LEFT">TIMESTAMPTZ</TD><TD></TD></TR>
    </TABLE>>'''
    dot.node('borrowed_books', borrowed_label)
    
    # Availability View (virtual)
    view_label = '''<<TABLE BORDER="1" CELLBORDER="1" CELLSPACING="0" CELLPADDING="3" BGCOLOR="#E0E0E0">
        <TR><TD COLSPAN="2" BGCOLOR="#757575"><FONT COLOR="white"><B>books_with_availability (VIEW)</B></FONT></TD></TR>
        <TR><TD ALIGN="LEFT">*</TD><TD ALIGN="LEFT">All books columns</TD></TR>
        <TR><TD ALIGN="LEFT"><I>available</I></TD><TD ALIGN="LEFT"><I>Computed: total - active</I></TD></TR>
    </TABLE>>'''
    dot.node('availability_view', view_label)
    
    # Relationships
    dot.edge('book_genres', 'books', label='book_isbn', color='#2196F3')
    dot.edge('book_attributes', 'books', label='book_isbn', color='#2196F3')
    dot.edge('book_authors', 'books', label='book_isbn', color='#2196F3')
    dot.edge('book_authors', 'authors', label='author_id', color='#9C27B0')
    dot.edge('author_aliases', 'authors', label='author_id', color='#9C27B0')
    dot.edge('reviews', 'books', label='book_isbn', color='#F44336')
    dot.edge('reservations', 'books', label='book_isbn', color='#2196F3')
    dot.edge('reservations', 'users', label='user_id', color='#4CAF50')
    dot.edge('borrowed_books', 'books', label='book_isbn', color='#2196F3')
    dot.edge('borrowed_books', 'users', label='user_id', color='#4CAF50')
    dot.edge('availability_view', 'books', style='dashed', color='#757575')
    dot.edge('availability_view', 'reservations', style='dashed', color='#757575')
    dot.edge('availability_view', 'borrowed_books', style='dashed', color='#757575')
    
    # Title
    dot.attr(label='\\nProposed PostgreSQL Schema - Library Management System\\n', labelloc='t', fontsize='20')
    
    output_path = os.path.join(OUTPUT_DIR, 'postgres-proposed-erd')
    dot.render(output_path, cleanup=True)
    print(f"Generated: {output_path}.png")
    return output_path


def create_migration_comparison():
    """Generate a side-by-side comparison diagram."""
    
    dot = graphviz.Digraph(
        'Migration_Comparison',
        comment='MongoDB to PostgreSQL Migration Comparison',
        format='png',
        engine='dot'
    )
    
    dot.attr(rankdir='LR', nodesep='1', ranksep='2')
    dot.attr('node', shape='box', fontname='Helvetica', style='rounded')
    
    # MongoDB subgraph
    with dot.subgraph(name='cluster_mongodb') as mongo:
        mongo.attr(label='MongoDB (Current)', style='rounded', bgcolor='#FFF8E1')
        mongo.node('m_books', 'books\n(12 docs)\nISBN as _id\nEmbedded: authors[], reviews[]', fillcolor='#E8F4FD', style='filled,rounded')
        mongo.node('m_users', 'users\n(9 docs)\nObjectId', fillcolor='#E8F5E9', style='filled,rounded')
        mongo.node('m_issue', 'issueDetails\n(3 docs)\nPolymorphic\nComposite string key', fillcolor='#FFF3E0', style='filled,rounded')
        mongo.node('m_authors', 'authors\n(8 docs)\nObjectId\nbooks[] array', fillcolor='#F3E5F5', style='filled,rounded')
        mongo.node('m_reviews', 'reviews\n(28 docs)\nObjectId', fillcolor='#FFEBEE', style='filled,rounded')
    
    # PostgreSQL subgraph
    with dot.subgraph(name='cluster_postgres') as pg:
        pg.attr(label='PostgreSQL (Proposed)', style='rounded', bgcolor='#E3F2FD')
        pg.node('p_books', 'books\nISBN as PK', fillcolor='#E8F4FD', style='filled,rounded')
        pg.node('p_genres', 'book_genres\nNormalized array', fillcolor='#E8F4FD', style='filled,rounded')
        pg.node('p_attrs', 'book_attributes\nKey-value pairs', fillcolor='#E8F4FD', style='filled,rounded')
        pg.node('p_users', 'users\nUUID PK', fillcolor='#E8F5E9', style='filled,rounded')
        pg.node('p_reservations', 'reservations\nUUID PK', fillcolor='#FFF3E0', style='filled,rounded')
        pg.node('p_borrowed', 'borrowed_books\nUUID PK', fillcolor='#FFF3E0', style='filled,rounded')
        pg.node('p_authors', 'authors\nUUID PK', fillcolor='#F3E5F5', style='filled,rounded')
        pg.node('p_aliases', 'author_aliases\nNormalized array', fillcolor='#F3E5F5', style='filled,rounded')
        pg.node('p_book_authors', 'book_authors\nJunction table', fillcolor='#FFF9C4', style='filled,rounded')
        pg.node('p_reviews', 'reviews\nUUID PK, FK to books', fillcolor='#FFEBEE', style='filled,rounded')
    
    # Migration arrows
    dot.edge('m_books', 'p_books', label='Split embedded\narrays', color='#1976D2', penwidth='2')
    dot.edge('m_books', 'p_genres', style='dashed', color='#1976D2')
    dot.edge('m_books', 'p_attrs', style='dashed', color='#1976D2')
    dot.edge('m_users', 'p_users', label='ObjectId to UUID', color='#388E3C', penwidth='2')
    dot.edge('m_issue', 'p_reservations', label='Split polymorphic\ncollection', color='#F57C00', penwidth='2')
    dot.edge('m_issue', 'p_borrowed', style='dashed', color='#F57C00')
    dot.edge('m_authors', 'p_authors', label='Normalize arrays', color='#7B1FA2', penwidth='2')
    dot.edge('m_authors', 'p_aliases', style='dashed', color='#7B1FA2')
    dot.edge('m_authors', 'p_book_authors', style='dashed', color='#7B1FA2')
    dot.edge('m_reviews', 'p_reviews', label='Add FK constraint', color='#D32F2F', penwidth='2')
    
    dot.attr(label='\\nMongoDB to PostgreSQL Migration - Schema Transformation\\n', labelloc='t', fontsize='20')
    
    output_path = os.path.join(OUTPUT_DIR, 'migration-comparison')
    dot.render(output_path, cleanup=True)
    print(f"Generated: {output_path}.png")
    return output_path


def main():
    """Generate all ERD diagrams."""
    print("Generating ERD diagrams for Library Management System migration...")
    print(f"Output directory: {OUTPUT_DIR}")
    print()
    
    # Create scripts directory if it doesn't exist
    os.makedirs(os.path.dirname(os.path.abspath(__file__)), exist_ok=True)
    
    # Generate diagrams
    create_mongodb_erd()
    create_postgres_erd()
    create_migration_comparison()
    
    print()
    print("All diagrams generated successfully!")


if __name__ == '__main__':
    main()
