import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import { randomUUID } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';

dotenv.config();

const URI = process.env.DATABASE_URI;

const mongoIdToUuidMap = new Map();

function generateUuidForMongoId(mongoId) {
    const key = String(mongoId);
    if (!mongoIdToUuidMap.has(key)) {
        mongoIdToUuidMap.set(key, randomUUID());
    }
    return mongoIdToUuidMap.get(key);
}

function escapeString(str) {
    if (str === null || str === undefined) return 'NULL';
    return `'${str.replace(/'/g, "''")}'`;
}

function timestampToPostgres(timestamp) {
    if (!timestamp) return 'NULL';
    if (typeof timestamp === 'number') {
        return `TO_TIMESTAMP(${timestamp / 1000.0})`;
    }
    if (typeof timestamp === 'string') {
        return `'${timestamp}'::TIMESTAMPTZ`;
    }
    return 'NULL';
}

async function extractData() {
    const client = new MongoClient(URI);
    try {
        await client.connect();
        console.log('Connected successfully to MongoDB');

        const db = client.db('library');
        const collections = ['books', 'users', 'issueDetails', 'authors', 'reviews'];
        const extractedData = {};

        for (const collectionName of collections) {
            const collection = db.collection(collectionName);
            const documents = await collection.find().toArray();
            extractedData[collectionName] = documents;
            console.log(`Extracted ${documents.length} documents from ${collectionName}`);
        }

        return extractedData;
    } finally {
        await client.close();
    }
}

function transformUsers(users) {
    console.log('\n=== Transforming Users ===');
    const transformed = users.map(user => ({
        id: generateUuidForMongoId(user._id),
        name: user.name,
        is_admin: user.isAdmin || false,
        mongo_id: user._id
    }));
    console.log(`Transformed ${transformed.length} users`);
    return transformed;
}

function transformAuthors(authors) {
    console.log('\n=== Transforming Authors ===');
    const transformedAuthors = [];
    const transformedAliases = [];

    for (const author of authors) {
        const authorId = generateUuidForMongoId(author._id);
        transformedAuthors.push({
            id: authorId,
            name: author.name,
            sanitized_name: author.sanitizedName || null,
            bio: author.bio || null,
            mongo_id: author._id
        });

        if (author.aliases && author.aliases.length > 0) {
            for (const alias of author.aliases) {
                transformedAliases.push({
                    author_id: authorId,
                    alias: alias
                });
            }
        }
    }

    console.log(`Transformed ${transformedAuthors.length} authors`);
    console.log(`Transformed ${transformedAliases.length} author aliases`);
    return { authors: transformedAuthors, aliases: transformedAliases };
}

function transformBooks(books) {
    console.log('\n=== Transforming Books ===');
    const transformedBooks = [];
    const transformedGenres = [];
    const transformedAttributes = [];
    const transformedBookAuthors = [];

    for (const book of books) {
        transformedBooks.push({
            isbn: book._id,
            title: book.title,
            year: book.year || null,
            cover_url: book.cover || null,
            pages: book.pages || null,
            synopsis: book.synopsis || null,
            publisher: book.publisher || null,
            long_title: book.longTitle || null,
            language: book.language || null,
            binding: book.binding || null,
            total_inventory: book.totalInventory || 0,
            book_of_month: book.bookOfTheMonth || false
        });

        if (book.genres && book.genres.length > 0) {
            for (const genre of book.genres) {
                transformedGenres.push({
                    book_isbn: book._id,
                    genre: genre
                });
            }
        }

        if (book.attributes && book.attributes.length > 0) {
            for (const attr of book.attributes) {
                transformedAttributes.push({
                    book_isbn: book._id,
                    key: attr.key,
                    value: attr.value
                });
            }
        }

        if (book.authors && book.authors.length > 0) {
            book.authors.forEach((author, index) => {
                transformedBookAuthors.push({
                    book_isbn: book._id,
                    author_id: generateUuidForMongoId(author._id),
                    display_order: index
                });
            });
        }
    }

    console.log(`Transformed ${transformedBooks.length} books`);
    console.log(`Transformed ${transformedGenres.length} book genres`);
    console.log(`Transformed ${transformedAttributes.length} book attributes`);
    console.log(`Transformed ${transformedBookAuthors.length} book-author relationships`);
    return { books: transformedBooks, genres: transformedGenres, attributes: transformedAttributes, bookAuthors: transformedBookAuthors };
}

