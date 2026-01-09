import { Review } from './review';

export interface Book {
    /**
     * ISBN (International Standard Book Number) of the book.
     * Primary key in Postgres.
     */
    isbn: string;
    title: string;
    year?: number;

    /**
     * URL to cover image.
     */
    cover_url?: string;
    pages?: number;
    synopsis?: string;
    publisher?: string;
    long_title?: string;
    language?: string;
    binding?: string;

    /**
     * Number of books in total.
     */
    total_inventory: number;

    /**
     * Number of books currently available.
     * This field is computed via the v_book_availability view.
     */
    available?: number;

    /**
     * Featured book flag.
     */
    book_of_month?: boolean;

    created_at?: string;
    updated_at?: string;
}

/**
 * Book with availability computed from the v_book_availability view.
 */
export interface BookWithAvailability extends Book {
    available: number;
    reserved_count?: number;
    borrowed_count?: number;
}

/**
 * Author reference for book display (from book_authors junction table).
 */
export interface BookAuthor {
    author_id: string;
    name: string;
    display_order?: number;
}

/**
 * Book genre (from book_genres table).
 */
export interface BookGenre {
    book_isbn: string;
    genre: string;
}

/**
 * Book attribute (from book_attributes table).
 */
export interface BookAttribute {
    id?: number;
    book_isbn: string;
    key: string;
    value: string;
}

/**
 * Extended book response with related data from normalized tables.
 */
export interface BookResponse extends BookWithAvailability {
    authors?: BookAuthor[];
    genres?: string[];
    attributes?: Array<{ key: string; value: string }>;
    reviews?: Array<Omit<Review, 'book_isbn'>>;
}
