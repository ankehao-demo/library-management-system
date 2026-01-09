import request from 'supertest';
import assert from 'assert';
import { Book } from '../models/book.js';
import { getBaseUrl, users, books } from '../utils/testing-shared.js';
import { cleanDatabase } from '../utils/testing-shared.js';
import IssueDetailsController from '../controllers/issue-details.js';

let adminJWT: string;
let userJWT: string;

const issueDetailsController = new IssueDetailsController();

describe('Borrows API', () => {
    const book: Book = books.sample;
    const unavailableBook: Book = books.notAvailable;
    const bookWithOneCopy: Book = books.oneCopy;

    before(async () => {
        adminJWT = users.admin.jwt;
        userJWT = users.user1.jwt;

        await cleanDatabase();

        await request(getBaseUrl())
            .post('/books')
            .set('Authorization', `Bearer ${adminJWT}`)
            .send(book);
        await request(getBaseUrl())
            .post('/books')
            .set('Authorization', `Bearer ${adminJWT}`)
            .send(unavailableBook);
        await request(getBaseUrl())
            .post('/books')
            .set('Authorization', `Bearer ${adminJWT}`)
            .send(bookWithOneCopy);
    });

    after(async () => {
        await cleanDatabase();
    });

    it('Should let a user with a reservation borrow a book', async () => {
        await request(getBaseUrl())
            .post(`/reservations/${book.isbn}`)
            .set('Authorization', `Bearer ${userJWT}`)
            .expect(201);

        await request(getBaseUrl())
            .post(`/borrow/${book.isbn}/${users.user1.id}`)
            .set('Authorization', `Bearer ${adminJWT}`)
            .expect(201);

        const response = await request(getBaseUrl())
            .get(`/books/${book.isbn}`)
            .set('Authorization', `Bearer ${userJWT}`)
            .expect(200);
        const avail = response.body.available;
        const expectedAvail = (book.available || 0) - 1;
        assert(avail == expectedAvail, 'There should be one less available book');

        const reservationResponse = await request(getBaseUrl())
            .get(`/reservations/${users.user1.id}R${book.isbn}`)
            .set('Authorization', `Bearer ${userJWT}`)
            .expect(404);
        assert(reservationResponse?.body?.message === issueDetailsController.errors.NOT_FOUND, 'The reservation should be deleted');

        const borrowedBooks = await request(getBaseUrl())
            .get('/borrow')
            .set('Authorization', `Bearer ${userJWT}`)
            .expect(200);

        assert(borrowedBooks?.body?.length === 1, 'The user should have one borrowed book');
        assert(borrowedBooks?.body?.[0]?.book?.isbn === book.isbn, 'The user should have the borrowed book with matching id');
    });

    it('Should let a user return a book', async () => {
        await request(getBaseUrl())
            .post(`/borrow/${book.isbn}/${users.user1.id}/return`)
            .set('Authorization', `Bearer ${adminJWT}`)
            .expect(200);

        const response = await request(getBaseUrl())
            .get(`/books/${book.isbn}`)
            .set('Authorization', `Bearer ${userJWT}`)
            .expect(200);
        assert(response?.body?.available === book.available, 'There should be one more available book');

        const borrowedBooks = await request(getBaseUrl())
            .get('/borrow')
            .set('Authorization', `Bearer ${userJWT}`)
            .expect(200);
        assert(borrowedBooks?.body?.length === 0, 'The user should not have any borrowed books');

        const borrowedHistory = await request(getBaseUrl())
            .get('/borrow/history')
            .set('Authorization', `Bearer ${userJWT}`)
            .expect(200);
        assert(borrowedHistory?.body?.length === 1, 'The user should have one borrowed book in their history');
    });

    it('Should let a user without a reservation borrow a book', async () => {
        await request(getBaseUrl())
            .post(`/borrow/${bookWithOneCopy.isbn}/${users.user1.id}`)
            .set('Authorization', `Bearer ${adminJWT}`)
            .expect(201);

        const finalBook = await request(getBaseUrl())
            .get(`/books/${bookWithOneCopy.isbn}`)
            .set('Authorization', `Bearer ${userJWT}`)
            .expect(200);
        assert(finalBook?.body?.available === 0, 'There should be one less available book');

        const borrowedBooks = await request(getBaseUrl())
            .get('/borrow')
            .set('Authorization', `Bearer ${userJWT}`)
            .expect(200);
        assert(borrowedBooks?.body?.length === 1, 'The user should have one borrowed book');
    });

    it('Should let a user renew a borrowed book if they already borrowed the book', async () => {
        await request(getBaseUrl())
            .post(`/borrow/${book.isbn}/${users.user1.id}`)
            .set('Authorization', `Bearer ${adminJWT}`)
            .expect(201);

        await request(getBaseUrl())
            .post(`/borrow/${book.isbn}/${users.user1.id}`)
            .set('Authorization', `Bearer ${adminJWT}`)
            .expect(201);
    });

    it('Should not let a user borrow and reserve more than 10 books', async () => {
        // Borrow 5 books

        // Reserve 5 books

        // Borrow another book

        // Expect error

    });

    it('Should not let a user return a book they have not borrowed', async () => {
        // Borrow a book

        // Return a different book

        // Expect error
    });

    it('Should let an admin return a book', async () => {
        // Borrow a book as a user

        // Return the book as an admin

        // Check that the book is available

        // Check that the user does not have the book in their borrowed books
    });

    it('Should let a user see their borrowed books', async () => {
        // Borrow a book

        // Check that the user has the book in their borrowed books
    });

    it('Should let a user see their history of borrowed books', async () => {
        // Borrow a book

        // Return the book

        // Check that the user has the book in their history of borrowed books
    });

});
