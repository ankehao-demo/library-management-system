import { supabase } from '../database.js';
import { BorrowedBook, IssueDetailType, Reservation, ReservationUser } from '../models/issue-detail.js';
import BookController from './books.js';
import UserController from './user.js';
import { User } from '../models/user.js';
import { Book } from '../models/book.js';

const bookController = new BookController();
const userController = new UserController();

class ReservationsController {
    errors = {
        MISSING_ID: 'Reservation id is missing',
        MISSING_DETAILS: 'Reservation details are missing',
        NOT_FOUND: 'Reservation not found',
        ADMIN_ONLY: 'This operation is only allowed for admins',
        INVALID_TYPE: 'Invalid type',
        ALREADY_RETURNED: 'Book is already returned',
        ALREADY_BOOKED: 'Book is already booked',
        INVALID_USER_ID: 'Invalid user id',
        INVALID_BOOK_ID: 'Invalid book id',
    };

    success = {
        CREATED: 'Reservation created',
        CANCELLED: 'Reservation cancelled'
    };

    RESERVATION_DURATION = 0.5; // 0.5 days -> 12 hours
    BORROWED_DURATION = 21; // days

    private getDueDate(type: string) {
        const now = Date.now();
        const daysInMs = 1000 * 60 * 60 * 24;
        const duration = type === IssueDetailType.Reservation ? this.RESERVATION_DURATION : this.BORROWED_DURATION;
        const dueDate = new Date(now + daysInMs * duration);
        return dueDate.toISOString();
    }

    public async getReservations(userId: string): Promise<Reservation[]> {
        const { data, error } = await supabase
            .from('reservations')
            .select(`
                *,
                books (
                    isbn,
                    title
                ),
                users (
                    id,
                    name
                )
            `)
            .eq('user_id', userId);

        if (error) {
            console.error('Error fetching reservations:', error);
            return [];
        }

        return (data || []).map(r => ({
            ...r,
            book: r.books ? { _id: r.books.isbn, isbn: r.books.isbn, title: r.books.title } : undefined,
            user: r.users ? { _id: r.users.id, id: r.users.id, name: r.users.name } : undefined
        }));
    }

    public async getReservation(reservationId: string): Promise<Reservation> {
        const { data, error } = await supabase
            .from('reservations')
            .select(`
                *,
                books (
                    isbn,
                    title
                ),
                users (
                    id,
                    name
                )
            `)
            .eq('id', reservationId)
            .single();

        if (error || !data) {
            throw new Error(this.errors.NOT_FOUND);
        }

        return {
            ...data,
            book: data.books ? { _id: data.books.isbn, isbn: data.books.isbn, title: data.books.title } : undefined,
            user: data.users ? { _id: data.users.id, id: data.users.id, name: data.users.name } : undefined
        };
    }

    public async getPagedReservations(limit = 50, skip = 0) {
        if (limit > 100) {
            limit = 100;
        }

        if (skip < 0) {
            skip = 0;
        }

        const { data, error, count } = await supabase
            .from('reservations')
            .select(`
                *,
                books (
                    isbn,
                    title
                ),
                users (
                    id,
                    name
                )
            `, { count: 'exact' })
            .order('expiration_date', { ascending: false })
            .range(skip, skip + limit - 1);

        if (error) {
            console.error('Error fetching paged reservations:', error);
            return { data: [], totalCount: 0 };
        }

        const mappedData = (data || []).map(r => ({
            ...r,
            book: r.books ? { _id: r.books.isbn, isbn: r.books.isbn, title: r.books.title } : undefined,
            user: r.users ? { _id: r.users.id, id: r.users.id, name: r.users.name } : undefined
        }));

        return {
            data: mappedData,
            totalCount: count || 0
        };
    }

