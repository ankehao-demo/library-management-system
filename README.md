# Library Management System

This is a library management system built with the PEAN (Postgres/Supabase, Express, Angular, Node.js) stack. 

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

1.  Set your Supabase configuration and server port in `server/.env`. You can get these values from your Supabase project settings.

    **library/server/.env**
    ```
    PORT="5000"
    SECRET="secret"
    
    # Supabase configuration
    SUPABASE_URL="https://your-project.supabase.co"
    SUPABASE_ANON_KEY="your-anon-key"
    SUPABASE_SERVICE_KEY="your-service-key"
    ```

    Note: Use `SUPABASE_SERVICE_KEY` for server-side operations that need to bypass Row Level Security (RLS).


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

Note: Tests use `SUPABASE_SERVICE_KEY` to bypass RLS for testing purposes.

## Pre-commit hook

The project utilizes [Husky](https://typicode.github.io/husky/) to execute actions before every commit. The pre-commit hook, located in [.husky/pre-commit](./.husky/pre-commit), lints the code and runs the API tests.

## Database Schema

The application uses Supabase/Postgres with the following tables:
- `books` - Book catalog with ISBN as primary key
- `authors` - Author information
- `users` - User accounts
- `reviews` - Book reviews
- `reservations` - Book reservations
- `borrowed_books` - Borrowed book records
- `book_authors` - Many-to-many relationship between books and authors
- `book_genres` - Book genre associations
- `book_attributes` - Additional book attributes
- `author_aliases` - Author name aliases

Use at your own risk; not a supported product
