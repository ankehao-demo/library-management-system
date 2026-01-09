import '../load-env-vars.js';
import { connectToDatabase, supabase } from '../database.js';

console.log('Connecting to Supabase...');
await connectToDatabase();
console.log('Connected!\n');

console.log('Borrowed Books Index Management for Supabase/Postgres');
console.log('=====================================================\n');

console.log('In Supabase/Postgres, indexes are managed through SQL migrations.');
console.log('The following indexes are recommended for the borrowed_books table:\n');

console.log('1. Index on user_id for user-specific queries:');
console.log('   CREATE INDEX idx_borrowed_books_user_id ON borrowed_books(user_id);\n');

console.log('2. Composite index for user + borrow_date queries:');
console.log('   CREATE INDEX idx_borrowed_books_user_borrow_date ON borrowed_books(user_id, borrow_date DESC);\n');

console.log('3. Index on returned_date for sorting:');
console.log('   CREATE INDEX idx_borrowed_books_returned_date ON borrowed_books(returned_date DESC);\n');

console.log('To check existing indexes, run:');
console.log('   SELECT indexname, indexdef FROM pg_indexes WHERE tablename = \'borrowed_books\';\n');

// Example query to demonstrate Supabase usage
console.log('Testing a sample query...');
const { data, error } = await supabase
    .from('borrowed_books')
    .select('*')
    .eq('returned', false)
    .order('borrow_date', { ascending: false })
    .limit(5);

if (error) {
    console.log('Query error:', error.message);
} else {
    console.log(`Found ${data?.length || 0} active borrowed books`);
}

process.exit(0);
