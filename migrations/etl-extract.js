import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import { writeFileSync } from 'fs';

dotenv.config();

const URI = process.env.DATABASE_URI;
const client = new MongoClient(URI);

async function extractData() {
    try {
        await client.connect();
        console.log('Connected successfully to MongoDB');

        const db = client.db('library');

        const collections = ['books', 'users', 'issueDetails', 'authors', 'reviews'];
        const extractedData = {};

        for (const collectionName of collections) {
            const collection = db.collection(collectionName);
            const count = await collection.countDocuments();
            const documents = await collection.find().toArray();
            extractedData[collectionName] = documents;
            console.log(`Extracted ${count} documents from ${collectionName}`);
        }

        writeFileSync('extracted-data.json', JSON.stringify(extractedData, null, 2));
        console.log('Data extracted and saved to extracted-data.json');

        return extractedData;
    } finally {
        await client.close();
    }
}

extractData().catch(console.error);
