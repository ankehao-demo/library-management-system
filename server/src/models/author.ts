export interface Author {
    id: string;
    name: string;
    sanitized_name?: string;
    bio?: string;
    created_at?: string;
    updated_at?: string;
    aliases?: string[];
    books?: AuthorBook[];
}

export interface AuthorBook {
    isbn: string;
    title: string;
    cover_url?: string;
}

export interface AuthorInsert {
    name: string;
    sanitized_name?: string;
    bio?: string;
}

export type AuthorResponse = Author;
