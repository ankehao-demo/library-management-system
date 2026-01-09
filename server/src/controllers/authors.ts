import { AuthorResponse } from '../models/author.js';
import { supabase } from '../database.js';

export class AuthorController {
    errors = {
        NOT_FOUND: 'Author not found',
        AUTHOR_ID_MISSING: 'Author id is missing'
    };

    public async getAuthor(authorId: string): Promise<AuthorResponse | null> {
        const { data: author, error } = await supabase
            .from('authors')
            .select(`
                *,
                author_aliases (
                    alias
                ),
                book_authors (
                    books (
                        isbn,
                        title,
                        cover_url
                    )
                )
            `)
            .eq('id', authorId)
            .single();

        if (error || !author) {
            return null;
        }

        const aliases = author.author_aliases?.map((a: { alias: string }) => a.alias) || [];
        const books = author.book_authors?.map((ba: { books: { isbn: string; title: string; cover_url?: string } }) => ({
            isbn: ba.books?.isbn,
            title: ba.books?.title,
            cover_url: ba.books?.cover_url
        })).filter((b: { isbn: string }) => b.isbn) || [];

        return {
            id: author.id,
            name: author.name,
            sanitized_name: author.sanitized_name,
            bio: author.bio,
            created_at: author.created_at,
            updated_at: author.updated_at,
            aliases,
            books
        };
    }
}