    public async getBookReservationByUser(bookId: string, userId: string): Promise<Reservation | null> {
        const { data, error } = await supabase
            .from('reservations')
            .select(`
                *,
                books (
                    isbn,
                    title
                ),
                users (
                    id,
                    name
                )
            `)
            .eq('book_isbn', bookId)
            .eq('user_id', userId)
            .maybeSingle();

        if (error || !data) {
            return null;
        }

        return {
            ...data,
            book: data.books ? { _id: data.books.isbn, isbn: data.books.isbn, title: data.books.title } : undefined,
            user: data.users ? { _id: data.users.id, id: data.users.id, name: data.users.name } : undefined
        };
    }

    public async createReservation(user: ReservationUser, bookId: string) {
        const bookData = await bookController.isBookAvailable(bookId);
        const userId = user.id;

        const reservationInsert = {
            user_id: userId,
            book_isbn: bookData.isbn,
            expiration_date: this.getDueDate(IssueDetailType.Reservation)
        };

        const { data, error } = await supabase
            .from('reservations')
            .insert(reservationInsert)
            .select('id')
            .single();

        if (error) {
            console.error('Error creating reservation:', error);
            throw new Error(this.errors.MISSING_DETAILS);
        }

        // Note: We don't decrement total_inventory here because the 'available' field
        // is computed dynamically by counting reservations and borrowed books
        // await bookController.decrementBookInventory(bookData.isbn);

        return { insertedId: data.id };
    }

    public async cancelReservation(bookId: string, userId: string) {
        const { data: reservation, error: findError } = await supabase
            .from('reservations')
            .select('id')
            .eq('book_isbn', bookId)
            .eq('user_id', userId)
            .maybeSingle();

        if (findError || !reservation) {
            throw new Error(this.errors.NOT_FOUND);
        }

        const { error: deleteError } = await supabase
            .from('reservations')
            .delete()
            .eq('id', reservation.id);

        if (deleteError) {
            throw new Error(this.errors.NOT_FOUND);
        }

        // Note: We don't increment total_inventory here because the 'available' field
        // is computed dynamically by counting reservations and borrowed books
        // await bookController.incrementBookInventory(bookId);

        return { deletedCount: 1 };
    }

    public async borrowBook(bookId: string, userId: string) {
        let bookData: Book | undefined;
        try {
            bookData = await bookController.getBook(bookId);
        } catch (e) {
            console.error(e);
            throw new Error(this.errors.INVALID_BOOK_ID);
        }

        if (!bookData) {
            console.error(`Book with id ${bookId} not found`);
            throw new Error(this.errors.INVALID_BOOK_ID);
        }

        let userData: User | null;
        try {
            userData = await userController.getUserById(userId);
        } catch (e) {
            console.error(e);
            throw new Error(this.errors.INVALID_USER_ID);
        }

        if (!userData) {
            console.error(`User with id ${userId} not found`);
            throw new Error(this.errors.INVALID_USER_ID);
        }

        const { data: existingBorrow } = await supabase
            .from('borrowed_books')
            .select('id')
            .eq('book_isbn', bookId)
            .eq('user_id', userId)
            .eq('returned', false)
            .maybeSingle();

        if (existingBorrow) {
            // Renewal: update existing borrow record
            const { error: updateError } = await supabase
                .from('borrowed_books')
                .update({
                    borrow_date: new Date().toISOString(),
                    due_date: this.getDueDate(IssueDetailType.BorrowedBook)
                })
                .eq('id', existingBorrow.id);

            if (updateError) {
                throw new Error(updateError.message);
            }
        } else {
            const borrowInsert = {
                user_id: userId,
                book_isbn: bookId,
                borrow_date: new Date().toISOString(),
                due_date: this.getDueDate(IssueDetailType.BorrowedBook),
                returned: false
            };

            const { error: insertError } = await supabase
                .from('borrowed_books')
                .insert(borrowInsert);

            if (insertError) {
                throw new Error(insertError.message);
            }
        }

        const { data: reservation } = await supabase
            .from('reservations')
            .select('id')
            .eq('book_isbn', bookId)
            .eq('user_id', userId)
            .maybeSingle();

        if (reservation) {
            // Delete matching reservation since the user is now borrowing the book
            await supabase
                .from('reservations')
                .delete()
                .eq('id', reservation.id);
        }

        // Note: We don't modify total_inventory here because the 'available' field
        // is computed dynamically by counting reservations and borrowed books

        return { upserted: true };
    }

