import '../load-env-vars.js';
import { connectToDatabase, supabase } from '../database.js';

console.log('Connecting to Supabase...');
await connectToDatabase();
console.log('Connected!\n');

console.log('Testing schema validation...');
console.log('In Supabase/Postgres, validation is handled by database constraints.\n');

try {
    // Try to insert a user with missing required fields
    const { error } = await supabase.from('users').insert({
        // Missing 'name' field which is required
    });
    
    if (error) {
        console.log('Validation error (expected):');
        console.log(error.message);
    } else {
        console.log('No validation error - check your constraints');
    }
}
catch (error) {
    console.log('Error:', error.message);
}

process.exit(0);

