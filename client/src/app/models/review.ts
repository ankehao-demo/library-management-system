/**
 * Review model as returned by the API.
 */
export interface Review {
    text: string;
    name: string;
    rating: number;
    timestamp: number;
    userId?: string;
    verified?: boolean;
    helpful?: number;
    status?: string;
    sentiment?: string;
}
