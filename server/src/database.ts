import { createClient, SupabaseClient } from '@supabase/supabase-js';

export let supabase: SupabaseClient;

export async function connectToDatabase() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        throw new Error(`
        ####### ######  ######  ####### ######  
        #       #     # #     # #     # #     # 
        #       #     # #     # #     # #     # 
        #####   ######  ######  #     # ######  
        #       #   #   #   #   #     # #   #   
        #       #    #  #    #  #     # #    #  
        ####### #     # #     # ####### #     # 

        Missing Supabase configuration! Add SUPABASE_URL and SUPABASE_SERVICE_KEY (or SUPABASE_ANON_KEY) to your .env file.
    `);
    }

    supabase = createClient(supabaseUrl, supabaseKey);

    return supabase;
}
