import '../load-env-vars.js';
import { connectToDatabase, getSupabase } from '../database.js';

console.log('Connecting to Supabase...');
await connectToDatabase();
const supabase = getSupabase();
console.log('Connected!\n');

console.log('Testing Postgres constraint validation...');

try {
    const { error } = await supabase.from('users').insert({
        name: 'ab'
    });
    
    if (error) {
        console.log('Validation error (expected):', error.message);
        console.log('Constraint validation is working correctly.');
        process.exit(0);
    } else {
        console.log('Warning: Insert succeeded when it should have failed validation.');
        await supabase.from('users').delete().eq('name', 'ab');
        process.exit(1);
    }
}
catch (error) {
    console.log('Error:', (error as Error).message);
    process.exit(1);
}

