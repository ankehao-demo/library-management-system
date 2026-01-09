import { Book, BookInsert } from '../models/book.js';
import { supabase } from '../database.js';

class BookController {
    errors = {
        UNKNOWN_INSERT_ERROR: 'Unable to create book',
        UNKNOWN_UPDATE_ERROR: 'Unable to update book',
        UNKNOWN_DELETE_ERROR: 'Unable to delete book',
        NOT_FOUND: 'Book not found',
        DETAILS_MISSING: 'Book details are missing',
        BOOK_ID_MISSING: 'Book id is missing',
        ADMIN_ONLY: 'This operation is only allowed for admins',
        NOT_AVAILABLE: 'Book is not available'
    };

    success = {
        CREATED: 'Book created',
        UPDATED: 'Book updated',
        DELETED: 'Book deleted'
    };

    public async getBooks(limit: number = 12, skip: number = 0): Promise<Book[]> {
        if (limit > 100) {
            limit = 100;
        }

        const { data: books, error } = await supabase
            .from('books')
            .select('*')
            .range(skip, skip + limit - 1);

        if (error) {
            console.error('Error fetching books:', error);
            return [];
        }

        return books || [];
    }

    public async getBook(bookId: string): Promise<Book | undefined> {
        const { data: book, error } = await supabase
            .from('books')
            .select(`
                *,
                book_authors (
                    author_id,
                    authors (
                        id,
                        name
                    )
                ),
                book_genres (
                    genre
                ),
                reviews (
                    id,
                    reviewer_name,
                    text,
                    rating,
                    created_at
                )
            `)
            .eq('isbn', bookId)
            .single();

        if (error || !book) {
            return undefined;
        }

        const { count: reservationCount } = await supabase
            .from('reservations')
            .select('*', { count: 'exact', head: true })
            .eq('book_isbn', bookId);

        const { count: borrowedCount } = await supabase
            .from('borrowed_books')
            .select('*', { count: 'exact', head: true })
            .eq('book_isbn', bookId)
            .eq('returned', false);

        const totalHeld = (reservationCount || 0) + (borrowedCount || 0);
        const available = book.total_inventory - totalHeld;

        const authors = book.book_authors?.map((ba: { authors: { id: string; name: string } }) => ({
            id: ba.authors?.id,
            name: ba.authors?.name
        })).filter((a: { id: string; name: string }) => a.id) || [];

        const genres = book.book_genres?.map((bg: { genre: string }) => bg.genre) || [];

        return {
            ...book,
            authors,
            genres,
            available,
            reviews: book.reviews || []
        };
    }

    public async searchBooks(query: string): Promise<Book[]> {
        const { data: books, error } = await supabase
            .from('books')
            .select(`
                *,
                book_authors (
                    authors (
                        id,
                        name
                    )
                )
            `)
            .or(`title.ilike.%${query}%`)
            .limit(25);

        if (error) {
            console.error('Error searching books:', error);
            return [];
        }

        return (books || []).map(book => ({
            ...book,
            authors: book.book_authors?.map((ba: { authors: { id: string; name: string } }) => ({
                id: ba.authors?.id,
                name: ba.authors?.name
            })).filter((a: { id: string; name: string }) => a.id) || []
        }));
    }

    public async createBook(book: Book): Promise<{ isbn: string }> {
        const bookInsert: BookInsert = {
            isbn: book.isbn,
            title: book.title,
            year: book.year,
            cover_url: book.cover_url,
            pages: book.pages,
            synopsis: book.synopsis,
            publisher: book.publisher,
            long_title: book.long_title,
            language: book.language,
            binding: book.binding,
            total_inventory: book.total_inventory || 0,
            book_of_month: book.book_of_month
        };

        const { data, error } = await supabase
            .from('books')
            .insert(bookInsert)
            .select('isbn')
            .single();

        if (error || !data) {
            console.error('Error creating book:', error);
            throw new Error(this.errors.UNKNOWN_INSERT_ERROR);
        }

        if (book.authors && book.authors.length > 0) {
            const bookAuthors = book.authors.map((author, index) => ({
                book_isbn: book.isbn,
                author_id: author.id,
                display_order: index
            }));

            await supabase.from('book_authors').insert(bookAuthors);
        }

        if (book.genres && book.genres.length > 0) {
            const bookGenres = book.genres.map(genre => ({
                book_isbn: book.isbn,
                genre
            }));

            await supabase.from('book_genres').insert(bookGenres);
        }

        return { isbn: data.isbn };
    }

