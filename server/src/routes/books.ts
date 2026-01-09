import { Router } from 'express';
import { Request as AuthRequest } from 'express-jwt';
import { protectedRoute, adminRoute } from '../utils/middlewares.js';
import BookController from '../controllers/books.js';

const books = Router();
export default books;

const bookController = new BookController();

books.get('/', async (req, res) => {
    const limit = parseInt(req?.query?.limit as string) || undefined;
    const skip = parseInt(req?.query?.skip as string) || undefined;
    return res.json(await bookController.getBooks(limit, skip));
});

books.get('/search', async (req, res) => {
    const query = (req?.query?.term as string) || undefined;

    if (!query) {
        return res.status(400).send({message: 'missing query'});
    }

    const books = await bookController.searchBooks(query);

    return res.json(books);
});

books.post('/', protectedRoute, adminRoute, async (req: AuthRequest, res) => {
    const book = req?.body;

    if (!book || Object.keys(book).length === 0) {
        return res.status(400).send({message: bookController.errors.DETAILS_MISSING});
    }

    try {
        const result = await bookController.createBook(req?.body);
        return res.status(201).send({ result, message: bookController.success.CREATED });
    } catch (error) {
        return res.status(500).send({message: error});
    }
});

books.get('/:bookId', async (req, res) => {
    const bookId = req?.params?.bookId;

    if (!bookId) {
        return res.status(400).send({message: bookController.errors.BOOK_ID_MISSING});
    }

    const book = await bookController.getBook(bookId);

    if (!book){
        return res.status(404).send({message: bookController.errors.NOT_FOUND});
    }

    return res.json(book);
});

books.put('/:bookId', protectedRoute, adminRoute, async (req: AuthRequest, res) => {
    const bookId = req?.params?.bookId;
    const book = req?.body;

    if (!bookId) {
        return res.status(400).send({message: bookController.errors.BOOK_ID_MISSING});
    }

    if (!book || Object.keys(book).length === 0) {
        return res.status(400).send({message: bookController.errors.DETAILS_MISSING});
    }

    try {
        const result = await bookController.updateBook(bookId, book);
        return res.status(200).send({result, message: bookController.success.UPDATED});
    } catch(error) {
        return res.status(500).send({message: error});
    }
});

books.delete('/:bookId', protectedRoute, adminRoute, async (req: AuthRequest, res) => {
    const bookId = req?.params?.bookId;

    if (!bookId) {
        return res.status(400).send({message: bookController.errors.BOOK_ID_MISSING});
    }

    try {
        const result = await bookController.deleteBook(bookId);
        return res.status(202).send({result, message: bookController.success.DELETED});
    } catch (error) {
        if (error === bookController.errors.NOT_FOUND) return res.status(404).send({ message: error });
        return res.status(500).send({message: error});
    }
});
