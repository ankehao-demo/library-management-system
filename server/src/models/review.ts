import { ObjectId } from 'mongodb';

export interface Review {
    _id: ObjectId;
    text: string;
    name: string;
    rating?: number; // Optional as it could be added in a NLP Lab
    timestamp: number;

    /**
     * Reference to the book collection.
     */
    bookId: string;

    /**
     * Reference to user who wrote the review
     */
    userId?: ObjectId;

    /**
     * Whether the review is from a verified borrower
     */
    verified: boolean;

    /**
     * Number of users who found this review helpful
     */
    helpful?: number;

    /**
     * Review moderation status
     */
    status: string;

    /**
     * Sentiment analysis result (from NLP)
     */
    sentiment?: string;
}
