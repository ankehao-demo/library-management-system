import { ObjectId } from 'mongodb';

export interface User {
    _id?: ObjectId;
    name: string;
    isAdmin?: boolean;

    /**
     * User's email address (unique)
     */
    email: string;

    /**
     * User's phone number
     */
    phone?: string;

    /**
     * Type of library membership
     */
    membershipType: string;

    /**
     * Date when user became a member
     */
    memberSince?: Date;

    /**
     * Maximum number of books user can borrow simultaneously
     */
    maxBorrowLimit: number;

    /**
     * User's mailing address
     */
    address?: {
        street: string;
        city: string;
        state: string;
        zipCode: string;
        country?: string;
    };

    /**
     * Whether the user account is active
     */
    active: boolean;
}