function transformReviews(reviews) {
    console.log('\n=== Transforming Reviews ===');
    const transformed = reviews.map(review => ({
        id: generateUuidForMongoId(review._id),
        book_isbn: review.bookId,
        reviewer_name: review.name,
        text: review.text,
        rating: review.rating || null,
        created_at: review.timestamp,
        mongo_id: review._id
    }));
    console.log(`Transformed ${transformed.length} reviews`);
    return transformed;
}

function transformIssueDetails(issueDetails, userIdMap) {
    console.log('\n=== Transforming Issue Details ===');
    const reservations = [];
    const borrowedBooks = [];

    for (const detail of issueDetails) {
        const userId = generateUuidForMongoId(detail.user._id);
        const bookIsbn = detail.book._id;

        if (detail.recordType === 'reservation') {
            reservations.push({
                id: randomUUID(),
                user_id: userId,
                book_isbn: bookIsbn,
                expiration_date: detail.expirationDate,
                mongo_id: detail._id
            });
        } else if (detail.recordType === 'borrowedBook') {
            borrowedBooks.push({
                id: randomUUID(),
                user_id: userId,
                book_isbn: bookIsbn,
                borrow_date: detail.borrowDate,
                due_date: detail.dueDate,
                returned: detail.returned || false,
                returned_date: detail.returnedDate || null,
                mongo_id: detail._id
            });
        }
    }

    console.log(`Transformed ${reservations.length} reservations`);
    console.log(`Transformed ${borrowedBooks.length} borrowed books`);
    return { reservations, borrowedBooks };
}

function generateUsersSQL(users) {
    if (users.length === 0) return '';
    const values = users.map(u => 
        `('${u.id}', ${escapeString(u.name)}, ${u.is_admin})`
    ).join(',\n    ');
    return `INSERT INTO users (id, name, is_admin) VALUES\n    ${values};`;
}

function generateAuthorsSQL(authors) {
    if (authors.length === 0) return '';
    const values = authors.map(a => 
        `('${a.id}', ${escapeString(a.name)}, ${escapeString(a.sanitized_name)}, ${escapeString(a.bio)})`
    ).join(',\n    ');
    return `INSERT INTO authors (id, name, sanitized_name, bio) VALUES\n    ${values};`;
}

function generateAuthorAliasesSQL(aliases) {
    if (aliases.length === 0) return '';
    const values = aliases.map(a => 
        `('${a.author_id}', ${escapeString(a.alias)})`
    ).join(',\n    ');
    return `INSERT INTO author_aliases (author_id, alias) VALUES\n    ${values};`;
}

function generateBooksSQL(books) {
    if (books.length === 0) return '';
    const values = books.map(b => 
        `(${escapeString(b.isbn)}, ${escapeString(b.title)}, ${b.year || 'NULL'}, ${escapeString(b.cover_url)}, ${b.pages || 'NULL'}, ${escapeString(b.synopsis)}, ${escapeString(b.publisher)}, ${escapeString(b.long_title)}, ${escapeString(b.language)}, ${escapeString(b.binding)}, ${b.total_inventory}, ${b.book_of_month})`
    ).join(',\n    ');
    return `INSERT INTO books (isbn, title, year, cover_url, pages, synopsis, publisher, long_title, language, binding, total_inventory, book_of_month) VALUES\n    ${values};`;
}

function generateBookGenresSQL(genres) {
    if (genres.length === 0) return '';
    const values = genres.map(g => 
        `(${escapeString(g.book_isbn)}, ${escapeString(g.genre)})`
    ).join(',\n    ');
    return `INSERT INTO book_genres (book_isbn, genre) VALUES\n    ${values};`;
}

function generateBookAttributesSQL(attributes) {
    if (attributes.length === 0) return '';
    const values = attributes.map(a => 
        `(${escapeString(a.book_isbn)}, ${escapeString(a.key)}, ${escapeString(a.value)})`
    ).join(',\n    ');
    return `INSERT INTO book_attributes (book_isbn, key, value) VALUES\n    ${values};`;
}

function generateBookAuthorsSQL(bookAuthors) {
    if (bookAuthors.length === 0) return '';
    const values = bookAuthors.map(ba => 
        `(${escapeString(ba.book_isbn)}, '${ba.author_id}', ${ba.display_order})`
    ).join(',\n    ');
    return `INSERT INTO book_authors (book_isbn, author_id, display_order) VALUES\n    ${values};`;
}

function generateReviewsSQL(reviews) {
    if (reviews.length === 0) return '';
    const values = reviews.map(r => 
        `('${r.id}', ${escapeString(r.book_isbn)}, ${escapeString(r.reviewer_name)}, ${escapeString(r.text)}, ${r.rating || 'NULL'}, ${timestampToPostgres(r.created_at)})`
    ).join(',\n    ');
    return `INSERT INTO reviews (id, book_isbn, reviewer_name, text, rating, created_at) VALUES\n    ${values};`;
}

