import '../load-env-vars.js';
import { connectToDatabase, databases } from '../database.js';

const { DATABASE_URI } = process.env;

console.log('Connecting to MongoDB Atlas...');
await connectToDatabase(DATABASE_URI);
const db = databases.library;
console.log('Connected!\n');

const results = [];

const userSchema = {
    bsonType: 'object',
    required: ['name', 'isAdmin', 'email', 'membershipType', 'maxBorrowLimit', 'active'],
    properties: {
        name: {
            bsonType: 'string',
            minLength: 5,
            description: 'must be a string and is required'
        },
        isAdmin: {
            bsonType: 'bool',
            description: 'must be a boolean and is required'
        },
        email: {
            bsonType: 'string',
            pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
            description: 'must be a valid email address and is required'
        },
        membershipType: {
            bsonType: 'string',
            enum: ['Standard', 'Premium', 'Student', 'Senior', 'Faculty'],
            description: 'must be a valid membership type and is required'
        },
        maxBorrowLimit: {
            bsonType: 'int',
            minimum: 1,
            maximum: 50,
            description: 'must be an integer between 1 and 50 and is required'
        },
        active: {
            bsonType: 'bool',
            description: 'must be a boolean and is required'
        },
        phone: {
            bsonType: 'string',
            description: 'optional phone number'
        },
        memberSince: {
            bsonType: 'date',
            description: 'optional date when user became a member'
        },
        address: {
            bsonType: 'object',
            properties: {
                street: { bsonType: 'string' },
                city: { bsonType: 'string' },
                state: { bsonType: 'string' },
                zipCode: { bsonType: 'string' },
                country: { bsonType: 'string' }
            }
        }
    }
};

console.log('Applying schema validation for users...');
const resultUsers = await db.command({
    collMod: 'users',
    validator: {
        $jsonSchema: userSchema
    },
    validationLevel: 'strict',
    validationAction: 'error'
});

results.push(resultUsers);

// const authorSchema = {
//     bsonType: 'object',
//     required: ['name'],
//     properties: {
//         name: {
//             bsonType: 'string',
//             minLength: 5,
//             description: 'must be a string and is required'
//         },
//         // TODO: Add the missing validation rules for the authorSchema
//         // Hint: Look at the 'library.authors' collection in
//         // the MongoDB Atlas UI
//     }
// };

// console.log('Applying schema validation for authors...');
// const resultAuthors = await db.command({
//     // TODO: Modify the authors collection to apply the authorSchema
//     // Hint: Look at line 30 in this file.
// });

// results.push(resultAuthors);


const isStatusInvalid = (r) => r.ok!== 1;
if (results.some(isStatusInvalid)) {
    console.log(results);
    console.error('Failed to enable schema validation!');
    process.exit(1);
} else {
    console.log('Schema validation enabled!');
    process.exit(0);
}
