#!/usr/bin/env node

/**
 * IDEMPOTENT Script - Safe to run multiple times
 * Checks for existing data and only creates what's missing
 * Updated for Supabase/Postgres
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: './server/.env' });

const BASE_URL = 'http://localhost:5000';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Helper function to make API calls
async function apiCall(method, endpoint, data = null, token = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    const options = { method, headers };
    if (data) options.body = JSON.stringify(data);
    
    try {
        const response = await fetch(`${BASE_URL}${endpoint}`, options);
        const result = await response.json();
        if (!response.ok) {
            console.error(`Error ${response.status}:`, result);
            return null;
        }
        return result;
    } catch (error) {
        console.error(`API call failed for ${method} ${endpoint}:`, error.message);
        return null;
    }
}

// Get admin JWT token
async function getAdminToken() {
    console.log('Getting admin JWT token...');
    const result = await apiCall('GET', '/users/login/DatabaseAdmin');
    return result?.jwt;
}

// Create additional users
async function createUsersIfNeeded() {
    console.log('Creating additional users...');
    
    const userNames = [
        'LibraryManager',
        'BookwormReader', 
        'StudentUser',
        'TeacherUser',
        'CasualReader',
        'BookClubMember',
        'ResearchStudent',
        'LiteratureFan'
    ];
    
    const createdUsers = [];
    
    for (const userName of userNames) {
        const result = await apiCall('GET', `/users/login/${userName}`);
        if (result?.jwt) {
            createdUsers.push({ name: userName, jwt: result.jwt });
            console.log(`Created/verified user: ${userName}`);
        }
    }
    
    return createdUsers;
}

// Create authors only if they don't exist
async function createAuthorsIfNeeded() {
    console.log('Checking for existing authors...');
    
    const authorData = [
        {
            name: "F. Scott Fitzgerald",
            sanitized_name: "f-scott-fitzgerald",
            aliases: ["Francis Scott Key Fitzgerald"],
            bio: "American novelist, essayist, and short story writer known for depicting the flamboyance and excess of the Jazz Age.",
            books: ["9780743273565"]
        },
        {
            name: "Harper Lee",
            sanitized_name: "harper-lee", 
            aliases: ["Nelle Harper Lee"],
            bio: "American novelist best known for To Kill a Mockingbird, which won the 1961 Pulitzer Prize.",
            books: ["9780061120084"]
        },
        {
            name: "George Orwell",
            sanitized_name: "george-orwell",
            aliases: ["Eric Arthur Blair"],
            bio: "English novelist, essayist, journalist and critic known for works like 1984 and Animal Farm.",
            books: ["9780451524935", "9780452284234"]
        },
        {
            name: "Jane Austen",
            sanitized_name: "jane-austen",
            aliases: [],
            bio: "English novelist known primarily for her six major novels, which interpret, critique and comment upon the British landed gentry at the end of the 18th century.",
            books: ["9780141439518", "9780141439662"]
        },
        {
            name: "J.D. Salinger",
            sanitized_name: "jd-salinger",
            aliases: ["Jerome David Salinger"],
            bio: "American writer best known for his 1951 novel The Catcher in the Rye.",
            books: ["9780316769174"]
        },
        {
            name: "William Golding",
            sanitized_name: "william-golding",
            aliases: ["Sir William Gerald Golding"],
            bio: "British novelist, playwright, and poet. Best known for his debut novel Lord of the Flies.",
            books: ["9780571056866"]
        },
        {
            name: "J.K. Rowling",
            sanitized_name: "jk-rowling",
            aliases: ["Joanne Rowling"],
            bio: "British author, best known for the Harry Potter series of fantasy novels.",
            books: ["9780439708180", "9780439064873"]
        },
        {
            name: "Agatha Christie",
            sanitized_name: "agatha-christie",
            aliases: ["Dame Agatha Mary Clarissa Christie"],
            bio: "English writer known for her sixty-six detective novels and fourteen short story collections.",
            books: ["9780062073488", "9780062073471"]
        }
    ];
    
    const authorIdMap = {};
    
    for (const authorInfo of authorData) {
        // Check if author already exists
        const { data: existingAuthor } = await supabase
            .from('authors')
            .select('id, name')
            .eq('name', authorInfo.name)
            .single();
        
        if (!existingAuthor) {
            // Create new author
            const { data: newAuthor, error } = await supabase
                .from('authors')
                .insert({
                    name: authorInfo.name,
                    sanitized_name: authorInfo.sanitized_name,
                    bio: authorInfo.bio
                })
                .select()
                .single();
            
            if (error) {
                console.error(`Error creating author ${authorInfo.name}:`, error.message);
                continue;
            }
            
            // Create aliases
            if (authorInfo.aliases && authorInfo.aliases.length > 0) {
                for (const alias of authorInfo.aliases) {
                    await supabase
                        .from('author_aliases')
                        .insert({
                            author_id: newAuthor.id,
                            alias: alias
                        });
                }
            }
            
            console.log(`Created new author: ${authorInfo.name}`);
            authorIdMap[authorInfo.name] = newAuthor.id;
        } else {
            console.log(`Author already exists: ${existingAuthor.name}`);
            authorIdMap[authorInfo.name] = existingAuthor.id;
        }
    }
    
    return authorIdMap;
}

// Create books only if they don't exist
async function createBooksIfNeeded(token, authorIdMap) {
    console.log('Checking for existing books...');
    
    const booksData = [
        {
            isbn: "9780743273565",
            title: "The Great Gatsby",
            year: 1925,
            authorName: "F. Scott Fitzgerald",
            synopsis: "A classic American novel about the Jazz Age and the American Dream.",
            publisher: "Scribner",
            pages: 180
        },
        {
            isbn: "9780061120084",
            title: "To Kill a Mockingbird",
            year: 1960,
            authorName: "Harper Lee",
            synopsis: "A gripping tale of racial injustice and childhood innocence in the American South.",
            publisher: "J.B. Lippincott & Co.",
            pages: 376
        },
        {
            isbn: "9780451524935",
            title: "1984",
            year: 1949,
            authorName: "George Orwell",
            synopsis: "A dystopian social science fiction novel about totalitarian control.",
            publisher: "Secker & Warburg",
            pages: 328
        },
        {
            isbn: "9780452284234",
            title: "Animal Farm",
            year: 1945,
            authorName: "George Orwell",
            synopsis: "A satirical allegorical novella about farm animals who rebel against their human farmer.",
            publisher: "Secker & Warburg",
            pages: 112
        },
        {
            isbn: "9780141439518",
            title: "Pride and Prejudice",
            year: 1813,
            authorName: "Jane Austen",
            synopsis: "A romantic novel of manners written by Jane Austen in 1813.",
            publisher: "Penguin Classics",
            pages: 432
        },
        {
            isbn: "9780141439662",
            title: "Emma",
            year: 1815,
            authorName: "Jane Austen",
            synopsis: "A novel about youthful hubris and romantic misunderstandings.",
            publisher: "Penguin Classics",
            pages: 474
        },
        {
            isbn: "9780316769174",
            title: "The Catcher in the Rye",
            year: 1951,
            authorName: "J.D. Salinger",
            synopsis: "A controversial novel originally published for adults, it has since become popular with adolescent readers.",
            publisher: "Little, Brown and Company",
            pages: 277
        },
        {
            isbn: "9780571056866",
            title: "Lord of the Flies",
            year: 1954,
            authorName: "William Golding",
            synopsis: "A 1954 novel about a group of British boys stuck on an uninhabited island.",
            publisher: "Faber & Faber",
            pages: 248
        },
        {
            isbn: "9780439708180",
            title: "Harry Potter and the Sorcerer's Stone",
            year: 1997,
            authorName: "J.K. Rowling",
            synopsis: "A young wizard's journey begins at Hogwarts School of Witchcraft and Wizardry.",
            publisher: "Scholastic",
            pages: 309
        },
        {
            isbn: "9780439064873",
            title: "Harry Potter and the Chamber of Secrets",
            year: 1998,
            authorName: "J.K. Rowling",
            synopsis: "Harry's second year at Hogwarts is marked by mysterious attacks and ancient secrets.",
            publisher: "Scholastic",
            pages: 341
        },
        {
            isbn: "9780062073488",
            title: "Murder on the Orient Express",
            year: 1934,
            authorName: "Agatha Christie",
            synopsis: "Hercule Poirot investigates a murder aboard the famous Orient Express train.",
            publisher: "Collins Crime Club",
            pages: 256
        },
        {
            isbn: "9780062073471",
            title: "And Then There Were None",
            year: 1939,
            authorName: "Agatha Christie",
            synopsis: "Ten strangers are invited to an island where they are murdered one by one.",
            publisher: "Collins Crime Club",
            pages: 272
        }
    ];
    
    const createdBooks = [];
    
    for (const bookData of booksData) {
        // Check if book already exists
        const existingBook = await apiCall('GET', `/books/${bookData.isbn}`);
        
        if (!existingBook) {
            // Create new book via API
            const book = {
                isbn: bookData.isbn,
                title: bookData.title,
                year: bookData.year,
                authors: [{
                    id: authorIdMap[bookData.authorName],
                    name: bookData.authorName
                }],
                synopsis: bookData.synopsis,
                publisher: bookData.publisher,
                pages: bookData.pages,
                language: "English",
                total_inventory: 5
            };
            
            const result = await apiCall('POST', '/books', book, token);
            if (result) {
                createdBooks.push({ isbn: bookData.isbn, title: bookData.title });
                console.log(`Created new book: ${book.title}`);
            }
        } else {
            console.log(`Book already exists: ${bookData.title}`);
            createdBooks.push({ isbn: bookData.isbn, title: bookData.title });
        }
    }
    
    return createdBooks;
}

// Create reviews only if they don't exist
async function createReviewsIfNeeded(token, books, users) {
    console.log('Checking for existing reviews...');
    
    const reviewTemplates = {
        "The Great Gatsby": [
            { text: "A masterpiece of American literature! Fitzgerald's prose is beautiful.", rating: 5 },
            { text: "The symbolism of the green light is haunting and powerful.", rating: 4 },
            { text: "A tragic tale of the American Dream. Beautifully written.", rating: 5 }
        ],
        "To Kill a Mockingbird": [
            { text: "An important book about justice and morality. Everyone should read this.", rating: 5 },
            { text: "Scout's perspective makes this story both innocent and profound.", rating: 4 },
            { text: "A timeless classic that deals with serious social issues.", rating: 5 }
        ],
        "1984": [
            { text: "Terrifyingly relevant even today. Orwell was a visionary.", rating: 5 },
            { text: "Big Brother is watching... A chilling dystopian masterpiece.", rating: 5 },
            { text: "Made me think about surveillance and freedom in new ways.", rating: 4 }
        ],
        "Animal Farm": [
            { text: "A brilliant allegory about power and corruption.", rating: 5 },
            { text: "Short but incredibly impactful. 'All animals are equal...'", rating: 4 }
        ],
        "Pride and Prejudice": [
            { text: "Elizabeth Bennet is one of literature's greatest heroines.", rating: 5 },
            { text: "Witty dialogue and social commentary. Austen at her best.", rating: 4 }
        ],
        "Harry Potter and the Sorcerer's Stone": [
            { text: "The book that started it all! Magic, friendship, and adventure.", rating: 5 },
            { text: "Hogwarts feels like home. Rowling created something special.", rating: 5 },
            { text: "Perfect for readers of all ages. Pure imagination.", rating: 4 }
        ],
        "Murder on the Orient Express": [
            { text: "Christie's plotting is ingenious. Didn't see the ending coming!", rating: 5 },
            { text: "Poirot is the greatest detective in literature.", rating: 4 }
        ]
    };
    
    for (const book of books) {
        const existingReviews = await apiCall('GET', `/books/${book.isbn}/reviews`);
        
        if (!existingReviews || existingReviews.length === 0) {
            const bookReviews = reviewTemplates[book.title] || [
                { text: "A great read! Highly recommended.", rating: 4 },
                { text: "Well-written and engaging story.", rating: 4 }
            ];
            
            // Use different user tokens for variety
            for (let i = 0; i < bookReviews.length && i < users.length; i++) {
                const review = bookReviews[i];
                const userToken = users[i % users.length].jwt;
                
                const result = await apiCall('POST', `/books/${book.isbn}/reviews`, review, userToken);
                if (result) {
                    console.log(`Created review for ${book.title} by ${users[i % users.length].name}`);
                }
            }
        } else {
            console.log(`Reviews already exist for ${book.title} (${existingReviews.length} reviews)`);
        }
    }
}

// Create some reservations for variety
async function createReservationsIfNeeded(books, users) {
    console.log('Creating sample reservations...');
    
    // Create a few reservations with different users
    const reservationPairs = [
        { bookIndex: 0, userIndex: 1 }, // First book, second user
        { bookIndex: 2, userIndex: 3 }, // Third book, fourth user
        { bookIndex: 4, userIndex: 0 }  // Fifth book, first user
    ];
    
    for (const pair of reservationPairs) {
        if (books[pair.bookIndex] && users[pair.userIndex]) {
            const book = books[pair.bookIndex];
            const user = users[pair.userIndex];
            
            const result = await apiCall('POST', `/reservations/${book.isbn}`, {}, user.jwt);
            if (result) {
                console.log(`Created reservation for "${book.title}" by ${user.name}`);
            } else {
                console.log(`Reservation may already exist for "${book.title}" by ${user.name}`);
            }
        }
    }
}

// Main function
async function populateDatabaseIdempotent() {
    console.log('Starting ENHANCED IDEMPOTENT database population...\n');
    
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.error('Missing Supabase configuration. Please set SUPABASE_URL and SUPABASE_SERVICE_KEY in server/.env');
        return;
    }
    
    try {
        const adminToken = await getAdminToken();
        if (!adminToken) {
            console.error('Failed to get admin token');
            return;
        }
        
        console.log('Creating comprehensive library dataset...\n');
        
        const users = await createUsersIfNeeded();
        const authorIdMap = await createAuthorsIfNeeded();
        const books = await createBooksIfNeeded(adminToken, authorIdMap);
        await createReviewsIfNeeded(adminToken, books, users);
        await createReservationsIfNeeded(books, users);
        
        console.log('\nEnhanced database population completed!');
        console.log('\nFinal Summary:');
        console.log(`- Books: ${books.length} classic and popular titles`);
        console.log(`- Authors: 8 renowned authors (Fitzgerald, Austen, Orwell, etc.)`);
        console.log(`- Users: ${users.length} diverse library users`);
        console.log('- Reviews: Multiple reviews per book from different users');
        console.log('- Reservations: Sample reservations created');
        console.log('\nSafe to run multiple times - only creates missing data');
        console.log('Rich dataset perfect for testing and demonstration');
        
    } catch (error) {
        console.error('Error populating database:', error);
    }
}

await populateDatabaseIdempotent();
