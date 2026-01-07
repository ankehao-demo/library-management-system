#!/usr/bin/env python3
"""
ERD Generator for Library Management System Migration
Generates both current MongoDB schema and proposed Postgres ERD diagrams.
"""

from graphviz import Digraph


def create_mongodb_erd():
    """Generate ERD diagram showing current MongoDB schema."""
    dot = Digraph('MongoDB_Schema', comment='Current MongoDB Schema')
    dot.attr(rankdir='TB', splines='ortho', nodesep='0.8', ranksep='1.2')
    dot.attr('node', shape='none', fontname='Helvetica')
    dot.attr('edge', fontname='Helvetica', fontsize='10')

    # Books collection
    books_label = '''<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="4" BGCOLOR="lightblue">
        <TR><TD COLSPAN="2" BGCOLOR="steelblue"><FONT COLOR="white"><B>books</B></FONT></TD></TR>
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
        <TR><TD ALIGN="LEFT">authors</TD><TD ALIGN="LEFT">Array&lt;{_id, name}&gt;</TD></TR>
        <TR><TD ALIGN="LEFT">attributes</TD><TD ALIGN="LEFT">Array&lt;{key, value}&gt;</TD></TR>
        <TR><TD ALIGN="LEFT">reviews</TD><TD ALIGN="LEFT">Array&lt;Review&gt; (embedded)</TD></TR>
    </TABLE>>'''
    dot.node('books', books_label)

    # Users collection
    users_label = '''<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="4" BGCOLOR="lightgreen">
        <TR><TD COLSPAN="2" BGCOLOR="darkgreen"><FONT COLOR="white"><B>users</B></FONT></TD></TR>
        <TR><TD ALIGN="LEFT"><B>_id</B></TD><TD ALIGN="LEFT">ObjectId PK</TD></TR>
        <TR><TD ALIGN="LEFT">name</TD><TD ALIGN="LEFT">String (min 5 chars)</TD></TR>
        <TR><TD ALIGN="LEFT">isAdmin</TD><TD ALIGN="LEFT">Boolean</TD></TR>
    </TABLE>>'''
    dot.node('users', users_label)

    # Authors collection
    authors_label = '''<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="4" BGCOLOR="lightyellow">
        <TR><TD COLSPAN="2" BGCOLOR="goldenrod"><FONT COLOR="white"><B>authors</B></FONT></TD></TR>
        <TR><TD ALIGN="LEFT"><B>_id</B></TD><TD ALIGN="LEFT">ObjectId PK</TD></TR>
        <TR><TD ALIGN="LEFT">name</TD><TD ALIGN="LEFT">String</TD></TR>
        <TR><TD ALIGN="LEFT">sanitizedName</TD><TD ALIGN="LEFT">String</TD></TR>
        <TR><TD ALIGN="LEFT">aliases</TD><TD ALIGN="LEFT">Array&lt;String&gt;</TD></TR>
        <TR><TD ALIGN="LEFT">bio</TD><TD ALIGN="LEFT">String?</TD></TR>
        <TR><TD ALIGN="LEFT">books</TD><TD ALIGN="LEFT">Array&lt;ISBN&gt;</TD></TR>
    </TABLE>>'''
    dot.node('authors', authors_label)

    # Reviews collection
    reviews_label = '''<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="4" BGCOLOR="lavender">
        <TR><TD COLSPAN="2" BGCOLOR="purple"><FONT COLOR="white"><B>reviews</B></FONT></TD></TR>
        <TR><TD ALIGN="LEFT"><B>_id</B></TD><TD ALIGN="LEFT">ObjectId PK</TD></TR>
        <TR><TD ALIGN="LEFT">text</TD><TD ALIGN="LEFT">String</TD></TR>
        <TR><TD ALIGN="LEFT">name</TD><TD ALIGN="LEFT">String</TD></TR>
        <TR><TD ALIGN="LEFT">rating</TD><TD ALIGN="LEFT">Number?</TD></TR>
        <TR><TD ALIGN="LEFT">timestamp</TD><TD ALIGN="LEFT">Number</TD></TR>
        <TR><TD ALIGN="LEFT">bookId</TD><TD ALIGN="LEFT">String (ISBN) FK</TD></TR>
    </TABLE>>'''
    dot.node('reviews', reviews_label)

    # IssueDetails collection (polymorphic)
    issue_label = '''<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="4" BGCOLOR="mistyrose">
        <TR><TD COLSPAN="2" BGCOLOR="crimson"><FONT COLOR="white"><B>issueDetails</B></FONT></TD></TR>
        <TR><TD COLSPAN="2" BGCOLOR="lightcoral"><I>Polymorphic Collection</I></TD></TR>
        <TR><TD ALIGN="LEFT"><B>_id</B></TD><TD ALIGN="LEFT">String (composite) PK</TD></TR>
        <TR><TD ALIGN="LEFT"></TD><TD ALIGN="LEFT"><FONT POINT-SIZE="9">userId + type + bookId</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">recordType</TD><TD ALIGN="LEFT">'reservation' | 'borrowedBook'</TD></TR>
        <TR><TD ALIGN="LEFT">book</TD><TD ALIGN="LEFT">{_id, title}</TD></TR>
        <TR><TD ALIGN="LEFT">user</TD><TD ALIGN="LEFT">{_id, name}</TD></TR>
        <TR><TD COLSPAN="2" BGCOLOR="lightcoral"><I>Reservation fields:</I></TD></TR>
        <TR><TD ALIGN="LEFT">expirationDate</TD><TD ALIGN="LEFT">Date</TD></TR>
        <TR><TD COLSPAN="2" BGCOLOR="lightcoral"><I>BorrowedBook fields:</I></TD></TR>
        <TR><TD ALIGN="LEFT">borrowDate</TD><TD ALIGN="LEFT">Date</TD></TR>
        <TR><TD ALIGN="LEFT">dueDate</TD><TD ALIGN="LEFT">Date</TD></TR>
        <TR><TD ALIGN="LEFT">returned</TD><TD ALIGN="LEFT">Boolean</TD></TR>
        <TR><TD ALIGN="LEFT">returnedDate</TD><TD ALIGN="LEFT">Date?</TD></TR>
    </TABLE>>'''
    dot.node('issueDetails', issue_label)

    # Relationships
    dot.edge('authors', 'books', label='books[] (ISBNs)', style='dashed', color='goldenrod')
    dot.edge('books', 'authors', label='authors[] (refs)', style='dashed', color='steelblue')
    dot.edge('reviews', 'books', label='bookId', color='purple')
    dot.edge('books', 'reviews', label='reviews[] (embedded)', style='dotted', color='steelblue')
    dot.edge('issueDetails', 'books', label='book._id', color='crimson')
    dot.edge('issueDetails', 'users', label='user._id', color='crimson')

    # Legend
    with dot.subgraph(name='cluster_legend') as legend:
        legend.attr(label='Legend', style='rounded', bgcolor='white')
        legend.node('leg1', '<<TABLE BORDER="0" CELLBORDER="0"><TR><TD>Solid line = Reference</TD></TR></TABLE>>', shape='none')
        legend.node('leg2', '<<TABLE BORDER="0" CELLBORDER="0"><TR><TD>Dashed line = Denormalized</TD></TR></TABLE>>', shape='none')
        legend.node('leg3', '<<TABLE BORDER="0" CELLBORDER="0"><TR><TD>Dotted line = Embedded</TD></TR></TABLE>>', shape='none')
        legend.node('leg4', '<<TABLE BORDER="0" CELLBORDER="0"><TR><TD><I>Italic</I> = Computed field</TD></TR></TABLE>>', shape='none')

    return dot


