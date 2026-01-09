import { getSupabase } from '../database.js';
import { Review } from '../models/review.js';

class ReviewsController {
    errors = {
        UNKNOWN_ERROR: 'An unknown error has occurred',
        DETAILS_MISSING: 'Review details are missing',
        REVIEW_ID_MISSING: 'Review id is missing',
        NOT_FOUND: 'Review not found'
    };

    success = {
        CREATED: 'Review created'
    };

    public async getReviews(bookId: string): Promise<Review[]> {
        const supabase = getSupabase();

        const { data: reviews, error } = await supabase
            .from('reviews')
            .select('*')
            .eq('book_isbn', bookId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching reviews:', error);
            return [];
        }

        return reviews || [];
    }

    public async createReview(bookId: string, reviewBody: { text: string; rating: number; }, userName: string): Promise<{ id: string }> {
        const supabase = getSupabase();

        const review: Omit<Review, 'id' | 'created_at'> = {
            book_isbn: bookId,
            reviewer_name: userName,
            text: reviewBody?.text,
            rating: reviewBody?.rating
        };

        const { data, error } = await supabase
            .from('reviews')
            .insert(review)
            .select('id')
            .single();

        if (error || !data) {
            console.error('Error creating review:', error);
            throw new Error(this.errors.DETAILS_MISSING);
        }

        return { id: data.id };
    }

    public async getReview(bookId: string, reviewId: string): Promise<Review | null> {
        const supabase = getSupabase();

        const { data: review, error } = await supabase
            .from('reviews')
            .select('*')
            .eq('id', reviewId)
            .eq('book_isbn', bookId)
            .single();

        if (error || !review) {
            return null;
        }

        return review;
    }
}

export default ReviewsController;
