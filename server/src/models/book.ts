import { Review } from './review';

export interface BookAuthor {
    id: string;
    name: string;
}

export interface BookAttribute {
    key: string;
    value: string;
}

export interface Book {
    isbn: string;
    title: string;
    year?: number;
    cover_url?: string;
    genres?: string[];
    pages?: number;
    synopsis?: string;
    publisher?: string;
    long_title?: string;
    language?: string;
    binding?: string;
    total_inventory: number;
    book_of_month?: boolean;
    created_at?: string;
    updated_at?: string;
    authors?: BookAuthor[];
    attributes?: BookAttribute[];
    reviews?: Review[];
    available?: number;
}

export interface BookInsert {
    isbn: string;
    title: string;
    year?: number;
    cover_url?: string;
    pages?: number;
    synopsis?: string;
    publisher?: string;
    long_title?: string;
    language?: string;
    binding?: string;
    total_inventory?: number;
    book_of_month?: boolean;
}
