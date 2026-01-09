import { Book, BookWithAvailability, BookResponse } from '../models/book.js';
import { getSupabase } from '../database.js';

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

    public async getBooks(limit: number = 12, skip: number = 0): Promise<BookWithAvailability[]> {
        if (limit > 100) {
            limit = 100;
        }

        const supabase = getSupabase();
        const { data: books, error } = await supabase
            .from('v_book_availability')
            .select('*')
            .range(skip, skip + limit - 1);

        if (error) {
            console.error('Error fetching books:', error);
            return [];
        }

        return books || [];
    }

    public async getBook(bookId: string): Promise<BookResponse | undefined> {
        const supabase = getSupabase();

        const { data: bookAvailability, error: availError } = await supabase
            .from('v_book_availability')
            .select('*')
            .eq('isbn', bookId)
            .single();

        if (availError || !bookAvailability) {
            return undefined;
        }

        const { data: bookData, error: bookError } = await supabase
            .from('books')
            .select('*')
            .eq('isbn', bookId)
            .single();

        if (bookError || !bookData) {
            return undefined;
        }

        const { data: authors } = await supabase
            .from('book_authors')
            .select(`
                author_id,
                display_order,
                authors (
                    name
                )
            `)
            .eq('book_isbn', bookId)
            .order('display_order');

        const { data: genres } = await supabase
            .from('book_genres')
            .select('genre')
            .eq('book_isbn', bookId);

        const { data: attributes } = await supabase
            .from('book_attributes')
            .select('key, value')
            .eq('book_isbn', bookId);

        const { data: reviews } = await supabase
            .from('reviews')
            .select('id, reviewer_name, text, rating, created_at')
            .eq('book_isbn', bookId)
            .order('created_at', { ascending: false })
            .limit(5);

        const bookResponse: BookResponse = {
            ...bookData,
            available: bookAvailability.available,
            reserved_count: bookAvailability.reserved_count,
            borrowed_count: bookAvailability.borrowed_count,
            authors: authors?.map(a => {
                const authorData = a.authors as unknown as { name: string } | null;
                return {
                    author_id: a.author_id,
                    name: authorData?.name || '',
                    display_order: a.display_order
                };
            }) || [],
            genres: genres?.map(g => g.genre) || [],
            attributes: attributes || [],
            reviews: reviews || []
        };

        return bookResponse;
    }

    public async searchBooks(query: string): Promise<BookWithAvailability[]> {
        const supabase = getSupabase();

        const { data: titleMatches } = await supabase
            .from('v_book_availability')
            .select('*')
            .ilike('title', `%${query}%`)
            .limit(25);

        const { data: authorMatches } = await supabase
            .from('book_authors')
            .select(`
                book_isbn,
                authors!inner (
                    name
                )
            `)
            .ilike('authors.name', `%${query}%`);

        const authorBookIsbns = authorMatches?.map(a => a.book_isbn) || [];

        let authorBooks: BookWithAvailability[] = [];
        if (authorBookIsbns.length > 0) {
            const { data } = await supabase
                .from('v_book_availability')
                .select('*')
                .in('isbn', authorBookIsbns);
            authorBooks = data || [];
        }

        const allBooks = [...(titleMatches || []), ...authorBooks];
        const uniqueBooks = allBooks.filter((book, index, self) =>
            index === self.findIndex(b => b.isbn === book.isbn)
        );

        return uniqueBooks.slice(0, 25);
    }

    public async createBook(book: Book): Promise<{ isbn: string }> {
        const supabase = getSupabase();

        const { data, error } = await supabase
            .from('books')
            .insert({
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
                total_inventory: book.total_inventory,
                book_of_month: book.book_of_month
            })
            .select('isbn')
            .single();

        if (error || !data) {
            console.error('Error creating book:', error);
            throw new Error(this.errors.UNKNOWN_INSERT_ERROR);
        }

        return { isbn: data.isbn };
    }

    public async updateBook(bookId: string, book: Partial<Book>): Promise<{ count: number }> {
        const supabase = getSupabase();

        const updateData: Record<string, unknown> = {};
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

        const { data, error } = await supabase
            .from('books')
            .update(updateData)
            .eq('isbn', bookId)
            .select();

        if (error) {
            console.error('Error updating book:', error);
            throw new Error(this.errors.UNKNOWN_UPDATE_ERROR);
        }

        if (!data || data.length === 0) {
            throw new Error(this.errors.UNKNOWN_UPDATE_ERROR);
        }

        return { count: data.length };
    }

    public async deleteBook(bookId: string): Promise<{ count: number }> {
        const supabase = getSupabase();

        const { data, error } = await supabase
            .from('books')
            .delete()
            .eq('isbn', bookId)
            .select();

        if (error) {
            console.error('Error deleting book:', error);
            throw new Error(this.errors.UNKNOWN_DELETE_ERROR);
        }

        if (!data || data.length === 0) {
            throw new Error(this.errors.UNKNOWN_UPDATE_ERROR);
        }

        return { count: data.length };
    }

    public async incrementBookInventory(bookId: string, count: number = 1): Promise<{ count: number }> {
        return this.updateBookInventory(bookId, count);
    }

    public async decrementBookInventory(bookId: string, count: number = 1): Promise<{ count: number }> {
        return this.updateBookInventory(bookId, -count);
    }

    public async isBookAvailable(bookId: string): Promise<BookResponse> {
        const bookData = await this.getBook(bookId);

        if (!bookData) {
            throw new Error(this.errors.NOT_FOUND);
        }

        if (bookData.available <= 0) {
            throw new Error(this.errors.NOT_AVAILABLE);
        }

        return bookData;
    }

    private async updateBookInventory(bookId: string, count: number): Promise<{ count: number }> {
        const supabase = getSupabase();

        const { data: currentBook, error: fetchError } = await supabase
            .from('books')
            .select('total_inventory')
            .eq('isbn', bookId)
            .single();

        if (fetchError || !currentBook) {
            throw new Error(this.errors.NOT_FOUND);
        }

        const newInventory = currentBook.total_inventory + count;

        const { data, error } = await supabase
            .from('books')
            .update({ total_inventory: newInventory })
            .eq('isbn', bookId)
            .select();

        if (error) {
            console.error('Error updating book inventory:', error);
            throw new Error(this.errors.UNKNOWN_UPDATE_ERROR);
        }

        return { count: data?.length || 0 };
    }
}

export default BookController;
