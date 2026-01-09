import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
    if (!supabaseClient) {
        throw new Error('Supabase client not initialized. Call connectToDatabase first.');
    }
    return supabaseClient;
}

export async function connectToDatabase(supabaseUrl?: string, supabaseKey?: string) {
    const url = supabaseUrl || process.env.SUPABASE_URL;
    const key = supabaseKey || process.env.SUPABASE_SERVICE_KEY;

    if (!url || !key) {
        throw new Error(`
        ####### ######  ######  ####### ######  
        #       #     # #     # #     # #     # 
        #       #     # #     # #     # #     # 
        #####   ######  ######  #     # ######  
        #       #   #   #   #   #     # #   #   
        #       #    #  #    #  #     # #    #  
        ####### #     # #     # ####### #     # 

        Missing Supabase configuration! Open the .env file and add:
        - SUPABASE_URL: Your Supabase project URL
        - SUPABASE_SERVICE_KEY: Your Supabase service role key (for server-side operations)
    `);
    }

    supabaseClient = createClient(url, key);

    return supabaseClient;
}
