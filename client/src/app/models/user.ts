export interface User {
    _id: string;
    name: string;
    isAdmin: boolean;
    email?: string;
    phone?: string;
    membershipType?: string;
    memberSince?: Date;
    maxBorrowLimit?: number;
    address?: {
        street: string;
        city: string;
        state: string;
        zipCode: string;
        country?: string;
    };
    active?: boolean;
}