    public async getBorrows(userId: string): Promise<BorrowedBook[]> {
        const { data, error } = await supabase
            .from('borrowed_books')
            .select(`
                *,
                books (
                    isbn,
                    title
                ),
                users (
                    id,
                    name
                )
            `)
            .eq('user_id', userId)
            .eq('returned', false);

        if (error) {
            console.error('Error fetching borrows:', error);
            return [];
        }

        return (data || []).map(b => ({
            ...b,
            book: b.books ? { _id: b.books.isbn, isbn: b.books.isbn, title: b.books.title } : undefined,
            user: b.users ? { _id: b.users.id, id: b.users.id, name: b.users.name } : undefined
        }));
    }

    public async getPagedBorrows(limit = 50, skip = 0) {
        if (limit > 100) {
            limit = 100;
        }

        if (skip < 0) {
            skip = 0;
        }

        const { data, error, count } = await supabase
            .from('borrowed_books')
            .select(`
                *,
                books (
                    isbn,
                    title
                ),
                users (
                    id,
                    name
                )
            `, { count: 'exact' })
            .eq('returned', false)
            .order('borrow_date', { ascending: false })
            .range(skip, skip + limit - 1);

        if (error) {
            console.error('Error fetching paged borrows:', error);
            return { data: [], totalCount: 0 };
        }

        const mappedData = (data || []).map(b => ({
            ...b,
            book: b.books ? { _id: b.books.isbn, isbn: b.books.isbn, title: b.books.title } : undefined,
            user: b.users ? { _id: b.users.id, id: b.users.id, name: b.users.name } : undefined
        }));

        return {
            data: mappedData,
            totalCount: count || 0
        };
    }

    public async returnBook(userId: string, bookId: string) {
        const { data: borrow, error: findError } = await supabase
            .from('borrowed_books')
            .select('*')
            .eq('book_isbn', bookId)
            .eq('user_id', userId)
            .eq('returned', false)
            .maybeSingle();

        if (findError || !borrow) {
            console.error(this.errors.NOT_FOUND);
            throw new Error(this.errors.NOT_FOUND);
        }

        if (borrow.returned) {
            console.error(this.errors.ALREADY_RETURNED);
            throw new Error(this.errors.ALREADY_RETURNED);
        }

        const { error: updateError } = await supabase
            .from('borrowed_books')
            .update({
                returned: true,
                returned_date: new Date().toISOString()
            })
            .eq('id', borrow.id);

        if (updateError) {
            throw new Error(updateError.message);
        }

        // Note: We don't increment total_inventory here because the 'available' field
        // is computed dynamically by counting reservations and borrowed books
        // await bookController.incrementBookInventory(bookId);

        return { modifiedCount: 1 };
    }

    public async getBorrowedHistory(userId: string): Promise<BorrowedBook[]> {
        const { data, error } = await supabase
            .from('borrowed_books')
            .select(`
                *,
                books (
                    isbn,
                    title
                ),
                users (
                    id,
                    name
                )
            `)
            .eq('user_id', userId)
            .eq('returned', true);

        if (error) {
            console.error('Error fetching borrowed history:', error);
            return [];
        }

        return (data || []).map(b => ({
            ...b,
            book: b.books ? { _id: b.books.isbn, isbn: b.books.isbn, title: b.books.title } : undefined,
            user: b.users ? { _id: b.users.id, id: b.users.id, name: b.users.name } : undefined
        }));
    }
}

export default ReservationsController;