    public async updateBook(bookId: string, book: Partial<Book>): Promise<{ updated: boolean }> {
        const updateData: Partial<BookInsert> = {};
        
        if (book.title !== undefined) updateData.title = book.title;
        if (book.year !== undefined) updateData.year = book.year;
        if (book.cover_url !== undefined) updateData.cover_url = book.cover_url;
        if (book.pages !== undefined) updateData.pages = book.pages;
        if (book.synopsis !== undefined) updateData.synopsis = book.synopsis;
        if (book.publisher !== undefined) updateData.publisher = book.publisher;
        if (book.long_title !== undefined) updateData.long_title = book.long_title;
        if (book.language !== undefined) updateData.language = book.language;
        if (book.binding !== undefined) updateData.binding = book.binding;
        if (book.total_inventory !== undefined) updateData.total_inventory = book.total_inventory;
        if (book.book_of_month !== undefined) updateData.book_of_month = book.book_of_month;

        const { error, count } = await supabase
            .from('books')
            .update(updateData)
            .eq('isbn', bookId);

        if (error) {
            console.error('Error updating book:', error);
            throw new Error(this.errors.UNKNOWN_UPDATE_ERROR);
        }

        if (count === 0) {
            throw new Error(this.errors.UNKNOWN_UPDATE_ERROR);
        }

        return { updated: true };
    }

    public async deleteBook(bookId: string): Promise<{ deleted: boolean }> {
        await supabase.from('book_authors').delete().eq('book_isbn', bookId);
        await supabase.from('book_genres').delete().eq('book_isbn', bookId);
        await supabase.from('book_attributes').delete().eq('book_isbn', bookId);

        const { error, count } = await supabase
            .from('books')
            .delete()
            .eq('isbn', bookId);

        if (error) {
            console.error('Error deleting book:', error);
            throw new Error(this.errors.UNKNOWN_DELETE_ERROR);
        }

        if (count === 0) {
            throw new Error(this.errors.UNKNOWN_DELETE_ERROR);
        }

        return { deleted: true };
    }

    public async incrementBookInventory(bookId: string, count: number = 1): Promise<{ updated: boolean }> {
        return this.updateBookInventory(bookId, count);
    }

    public async decrementBookInventory(bookId: string, count: number = 1): Promise<{ updated: boolean }> {
        return this.updateBookInventory(bookId, -count);
    }

    public async isBookAvailable(bookId: string): Promise<Book> {
        const bookData = await this.getBook(bookId);

        if (!bookData) {
            throw new Error(this.errors.NOT_FOUND);
        }

        if ((bookData.available ?? 0) <= 0) {
            throw new Error(this.errors.NOT_AVAILABLE);
        }

        return bookData;
    }

    private async updateBookInventory(bookId: string, count: number): Promise<{ updated: boolean }> {
        const { data: book, error: fetchError } = await supabase
            .from('books')
            .select('total_inventory')
            .eq('isbn', bookId)
            .single();

        if (fetchError || !book) {
            throw new Error(this.errors.NOT_FOUND);
        }

        const { error } = await supabase
            .from('books')
            .update({ total_inventory: book.total_inventory + count })
            .eq('isbn', bookId);

        if (error) {
            throw new Error(this.errors.UNKNOWN_UPDATE_ERROR);
        }

        return { updated: true };
    }
}

export default BookController;
