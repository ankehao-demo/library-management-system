import request from 'supertest';
import assert from 'assert';
import { getBaseUrl } from '../utils/testing-shared.js';
import { supabase } from '../database.js';

describe('Authors API', () => {
    const book = {
        isbn: '9780261103665',
        title: 'Silmarillion',
        year: 1977,
        total_inventory: 1,
    };

    const author = {
        id: '5f9d88d3-ee5e-5e4c-9ef7-f1b000000001',
        name: 'J. R. R. Tolkien',
        sanitized_name: 'j-r-r-tolkien',
        bio: 'John Ronald Reuel Tolkien was an English writer, poet, philologist, and academic. He was the author of the high fantasy works The Hobbit and The Lord of the Rings.',
    };

    before(async () => {
        await supabase.from('books').upsert(book);
        await supabase.from('authors').upsert(author);
        await supabase.from('book_authors').upsert({ book_isbn: book.isbn, author_id: author.id });
        await supabase.from('author_aliases').upsert([
            { author_id: author.id, alias: 'Tolkien' },
            { author_id: author.id, alias: 'John Ronald Reuel Tolkien' }
        ]);
    });

    after(async () => {
        await supabase.from('book_authors').delete().eq('book_isbn', book.isbn);
        await supabase.from('author_aliases').delete().eq('author_id', author.id);
        await supabase.from('books').delete().eq('isbn', book.isbn);
        await supabase.from('authors').delete().eq('id', author.id);
    });

    it('Should retrieve authors by id', async () => {
        const response = await request(getBaseUrl())
            .get(`/authors/${author.id}`)
            .expect(200)
            .expect('Content-Type', /json/);

        assert(response?.body?.name === author.name, 'Author was not retrieved');

        const books = response?.body?.books;
        assert(books?.length === 1, 'Author books were not retrieved');
        assert(books[0].isbn === book.isbn, 'Author book ISBN was not in the response');
        assert(books[0].title === book.title, 'Author book title was not in the response');
    });
});
