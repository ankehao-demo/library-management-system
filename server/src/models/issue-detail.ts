/**
 * In Postgres, reservations and borrowed_books are stored in separate tables
 * instead of the MongoDB polymorphic single-collection pattern.
 */

/**
 * Reservation record from the reservations table.
 */
export interface Reservation {
    id?: string;
    user_id: string;
    book_isbn: string;
    expiration_date: string;
    created_at?: string;
}

/**
 * Borrowed book record from the borrowed_books table.
 */
export interface BorrowedBook {
    id?: string;
    user_id: string;
    book_isbn: string;
    borrow_date: string;
    due_date: string;
    returned: boolean;
    returned_date?: string;
    created_at?: string;
}

/**
 * Reservation with joined user and book data for API responses.
 */
export interface ReservationWithDetails extends Reservation {
    user?: {
        id: string;
        name: string;
    };
    book?: {
        isbn: string;
        title: string;
    };
}

/**
 * Borrowed book with joined user and book data for API responses.
 */
export interface BorrowedBookWithDetails extends BorrowedBook {
    user?: {
        id: string;
        name: string;
    };
    book?: {
        isbn: string;
        title: string;
    };
}

/**
 * Issue detail type enum for distinguishing between reservations and borrows.
 */
export enum IssueDetailType {
    Reservation = 'R',
    BorrowedBook = 'B'
}

/**
 * User reference for reservation/borrow operations.
 */
export interface ReservationUser {
    id: string;
    name: string;
}

/**
 * Book reference for reservation/borrow operations.
 */
export interface ReservationBook {
    isbn: string;
    title: string;
}
