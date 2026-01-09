export enum IssueDetailType {
    Reservation = 'R',
    BorrowedBook = 'B'
}

export interface ReservationUser {
    id: string;
    name: string;
}

export interface ReservationBook {
    isbn: string;
    title: string;
}

export interface Reservation {
    id: string;
    user_id: string;
    book_isbn: string;
    expiration_date: string;
    created_at?: string;
    user?: ReservationUser;
    book?: ReservationBook;
}

export interface ReservationInsert {
    user_id: string;
    book_isbn: string;
    expiration_date: string;
}

export interface BorrowedBook {
    id: string;
    user_id: string;
    book_isbn: string;
    borrow_date: string;
    due_date: string;
    returned: boolean;
    returned_date?: string;
    created_at?: string;
    user?: ReservationUser;
    book?: ReservationBook;
}

export interface BorrowedBookInsert {
    user_id: string;
    book_isbn: string;
    borrow_date: string;
    due_date: string;
    returned?: boolean;
}

export type IssueDetail = BorrowedBook | Reservation;