function generateReservationsSQL(reservations) {
    if (reservations.length === 0) return '';
    const values = reservations.map(r => 
        `('${r.id}', '${r.user_id}', ${escapeString(r.book_isbn)}, '${r.expiration_date}'::TIMESTAMPTZ)`
    ).join(',\n    ');
    return `INSERT INTO reservations (id, user_id, book_isbn, expiration_date) VALUES\n    ${values};`;
}

function generateBorrowedBooksSQL(borrowedBooks) {
    if (borrowedBooks.length === 0) return '';
    const values = borrowedBooks.map(b => 
        `('${b.id}', '${b.user_id}', ${escapeString(b.book_isbn)}, '${b.borrow_date}'::TIMESTAMPTZ, '${b.due_date}'::TIMESTAMPTZ, ${b.returned}, ${b.returned_date ? `'${b.returned_date}'::TIMESTAMPTZ` : 'NULL'})`
    ).join(',\n    ');
    return `INSERT INTO borrowed_books (id, user_id, book_isbn, borrow_date, due_date, returned, returned_date) VALUES\n    ${values};`;
}

async function main() {
    console.log('=== ETL Migration: MongoDB to Supabase ===\n');
    
    console.log('Step 1: Extracting data from MongoDB...');
    const data = await extractData();
    
    console.log('\nStep 2: Pre-generating UUIDs for all MongoDB ObjectIds...');
    for (const user of data.users) {
        generateUuidForMongoId(user._id);
    }
    for (const author of data.authors) {
        generateUuidForMongoId(author._id);
    }
    for (const book of data.books) {
        if (book.authors && book.authors.length > 0) {
            for (const author of book.authors) {
                generateUuidForMongoId(author._id);
            }
        }
    }
    for (const review of data.reviews) {
        generateUuidForMongoId(review._id);
    }
    for (const detail of data.issueDetails) {
        generateUuidForMongoId(detail.user._id);
    }
    console.log(`Pre-generated ${mongoIdToUuidMap.size} UUID mappings`);
    
    console.log('\nStep 3: Transforming data...');
    const users = transformUsers(data.users);
    const { authors, aliases } = transformAuthors(data.authors);
    const { books, genres, attributes, bookAuthors } = transformBooks(data.books);
    const reviews = transformReviews(data.reviews);
    const { reservations, borrowedBooks } = transformIssueDetails(data.issueDetails);
    
    console.log('\nStep 4: Generating SQL statements...');
    
    const sqlStatements = {
        users: generateUsersSQL(users),
        authors: generateAuthorsSQL(authors),
        authorAliases: generateAuthorAliasesSQL(aliases),
        books: generateBooksSQL(books),
        bookGenres: generateBookGenresSQL(genres),
        bookAttributes: generateBookAttributesSQL(attributes),
        bookAuthors: generateBookAuthorsSQL(bookAuthors),
        reviews: generateReviewsSQL(reviews),
        reservations: generateReservationsSQL(reservations),
        borrowedBooks: generateBorrowedBooksSQL(borrowedBooks)
    };
    
    const migrationOrder = [
        'users',
        'authors',
        'authorAliases',
        'books',
        'bookGenres',
        'bookAttributes',
        'bookAuthors',
        'reviews',
        'reservations',
        'borrowedBooks'
    ];
    
    const fullSQL = migrationOrder
        .map(key => sqlStatements[key])
        .filter(sql => sql.length > 0)
        .join('\n\n');
    
    writeFileSync('migration-sql.sql', fullSQL);
    console.log('SQL statements saved to migration-sql.sql');
    
    const idMapping = Object.fromEntries(mongoIdToUuidMap);
    writeFileSync('id-mapping.json', JSON.stringify(idMapping, null, 2));
    console.log('ID mapping saved to id-mapping.json');
    
    const summary = {
        users: users.length,
        authors: authors.length,
        authorAliases: aliases.length,
        books: books.length,
        bookGenres: genres.length,
        bookAttributes: attributes.length,
        bookAuthors: bookAuthors.length,
        reviews: reviews.length,
        reservations: reservations.length,
        borrowedBooks: borrowedBooks.length
    };
    
    console.log('\n=== Migration Summary ===');
    console.log(JSON.stringify(summary, null, 2));
    
    writeFileSync('migration-summary.json', JSON.stringify({
        summary,
        sqlStatements,
        migrationOrder
    }, null, 2));
    console.log('\nMigration data saved to migration-summary.json');
    
    return { summary, sqlStatements, migrationOrder };
}

main().catch(console.error);
