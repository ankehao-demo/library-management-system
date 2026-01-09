/**
 * Author model as stored in the database.
 */
export interface Author {
    id: string;
    name: string;
    sanitized_name?: string;
    bio?: string;
    created_at?: string;
    updated_at?: string;
}

/**
 * Author alias (from author_aliases table).
 */
export interface AuthorAlias {
    id?: number;
    author_id: string;
    alias: string;
}

/**
 * Author model as returned by the API with related data.
 */
export interface AuthorResponse extends Author {
    aliases?: string[];
    books?: Array<{
        isbn: string;
        title: string;
        cover_url?: string;
    }>;
}
