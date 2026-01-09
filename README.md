# Library Management System

This is a library management system built with the PEAN (PostgreSQL/Supabase, Express, Angular, Node.js) stack.

## Running the project

1. Clone the repository.

    ```
    git clone git@github.com:mongodb-developer/library-management-system.git library
    ```

1. Install the dependencies in the root level of the project.

    **library/**
    ```
    npm install
    ```

1. Set your Supabase configuration and server port in `server/.env`. You can find your Supabase URL and service role key in your Supabase project settings.

    **library/server/.env**
    ```
    PORT="5000"
    SUPABASE_URL="https://your-project.supabase.co"
    SUPABASE_SERVICE_KEY="your-service-role-key"
    SECRET="secret"
    ```

    Note: Use the service role key (not the anon key) for server-side operations as it bypasses Row Level Security.

1. Start the **server** application.

    **library/server/**
    ```
    npm install && npm start
    ```

1. Open a new terminal window and start the **client** application.

    **library/client/**
    ```
    npm install && npm start
    ```

1. When both applications are built and running, open your browser on http://localhost:4200/.

## Executing the tests

Currently, the project has only API tests implemented with [`supertest`](https://www.npmjs.com/package/supertest) and [`mocha`](https://www.npmjs.com/package/mocha). To execute them, navigate to the `server/` directory and run:

**library/server/**
```
npm test
```

## Pre-commit hook

The project utilizes [Husky](https://typicode.github.io/husky/) to execute actions before every commit. The pre-commit hook, located in [.husky/pre-commit](./.husky/pre-commit), lints the code and runs the API tests.

## Populating the Database

To populate the database with sample data (books, authors, users, reviews), run the populate script from the server directory while the server is running:

**library/server/**
```
node populate-database-idempotent.js
```

This script is idempotent and safe to run multiple times - it only creates data that doesn't already exist.

## Database Schema

The application uses Supabase (PostgreSQL) with the following tables:
- `users` - Library users with admin flag
- `authors` - Book authors with aliases
- `author_aliases` - Author name aliases
- `books` - Book catalog with ISBN as primary key
- `book_authors` - Junction table for book-author relationships
- `book_genres` - Book genre associations
- `book_attributes` - Additional book attributes
- `reviews` - User reviews for books
- `reservations` - Book reservations (12-hour expiration)
- `borrowed_books` - Active and historical book loans (21-day period)
- `v_book_availability` - View for computing real-time book availability

Use at your own risk; not a supported product
