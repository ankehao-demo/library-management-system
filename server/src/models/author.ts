import { ObjectId } from 'mongodb';

/**
 * Author model as stored in the database.
 */
export interface Author {
    _id: ObjectId
    name: string;
    sanitizedName: string;
    aliases: Array<string>;
    bio?: string;

    /**
     * Array of ISBNs of books written by this author. Reference to the books collection.
     */
    books: Array<string>;

    /**
     * Author's birth year
     */
    birthYear?: number;

    /**
     * Author's nationality or country of origin
     */
    nationality?: string;

    /**
     * Author's official website URL
     */
    website?: string;

    /**
     * List of literary awards received
     */
    awards?: Array<string>;
}

/**
 * Author model as returned by the API.
 */
export type AuthorResponse = Omit<Author, 'books'> & {
    books: Array<{
        isbn: string;
        title: string;
    }>;
}
