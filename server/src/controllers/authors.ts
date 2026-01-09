import { AuthorResponse } from '../models/author.js';
import { getSupabase } from '../database.js';

export class AuthorController {
    errors = {
        NOT_FOUND: 'Author not found',
        AUTHOR_ID_MISSING: 'Author id is missing'
    };

    public async getAuthor(authorId: string): Promise<AuthorResponse | null> {
        const supabase = getSupabase();

        const { data: author, error } = await supabase
            .from('authors')
            .select('*')
            .eq('id', authorId)
            .single();

        if (error || !author) {
            return null;
        }

        const { data: aliases } = await supabase
            .from('author_aliases')
            .select('alias')
            .eq('author_id', authorId);

        const { data: bookAuthors } = await supabase
            .from('book_authors')
            .select(`
                book_isbn,
                books (
                    isbn,
                    title,
                    cover_url
                )
            `)
            .eq('author_id', authorId);

        const authorResponse: AuthorResponse = {
            ...author,
            aliases: aliases?.map(a => a.alias) || [],
            books: bookAuthors?.map(ba => {
                const bookData = ba.books as unknown as { isbn: string; title: string; cover_url?: string } | null;
                return {
                    isbn: bookData?.isbn || ba.book_isbn,
                    title: bookData?.title || '',
                    cover_url: bookData?.cover_url
                };
            }) || []
        };

        return authorResponse;
    }
}