def create_postgres_erd():
    """Generate ERD diagram showing proposed Postgres schema."""
    dot = Digraph('Postgres_Schema', comment='Proposed Postgres Schema')
    dot.attr(rankdir='TB', splines='ortho', nodesep='0.8', ranksep='1.0')
    dot.attr('node', shape='none', fontname='Helvetica')
    dot.attr('edge', fontname='Helvetica', fontsize='10')

    # Books table
    books_label = '''<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="4" BGCOLOR="lightblue">
        <TR><TD COLSPAN="3" BGCOLOR="steelblue"><FONT COLOR="white"><B>books</B></FONT></TD></TR>
        <TR><TD ALIGN="LEFT"><B>isbn</B></TD><TD ALIGN="LEFT">VARCHAR(13)</TD><TD ALIGN="LEFT">PK</TD></TR>
        <TR><TD ALIGN="LEFT">title</TD><TD ALIGN="LEFT">VARCHAR(255)</TD><TD ALIGN="LEFT">NOT NULL</TD></TR>
        <TR><TD ALIGN="LEFT">year</TD><TD ALIGN="LEFT">INTEGER</TD><TD ALIGN="LEFT"></TD></TR>
        <TR><TD ALIGN="LEFT">cover_url</TD><TD ALIGN="LEFT">TEXT</TD><TD ALIGN="LEFT"></TD></TR>
        <TR><TD ALIGN="LEFT">pages</TD><TD ALIGN="LEFT">INTEGER</TD><TD ALIGN="LEFT"></TD></TR>
        <TR><TD ALIGN="LEFT">synopsis</TD><TD ALIGN="LEFT">TEXT</TD><TD ALIGN="LEFT"></TD></TR>
        <TR><TD ALIGN="LEFT">publisher</TD><TD ALIGN="LEFT">VARCHAR(255)</TD><TD ALIGN="LEFT"></TD></TR>
        <TR><TD ALIGN="LEFT">long_title</TD><TD ALIGN="LEFT">TEXT</TD><TD ALIGN="LEFT"></TD></TR>
        <TR><TD ALIGN="LEFT">language</TD><TD ALIGN="LEFT">VARCHAR(50)</TD><TD ALIGN="LEFT"></TD></TR>
        <TR><TD ALIGN="LEFT">binding</TD><TD ALIGN="LEFT">VARCHAR(50)</TD><TD ALIGN="LEFT"></TD></TR>
        <TR><TD ALIGN="LEFT">total_inventory</TD><TD ALIGN="LEFT">INTEGER</TD><TD ALIGN="LEFT">NOT NULL DEFAULT 0</TD></TR>
        <TR><TD ALIGN="LEFT">book_of_month</TD><TD ALIGN="LEFT">BOOLEAN</TD><TD ALIGN="LEFT">DEFAULT FALSE</TD></TR>
        <TR><TD ALIGN="LEFT">created_at</TD><TD ALIGN="LEFT">TIMESTAMPTZ</TD><TD ALIGN="LEFT">DEFAULT NOW()</TD></TR>
        <TR><TD ALIGN="LEFT">updated_at</TD><TD ALIGN="LEFT">TIMESTAMPTZ</TD><TD ALIGN="LEFT">DEFAULT NOW()</TD></TR>
    </TABLE>>'''
    dot.node('books', books_label)

    # Book genres junction table
    book_genres_label = '''<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="4" BGCOLOR="lightblue">
        <TR><TD COLSPAN="3" BGCOLOR="steelblue"><FONT COLOR="white"><B>book_genres</B></FONT></TD></TR>
        <TR><TD ALIGN="LEFT"><B>book_isbn</B></TD><TD ALIGN="LEFT">VARCHAR(13)</TD><TD ALIGN="LEFT">PK, FK</TD></TR>
        <TR><TD ALIGN="LEFT"><B>genre</B></TD><TD ALIGN="LEFT">VARCHAR(100)</TD><TD ALIGN="LEFT">PK</TD></TR>
    </TABLE>>'''
    dot.node('book_genres', book_genres_label)

    # Book attributes table
    book_attrs_label = '''<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="4" BGCOLOR="lightblue">
        <TR><TD COLSPAN="3" BGCOLOR="steelblue"><FONT COLOR="white"><B>book_attributes</B></FONT></TD></TR>
        <TR><TD ALIGN="LEFT"><B>id</B></TD><TD ALIGN="LEFT">SERIAL</TD><TD ALIGN="LEFT">PK</TD></TR>
        <TR><TD ALIGN="LEFT">book_isbn</TD><TD ALIGN="LEFT">VARCHAR(13)</TD><TD ALIGN="LEFT">FK, NOT NULL</TD></TR>
        <TR><TD ALIGN="LEFT">key</TD><TD ALIGN="LEFT">VARCHAR(100)</TD><TD ALIGN="LEFT">NOT NULL</TD></TR>
        <TR><TD ALIGN="LEFT">value</TD><TD ALIGN="LEFT">TEXT</TD><TD ALIGN="LEFT">NOT NULL</TD></TR>
    </TABLE>>'''
    dot.node('book_attributes', book_attrs_label)

    # Users table
    users_label = '''<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="4" BGCOLOR="lightgreen">
        <TR><TD COLSPAN="3" BGCOLOR="darkgreen"><FONT COLOR="white"><B>users</B></FONT></TD></TR>
        <TR><TD ALIGN="LEFT"><B>id</B></TD><TD ALIGN="LEFT">UUID</TD><TD ALIGN="LEFT">PK DEFAULT gen_random_uuid()</TD></TR>
        <TR><TD ALIGN="LEFT">name</TD><TD ALIGN="LEFT">VARCHAR(255)</TD><TD ALIGN="LEFT">NOT NULL CHECK(length &gt;= 5)</TD></TR>
        <TR><TD ALIGN="LEFT">is_admin</TD><TD ALIGN="LEFT">BOOLEAN</TD><TD ALIGN="LEFT">NOT NULL DEFAULT FALSE</TD></TR>
        <TR><TD ALIGN="LEFT">created_at</TD><TD ALIGN="LEFT">TIMESTAMPTZ</TD><TD ALIGN="LEFT">DEFAULT NOW()</TD></TR>
        <TR><TD ALIGN="LEFT">updated_at</TD><TD ALIGN="LEFT">TIMESTAMPTZ</TD><TD ALIGN="LEFT">DEFAULT NOW()</TD></TR>
    </TABLE>>'''
    dot.node('users', users_label)

    # Authors table
    authors_label = '''<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="4" BGCOLOR="lightyellow">
        <TR><TD COLSPAN="3" BGCOLOR="goldenrod"><FONT COLOR="white"><B>authors</B></FONT></TD></TR>
        <TR><TD ALIGN="LEFT"><B>id</B></TD><TD ALIGN="LEFT">UUID</TD><TD ALIGN="LEFT">PK DEFAULT gen_random_uuid()</TD></TR>
        <TR><TD ALIGN="LEFT">name</TD><TD ALIGN="LEFT">VARCHAR(255)</TD><TD ALIGN="LEFT">NOT NULL</TD></TR>
        <TR><TD ALIGN="LEFT">sanitized_name</TD><TD ALIGN="LEFT">VARCHAR(255)</TD><TD ALIGN="LEFT">UNIQUE</TD></TR>
        <TR><TD ALIGN="LEFT">bio</TD><TD ALIGN="LEFT">TEXT</TD><TD ALIGN="LEFT"></TD></TR>
        <TR><TD ALIGN="LEFT">created_at</TD><TD ALIGN="LEFT">TIMESTAMPTZ</TD><TD ALIGN="LEFT">DEFAULT NOW()</TD></TR>
        <TR><TD ALIGN="LEFT">updated_at</TD><TD ALIGN="LEFT">TIMESTAMPTZ</TD><TD ALIGN="LEFT">DEFAULT NOW()</TD></TR>
    </TABLE>>'''
    dot.node('authors', authors_label)

    # Author aliases table
    author_aliases_label = '''<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="4" BGCOLOR="lightyellow">
        <TR><TD COLSPAN="3" BGCOLOR="goldenrod"><FONT COLOR="white"><B>author_aliases</B></FONT></TD></TR>
        <TR><TD ALIGN="LEFT"><B>id</B></TD><TD ALIGN="LEFT">SERIAL</TD><TD ALIGN="LEFT">PK</TD></TR>
        <TR><TD ALIGN="LEFT">author_id</TD><TD ALIGN="LEFT">UUID</TD><TD ALIGN="LEFT">FK, NOT NULL</TD></TR>
        <TR><TD ALIGN="LEFT">alias</TD><TD ALIGN="LEFT">VARCHAR(255)</TD><TD ALIGN="LEFT">NOT NULL</TD></TR>
    </TABLE>>'''
    dot.node('author_aliases', author_aliases_label)

    # Book-Author junction table
    book_authors_label = '''<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="4" BGCOLOR="lightyellow">
        <TR><TD COLSPAN="3" BGCOLOR="goldenrod"><FONT COLOR="white"><B>book_authors</B></FONT></TD></TR>
        <TR><TD ALIGN="LEFT"><B>book_isbn</B></TD><TD ALIGN="LEFT">VARCHAR(13)</TD><TD ALIGN="LEFT">PK, FK</TD></TR>
        <TR><TD ALIGN="LEFT"><B>author_id</B></TD><TD ALIGN="LEFT">UUID</TD><TD ALIGN="LEFT">PK, FK</TD></TR>
        <TR><TD ALIGN="LEFT">display_order</TD><TD ALIGN="LEFT">INTEGER</TD><TD ALIGN="LEFT">DEFAULT 0</TD></TR>
    </TABLE>>'''
    dot.node('book_authors', book_authors_label)

    # Reviews table
    reviews_label = '''<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="4" BGCOLOR="lavender">
        <TR><TD COLSPAN="3" BGCOLOR="purple"><FONT COLOR="white"><B>reviews</B></FONT></TD></TR>
        <TR><TD ALIGN="LEFT"><B>id</B></TD><TD ALIGN="LEFT">UUID</TD><TD ALIGN="LEFT">PK DEFAULT gen_random_uuid()</TD></TR>
        <TR><TD ALIGN="LEFT">book_isbn</TD><TD ALIGN="LEFT">VARCHAR(13)</TD><TD ALIGN="LEFT">FK, NOT NULL</TD></TR>
        <TR><TD ALIGN="LEFT">reviewer_name</TD><TD ALIGN="LEFT">VARCHAR(255)</TD><TD ALIGN="LEFT">NOT NULL</TD></TR>
        <TR><TD ALIGN="LEFT">text</TD><TD ALIGN="LEFT">TEXT</TD><TD ALIGN="LEFT">NOT NULL</TD></TR>
        <TR><TD ALIGN="LEFT">rating</TD><TD ALIGN="LEFT">INTEGER</TD><TD ALIGN="LEFT">CHECK(1-5)</TD></TR>
        <TR><TD ALIGN="LEFT">created_at</TD><TD ALIGN="LEFT">TIMESTAMPTZ</TD><TD ALIGN="LEFT">DEFAULT NOW()</TD></TR>
    </TABLE>>'''
    dot.node('reviews', reviews_label)

    # Reservations table
    reservations_label = '''<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="4" BGCOLOR="mistyrose">
        <TR><TD COLSPAN="3" BGCOLOR="crimson"><FONT COLOR="white"><B>reservations</B></FONT></TD></TR>
        <TR><TD ALIGN="LEFT"><B>id</B></TD><TD ALIGN="LEFT">UUID</TD><TD ALIGN="LEFT">PK DEFAULT gen_random_uuid()</TD></TR>
        <TR><TD ALIGN="LEFT">user_id</TD><TD ALIGN="LEFT">UUID</TD><TD ALIGN="LEFT">FK, NOT NULL</TD></TR>
        <TR><TD ALIGN="LEFT">book_isbn</TD><TD ALIGN="LEFT">VARCHAR(13)</TD><TD ALIGN="LEFT">FK, NOT NULL</TD></TR>
        <TR><TD ALIGN="LEFT">expiration_date</TD><TD ALIGN="LEFT">TIMESTAMPTZ</TD><TD ALIGN="LEFT">NOT NULL</TD></TR>
        <TR><TD ALIGN="LEFT">created_at</TD><TD ALIGN="LEFT">TIMESTAMPTZ</TD><TD ALIGN="LEFT">DEFAULT NOW()</TD></TR>
        <TR><TD COLSPAN="3" BGCOLOR="lightcoral"><FONT POINT-SIZE="9">UNIQUE(user_id, book_isbn)</FONT></TD></TR>
    </TABLE>>'''
    dot.node('reservations', reservations_label)

    # Borrowed books table
    borrowed_label = '''<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="4" BGCOLOR="mistyrose">
        <TR><TD COLSPAN="3" BGCOLOR="crimson"><FONT COLOR="white"><B>borrowed_books</B></FONT></TD></TR>
        <TR><TD ALIGN="LEFT"><B>id</B></TD><TD ALIGN="LEFT">UUID</TD><TD ALIGN="LEFT">PK DEFAULT gen_random_uuid()</TD></TR>
        <TR><TD ALIGN="LEFT">user_id</TD><TD ALIGN="LEFT">UUID</TD><TD ALIGN="LEFT">FK, NOT NULL</TD></TR>
        <TR><TD ALIGN="LEFT">book_isbn</TD><TD ALIGN="LEFT">VARCHAR(13)</TD><TD ALIGN="LEFT">FK, NOT NULL</TD></TR>
        <TR><TD ALIGN="LEFT">borrow_date</TD><TD ALIGN="LEFT">TIMESTAMPTZ</TD><TD ALIGN="LEFT">NOT NULL DEFAULT NOW()</TD></TR>
        <TR><TD ALIGN="LEFT">due_date</TD><TD ALIGN="LEFT">TIMESTAMPTZ</TD><TD ALIGN="LEFT">NOT NULL</TD></TR>
        <TR><TD ALIGN="LEFT">returned</TD><TD ALIGN="LEFT">BOOLEAN</TD><TD ALIGN="LEFT">NOT NULL DEFAULT FALSE</TD></TR>
        <TR><TD ALIGN="LEFT">returned_date</TD><TD ALIGN="LEFT">TIMESTAMPTZ</TD><TD ALIGN="LEFT"></TD></TR>
        <TR><TD COLSPAN="3" BGCOLOR="lightcoral"><FONT POINT-SIZE="9">INDEX on (user_id, returned)</FONT></TD></TR>
    </TABLE>>'''
    dot.node('borrowed_books', borrowed_label)

    # Book availability view
    view_label = '''<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="4" BGCOLOR="lightgray">
        <TR><TD COLSPAN="2" BGCOLOR="gray"><FONT COLOR="white"><B>v_book_availability</B> (VIEW)</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">isbn</TD><TD ALIGN="LEFT">VARCHAR(13)</TD></TR>
        <TR><TD ALIGN="LEFT">title</TD><TD ALIGN="LEFT">VARCHAR(255)</TD></TR>
        <TR><TD ALIGN="LEFT">total_inventory</TD><TD ALIGN="LEFT">INTEGER</TD></TR>
        <TR><TD ALIGN="LEFT">reserved_count</TD><TD ALIGN="LEFT">INTEGER</TD></TR>
        <TR><TD ALIGN="LEFT">borrowed_count</TD><TD ALIGN="LEFT">INTEGER</TD></TR>
        <TR><TD ALIGN="LEFT"><I>available</I></TD><TD ALIGN="LEFT"><I>INTEGER (computed)</I></TD></TR>
    </TABLE>>'''
    dot.node('v_book_availability', view_label)

    # Relationships
    dot.edge('book_genres', 'books', label='book_isbn', color='steelblue')
    dot.edge('book_attributes', 'books', label='book_isbn', color='steelblue')
    dot.edge('book_authors', 'books', label='book_isbn', color='steelblue')
    dot.edge('book_authors', 'authors', label='author_id', color='goldenrod')
    dot.edge('author_aliases', 'authors', label='author_id', color='goldenrod')
    dot.edge('reviews', 'books', label='book_isbn', color='purple')
    dot.edge('reservations', 'books', label='book_isbn', color='crimson')
    dot.edge('reservations', 'users', label='user_id', color='darkgreen')
    dot.edge('borrowed_books', 'books', label='book_isbn', color='crimson')
    dot.edge('borrowed_books', 'users', label='user_id', color='darkgreen')
    dot.edge('v_book_availability', 'books', label='derives from', style='dashed', color='gray')

    # Legend
    with dot.subgraph(name='cluster_legend') as legend:
        legend.attr(label='Legend', style='rounded', bgcolor='white')
        legend.node('leg1', '<<TABLE BORDER="0" CELLBORDER="0"><TR><TD>PK = Primary Key</TD></TR></TABLE>>', shape='none')
        legend.node('leg2', '<<TABLE BORDER="0" CELLBORDER="0"><TR><TD>FK = Foreign Key</TD></TR></TABLE>>', shape='none')
        legend.node('leg3', '<<TABLE BORDER="0" CELLBORDER="0"><TR><TD>Dashed = View dependency</TD></TR></TABLE>>', shape='none')

    return dot


def main():
    """Generate all ERD diagrams."""
    print("Generating MongoDB ERD...")
    mongodb_erd = create_mongodb_erd()
    mongodb_erd.render('mongodb_current_schema', format='png', cleanup=True)
    mongodb_erd.render('mongodb_current_schema', format='svg', cleanup=True)
    print("  - Created mongodb_current_schema.png")
    print("  - Created mongodb_current_schema.svg")

    print("\nGenerating Postgres ERD...")
    postgres_erd = create_postgres_erd()
    postgres_erd.render('postgres_proposed_schema', format='png', cleanup=True)
    postgres_erd.render('postgres_proposed_schema', format='svg', cleanup=True)
    print("  - Created postgres_proposed_schema.png")
    print("  - Created postgres_proposed_schema.svg")

    print("\nERD generation complete!")


if __name__ == '__main__':
    main()
