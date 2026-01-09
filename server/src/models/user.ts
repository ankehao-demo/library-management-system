export interface User {
    id: string;
    name: string;
    is_admin: boolean;
    created_at?: string;
    updated_at?: string;
}

export interface UserInsert {
    name: string;
    is_admin?: boolean;
}
