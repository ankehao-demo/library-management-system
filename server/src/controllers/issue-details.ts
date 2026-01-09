import { getSupabase } from '../database.js';
import { BorrowedBook, IssueDetailType, Reservation, ReservationUser, ReservationWithDetails, BorrowedBookWithDetails } from '../models/issue-detail.js';
import BookController from './books.js';
import UserController from './user.js';
import { User } from '../models/user.js';
import { BookResponse } from '../models/book.js';

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

    private async getPagedReservationsData(limit = 50, skip = 0): Promise<{ data: ReservationWithDetails[], totalCount: number }> {
        const supabase = getSupabase();

        const { count } = await supabase
            .from('reservations')
            .select('*', { count: 'exact', head: true });

        const { data, error } = await supabase
            .from('reservations')
            .select(`
                *,
                users (id, name),
                books (isbn, title)
            `)
            .order('expiration_date', { ascending: false })
            .range(skip, skip + limit - 1);

        if (error) {
            console.error('Error fetching reservations:', error);
            return { data: [], totalCount: 0 };
        }

        const reservations: ReservationWithDetails[] = (data || []).map(r => ({
            id: r.id,
            user_id: r.user_id,
            book_isbn: r.book_isbn,
            expiration_date: r.expiration_date,
            created_at: r.created_at,
            user: r.users ? { id: r.users.id, name: r.users.name } : undefined,
            book: r.books ? { isbn: r.books.isbn, title: r.books.title } : undefined
        }));

        return { data: reservations, totalCount: count || 0 };
    }

    private async getPagedBorrowsData(limit = 50, skip = 0): Promise<{ data: BorrowedBookWithDetails[], totalCount: number }> {
        const supabase = getSupabase();

        const { count } = await supabase
            .from('borrowed_books')
            .select('*', { count: 'exact', head: true })
            .eq('returned', false);

        const { data, error } = await supabase
            .from('borrowed_books')
            .select(`
                *,
                users (id, name),
                books (isbn, title)
            `)
            .eq('returned', false)
            .order('borrow_date', { ascending: false })
            .range(skip, skip + limit - 1);

        if (error) {
            console.error('Error fetching borrowed books:', error);
            return { data: [], totalCount: 0 };
        }

        const borrows: BorrowedBookWithDetails[] = (data || []).map(b => ({
            id: b.id,
            user_id: b.user_id,
            book_isbn: b.book_isbn,
            borrow_date: b.borrow_date,
            due_date: b.due_date,
            returned: b.returned,
            returned_date: b.returned_date,
            created_at: b.created_at,
            user: b.users ? { id: b.users.id, name: b.users.name } : undefined,
            book: b.books ? { isbn: b.books.isbn, title: b.books.title } : undefined
        }));

        return { data: borrows, totalCount: count || 0 };
    }

    private getDueDate(type: string): Date {
        const now = Date.now();
        const daysInMs = 1000 * 60 * 60 * 24;
        const duration = type === IssueDetailType.Reservation ? this.RESERVATION_DURATION : this.BORROWED_DURATION;
        const dueDate = new Date(now + daysInMs * duration);
        return dueDate;
    }

    public async getReservations(userId: string): Promise<ReservationWithDetails[]> {
        const supabase = getSupabase();

        const { data, error } = await supabase
            .from('reservations')
            .select(`
                *,
                books (isbn, title)
            `)
            .eq('user_id', userId);

        if (error) {
            console.error('Error fetching user reservations:', error);
            return [];
        }

        return (data || []).map(r => ({
            id: r.id,
            user_id: r.user_id,
            book_isbn: r.book_isbn,
            expiration_date: r.expiration_date,
            created_at: r.created_at,
            book: r.books ? { isbn: r.books.isbn, title: r.books.title } : undefined
        }));
    }

    public async getReservation(reservationId: string): Promise<ReservationWithDetails> {
        const supabase = getSupabase();

        const { data, error } = await supabase
            .from('reservations')
            .select(`
                *,
                users (id, name),
                books (isbn, title)
            `)
            .eq('id', reservationId)
            .single();

        if (error || !data) {
            throw new Error(this.errors.NOT_FOUND);
        }

        return {
            id: data.id,
            user_id: data.user_id,
            book_isbn: data.book_isbn,
            expiration_date: data.expiration_date,
            created_at: data.created_at,
            user: data.users ? { id: data.users.id, name: data.users.name } : undefined,
            book: data.books ? { isbn: data.books.isbn, title: data.books.title } : undefined
        };
    }

    public async getPagedReservations(limit = 50, skip = 0): Promise<{ data: ReservationWithDetails[], totalCount: number }> {
        if (limit > 100) {
            limit = 100;
        }

        if (skip < 0) {
            skip = 0;
        }

        return this.getPagedReservationsData(limit, skip);
    }

    public async getBookReservationByUser(bookId: string, userId: string): Promise<Reservation | null> {
        const supabase = getSupabase();

        const { data, error } = await supabase
            .from('reservations')
            .select('*')
            .eq('book_isbn', bookId)
            .eq('user_id', userId)
            .single();

        if (error || !data) {
            return null;
        }

        return data;
    }

    public async createReservation(user: ReservationUser, bookId: string): Promise<{ id: string }> {
        const supabase = getSupabase();

        const bookData = await bookController.isBookAvailable(bookId);
        const userId = user.id;

        const reservation: Omit<Reservation, 'id' | 'created_at'> = {
            user_id: userId,
            book_isbn: bookData.isbn,
            expiration_date: this.getDueDate(IssueDetailType.Reservation).toISOString(),
        };

        const { data, error } = await supabase
            .from('reservations')
            .insert(reservation)
            .select('id')
            .single();

        if (error || !data) {
            console.error('Error creating reservation:', error);
            throw new Error(this.errors.MISSING_DETAILS);
        }

        return { id: data.id };
    }

    public async cancelReservation(bookId: string, userId: string): Promise<{ count: number }> {
        const supabase = getSupabase();

        const { data, error } = await supabase
            .from('reservations')
            .delete()
            .eq('book_isbn', bookId)
            .eq('user_id', userId)
            .select();

        if (error) {
            console.error('Error cancelling reservation:', error);
            throw new Error(this.errors.NOT_FOUND);
        }

        if (!data || data.length === 0) {
            throw new Error(this.errors.NOT_FOUND);
        }

        return { count: data.length };
    }

    public async borrowBook(bookId: string, userId: string): Promise<{ id: string }> {
        const supabase = getSupabase();

        let bookData: BookResponse | undefined;
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
            .single();

        let borrowId: string;

        if (existingBorrow) {
            const { data, error } = await supabase
                .from('borrowed_books')
                .update({
                    due_date: this.getDueDate(IssueDetailType.BorrowedBook).toISOString()
                })
                .eq('id', existingBorrow.id)
                .select('id')
                .single();

            if (error || !data) {
                throw new Error(this.errors.MISSING_DETAILS);
            }
            borrowId = data.id;
        } else {
            const borrow: Omit<BorrowedBook, 'id' | 'created_at'> = {
                user_id: userId,
                book_isbn: bookId,
                borrow_date: new Date().toISOString(),
                due_date: this.getDueDate(IssueDetailType.BorrowedBook).toISOString(),
                returned: false
            };

            const { data, error } = await supabase
                .from('borrowed_books')
                .insert(borrow)
                .select('id')
                .single();

            if (error || !data) {
                console.error('Error creating borrow:', error);
                throw new Error(this.errors.MISSING_DETAILS);
            }
            borrowId = data.id;
        }

        await supabase
            .from('reservations')
            .delete()
            .eq('book_isbn', bookId)
            .eq('user_id', userId);

        return { id: borrowId };
    }

    public async getBorrows(userId: string): Promise<BorrowedBookWithDetails[]> {
        const supabase = getSupabase();

        const { data, error } = await supabase
            .from('borrowed_books')
            .select(`
                *,
                books (isbn, title)
            `)
            .eq('user_id', userId)
            .eq('returned', false);

        if (error) {
            console.error('Error fetching user borrows:', error);
            return [];
        }

        return (data || []).map(b => ({
            id: b.id,
            user_id: b.user_id,
            book_isbn: b.book_isbn,
            borrow_date: b.borrow_date,
            due_date: b.due_date,
            returned: b.returned,
            returned_date: b.returned_date,
            created_at: b.created_at,
            book: b.books ? { isbn: b.books.isbn, title: b.books.title } : undefined
        }));
    }

    public async getPagedBorrows(limit = 50, skip = 0): Promise<{ data: BorrowedBookWithDetails[], totalCount: number }> {
        if (limit > 100) {
            limit = 100;
        }

        if (skip < 0) {
            skip = 0;
        }

        return this.getPagedBorrowsData(limit, skip);
    }

    public async returnBook(userId: string, bookId: string): Promise<{ count: number }> {
        const supabase = getSupabase();

        const { data: borrow, error: fetchError } = await supabase
            .from('borrowed_books')
            .select('*')
            .eq('book_isbn', bookId)
            .eq('user_id', userId)
            .eq('returned', false)
            .single();

        if (fetchError || !borrow) {
            console.error(this.errors.NOT_FOUND);
            throw new Error(this.errors.NOT_FOUND);
        }

        if (borrow.returned) {
            console.error(this.errors.ALREADY_RETURNED);
            throw new Error(this.errors.ALREADY_RETURNED);
        }

        const { data, error } = await supabase
            .from('borrowed_books')
            .update({
                returned: true,
                returned_date: new Date().toISOString()
            })
            .eq('id', borrow.id)
            .select();

        if (error) {
            console.error('Error returning book:', error);
            throw new Error(this.errors.NOT_FOUND);
        }

        return { count: data?.length || 0 };
    }

    public async getBorrowedHistory(userId: string): Promise<BorrowedBookWithDetails[]> {
        const supabase = getSupabase();

        const { data, error } = await supabase
            .from('borrowed_books')
            .select(`
                *,
                books (isbn, title)
            `)
            .eq('user_id', userId)
            .eq('returned', true);

        if (error) {
            console.error('Error fetching borrowed history:', error);
            return [];
        }

        return (data || []).map(b => ({
            id: b.id,
            user_id: b.user_id,
            book_isbn: b.book_isbn,
            borrow_date: b.borrow_date,
            due_date: b.due_date,
            returned: b.returned,
            returned_date: b.returned_date,
            created_at: b.created_at,
            book: b.books ? { isbn: b.books.isbn, title: b.books.title } : undefined
        }));
    }
}

export default ReservationsController;
