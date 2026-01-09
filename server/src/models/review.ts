export interface Review {
    id?: string;
    book_isbn: string;
    reviewer_name: string;
    text: string;
    rating?: number;
    created_at?: string;
}
