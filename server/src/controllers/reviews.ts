import { supabase } from '../database.js';
import { Review, ReviewInsert } from '../models/review.js';

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

    public async createReview(bookId: string, reviewBody: { text: string; rating: number; }, userName: string): Promise<{ insertedId: string }> {
        const reviewInsert: ReviewInsert = {
            book_isbn: bookId,
            reviewer_name: userName,
            text: reviewBody?.text,
            rating: reviewBody?.rating
        };

        const { data, error } = await supabase
            .from('reviews')
            .insert(reviewInsert)
            .select('id')
            .single();

        if (error || !data) {
            console.error('Error creating review:', error);
            throw new Error(this.errors.UNKNOWN_ERROR);
        }

        return { insertedId: data.id };
    }

    public async getReview(bookId: string, reviewId: string): Promise<Review | null> {
        const { data: review, error } = await supabase
            .from('reviews')
            .select('*')
            .eq('id', reviewId)
            .eq('book_isbn', bookId)
            .maybeSingle();

        if (error) {
            console.error('Error fetching review:', error);
            return null;
        }

        return review;
    }
}

export default ReviewsController;
