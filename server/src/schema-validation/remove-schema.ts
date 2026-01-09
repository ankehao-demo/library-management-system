import '../load-env-vars.js';
import { connectToDatabase, getSupabase } from '../database.js';

console.log('Connecting to Supabase...');
await connectToDatabase();
const supabase = getSupabase();
console.log('Connected!\n');

console.log('Schema validation is handled by Postgres constraints in Supabase.');
console.log('No action needed - constraints are defined in the database schema.');

const { error } = await supabase.from('users').select('id').limit(1);
if (error) {
    console.error('Error verifying connection:', error);
    process.exit(1);
}

console.log('Connection verified successfully.');
process.exit(0);
