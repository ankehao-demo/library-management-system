import '../load-env-vars.js';
import { connectToDatabase, getSupabase } from '../database.js';

console.log('Connecting to Supabase...');
await connectToDatabase();
const supabase = getSupabase();
console.log('Connected!\n');

console.log('Checking borrowed_books table indexes...');

const { data: borrows, error } = await supabase
    .from('borrowed_books')
    .select('id, user_id, book_isbn, borrow_date, returned_date')
    .eq('user_id', '65133d20-e861-a187-0946-72a700000001')
    .gte('borrow_date', '2024-04-01')
    .order('returned_date', { ascending: false })
    .limit(10);

if (error) {
    console.error('Error querying borrowed_books:', error);
    process.exit(1);
}

console.log(`Found ${borrows?.length || 0} borrowed books matching the query.`);

console.log('\nNote: In Supabase/Postgres, indexes are managed through the database schema.');
console.log('Recommended indexes for borrowed_books table:');
console.log('  - CREATE INDEX idx_borrowed_books_user_id ON borrowed_books(user_id);');
console.log('  - CREATE INDEX idx_borrowed_books_borrow_date ON borrowed_books(borrow_date);');
console.log('  - CREATE INDEX idx_borrowed_books_returned_date ON borrowed_books(returned_date);');

process.exit(0);
