import { Book } from '../models/book.js';
import { connectToDatabase, getSupabase } from '../database.js';
import request from 'supertest';

export const getBaseUrl = () => `http://localhost:${process.env.PORT}`;

export const mochaHooks = {
    beforeAll: [
        async function () {
            await import('../load-env-vars.js');
            await connectToDatabase();

            await cleanTestData();
            await initializeTestData();
        }
    ],
    afterAll: [
        async function () {
            await cleanTestData();
        }
    ]
};

export async function initializeTestData() {
    const supabase = getSupabase();
    
    await supabase.from('users').upsert([
        {
            id: users.admin.id,
            name: users.admin.name,
            is_admin: users.admin.is_admin
        },
        {
            id: users.user1.id,
            name: users.user1.name,
            is_admin: false
        }
    ]);

    const adminResponse = await request(getBaseUrl())
        .get(`/users/login/${users.admin.name}`);
    users.admin.jwt = adminResponse.body.jwt;

    const userResponse = await request(getBaseUrl())
        .get(`/users/login/${users.user1.name}`);
    users.user1.jwt = userResponse.body.jwt;
}

export async function cleanTestData() {
    const supabase = getSupabase();
    
    await supabase.from('users').delete().in('id', [
        users.admin.id,
        users.user1.id
    ]);
}

export async function cleanDatabase() {
    const supabase = getSupabase();
    
    return await Promise.all([
        supabase.from('books').delete().neq('isbn', ''),
        supabase.from('reservations').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
        supabase.from('borrowed_books').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
        supabase.from('reviews').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    ]);
}

export const users = {
    admin: {
        id: '64d4c964-f0d0-56ea-6bf0-f3d800000001',
        name: 'OldSchool Alligator',
        is_admin: true,
        jwt: ''
    },
    user1: {
        id: '64d4c750-5bd4-8310-5c48-991d00000001',
        name: 'Rowdy Hyena',
        jwt: ''
    }
};

const book: Book = {
    isbn: '9780075536321',
    title: 'Anna Karenina',
    cover_url: 'https://m.media-amazon.com/images/I/712ZWjY8VWL._AC_UF1000,1000_QL80_.jpg',
    year: 1877,
    pages: 864,
    synopsis: 'Anna Karenina tells of the doomed love affair between the sensuous and rebellious Anna and the dashing officer, Count Vronsky. Tragedy unfolds as Anna rejects her passionless marriage and must endure the hypocrisies of society. Set against a vast and richly textured canvas of nineteenth-century Russia, the novel\'s seven major characters create a dynamic imbalance, playing out the contrasts of city and country life and all the variations on love and family happiness.',
    total_inventory: 10,
    available: 10
};

const bookOneCopy: Book = {
    isbn: '9781234567890',
    title: 'The Quantum Paradox',
    cover_url: 'https://m.media-amazon.com/images/I/81N9tZQ7h3L._AC_UF1000,1000_QL80_.jpg',
    year: 2023,
    pages: 432,
    synopsis: 'The Quantum Paradox takes readers on a mind-bending journey through parallel universes and the nature of reality. When brilliant physicist Dr. Maria Santiago discovers a way to bridge the gap between dimensions, she sets off a chain of events that could reshape the fabric of existence itself. As governments and shadowy organizations vie for control of this technology, Maria must navigate a treacherous path to protect the boundaries of our world and the secrets of the multiverse.',
    total_inventory: 1,
    available: 1
};

const notAvailable: Book = {
    isbn: '1239876543210',
    title: 'The Enigma Chronicles',
    cover_url: 'https://m.media-amazon.com/images/I/81PM6jgJz3L._AC_UF1000,1000_QL80_.jpg',
    year: 2022,
    pages: 520,
    synopsis: 'In "The Enigma Chronicles," renowned detective Alex Sinclair faces his most baffling case yet. A series of seemingly unrelated puzzles and crimes unfold across the city, leading Alex down a twisted path of secrets and deception. As he races against time to decipher the enigma behind these incidents, he uncovers a hidden conspiracy that threatens to shake the foundations of society. The line between friend and foe blurs as Alex navigates a web of intrigue and danger, determined to uncover the truth before it\'s too late.',
    total_inventory: 2,
    available: 0
};

export const books = {
    sample: book,
    oneCopy: bookOneCopy,
    notAvailable,
};
