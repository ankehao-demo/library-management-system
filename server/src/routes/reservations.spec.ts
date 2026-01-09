import request from 'supertest';
import assert from 'assert';
import { getBaseUrl, users, books, cleanDatabase } from '../utils/testing-shared.js';
import IssueDetailsController from '../controllers/issue-details.js';
import BookController from '../controllers/books.js';


let adminJWT: string;
let userJWT: string;
let userId: string;

const issueDetailsController = new IssueDetailsController();
const bookController = new BookController();

describe('Reservation API', () => {
    const book = books.oneCopy;

    before(async () => {
        adminJWT = users.admin.jwt;
        userJWT = users.user1.jwt;
        userId = users.user1.id;
        
        await cleanDatabase();
        await request(getBaseUrl())
            .post('/books')
            .set('Authorization', `Bearer ${adminJWT}`)
            .send(book);
    });

    after(async () => {
        await cleanDatabase();
    });

    it('Should let users reserve a book', async () => {
        const createReservationResponse = await request(getBaseUrl())
            .post(`/reservations/${book.isbn}`)
            .set('Authorization', `Bearer ${userJWT}`)
            .expect(201);

        assert(createReservationResponse?.body?.message?.includes(issueDetailsController.success.CREATED), 'Book was not created');

        const getBooksResponse = await request(getBaseUrl())
            .get(`/books/${book.isbn}`)
            .expect(200)
            .expect('Content-Type', /json/);

        assert(getBooksResponse?.body?.available === 0, 'Book should not be available');
    });

    it('Should return 404 if the book does not exist', async () => {
        const createReservationResponse = await request(getBaseUrl())
            .post('/reservations/invalid')
            .set('Authorization', `Bearer ${userJWT}`)
            .expect(404);

        assert(createReservationResponse?.body?.message?.includes(bookController.errors.NOT_FOUND), 'Book should not exist');
    });

    it('Should return 400 if the book is not available', async () => {
        const createReservationResponse = await request(getBaseUrl())
            .post(`/reservations/${book.isbn}`)
            .set('Authorization', `Bearer ${userJWT}`)
            .expect(400);

        assert(createReservationResponse?.body?.message?.includes(bookController.errors.NOT_AVAILABLE), 'Book should not be available');
    });

    it('Should not let me reserve a book if I am not logged in', async () => {
        await request(getBaseUrl())
            .post('/reservations/9780075536321')
            .expect(401);
    });

    it('Should let me see my reserved books', async () => {
        const getReservationsResponse = await request(getBaseUrl())
            .get('/reservations')
            .set('Authorization', `Bearer ${userJWT}`)
            .expect(200);

        assert(getReservationsResponse?.body?.length === 1, 'There should be 1 reservation');
        assert(getReservationsResponse?.body?.[0]?.book?.isbn === book.isbn, 'The reservation should be for the correct book');
    });

    it('Should let the admin see a users reserved books', async () => {
        const getReservationsResponse = await request(getBaseUrl())
            .get(`/reservations/user/${userId}`)
            .set('Authorization', `Bearer ${adminJWT}`)
            .expect(200);

        assert(getReservationsResponse?.body?.length === 1, 'There should be 1 reservation');
        assert(getReservationsResponse?.body?.[0]?.book?.isbn === book.isbn, 'The reservation should be for the correct book');
    });

    it('Should let me cancel a reservation', async () => {
        const originalBook = await request(getBaseUrl())
            .get(`/books/${book.isbn}`)
            .expect(200);

        const cancelReservationResponse = await request(getBaseUrl())
            .delete(`/reservations/${book.isbn}`)
            .set('Authorization', `Bearer ${userJWT}`)
            .expect(200);

        assert(cancelReservationResponse?.body?.message?.includes(issueDetailsController.success.CANCELLED), 'Reservation should be cancelled');

        const newBook = await request(getBaseUrl())
            .get(`/books/${book.isbn}`)
            .expect(200);

        // After cancelling, available should increase by 1
        assert(newBook?.body?.available > originalBook?.body?.available, 'Book should be available again');
    });
});
