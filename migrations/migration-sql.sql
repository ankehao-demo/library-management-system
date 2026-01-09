INSERT INTO users (id, name, is_admin) VALUES
    ('30eef044-4ec1-4fb3-9cfe-244626723689', 'Rowdy Quetzal', true),
    ('ecdd649b-0f47-47b7-b1b2-8afe6b4be11a', 'Sneaky Quetzal', true),
    ('b12cf4d6-cfcf-4b96-b8c2-56b07823945c', 'Luminous Rhino', true),
    ('f5eea260-4ac3-4e28-bef0-762680e75018', 'Pompous Narwhal', true),
    ('30e3e680-3e1f-4e91-abe6-930ce0bd8b53', 'Rowdy Scorpion', true),
    ('175e9e41-868b-4772-af75-21ccce9822cf', 'Ignominious Narwhal', true),
    ('b6329177-cda2-41a5-82cb-6c2e754b7e7e', 'Golden Barracuda', true),
    ('2f44d00c-f99c-443e-957f-9902b8cde615', 'Chill Rhino', true),
    ('13858a5b-da99-4b90-9450-b449fd7df5ee', 'Abrasive Quetzal', true);

INSERT INTO authors (id, name, sanitized_name, bio) VALUES
    ('a759f490-3f2b-454e-b404-cdc4b3fe842a', 'F. Scott Fitzgerald', 'f-scott-fitzgerald', 'American novelist, essayist, and short story writer known for depicting the flamboyance and excess of the Jazz Age.'),
    ('d4aba24e-24f6-4485-baa7-c2eaa6b7955c', 'Harper Lee', 'harper-lee', 'American novelist best known for To Kill a Mockingbird, which won the 1961 Pulitzer Prize.'),
    ('63d11ddc-b846-4f26-9d61-a9739eef9298', 'George Orwell', 'george-orwell', 'English novelist, essayist, journalist and critic known for works like 1984 and Animal Farm.'),
    ('208e9931-1af7-4ff4-8a52-3bd6545d8cff', 'Jane Austen', 'jane-austen', 'English novelist known primarily for her six major novels, which interpret, critique and comment upon the British landed gentry at the end of the 18th century.'),
    ('775c1da8-4abc-4f97-b902-c9b6eb381b23', 'J.D. Salinger', 'jd-salinger', 'American writer best known for his 1951 novel The Catcher in the Rye.'),
    ('0cebbdcc-bdfb-4aae-91d0-4ace46c2ef00', 'William Golding', 'william-golding', 'British novelist, playwright, and poet. Best known for his debut novel Lord of the Flies.'),
    ('f5000e73-f788-4174-bba9-1b4e1f244266', 'J.K. Rowling', 'jk-rowling', 'British author, best known for the Harry Potter series of fantasy novels.'),
    ('a57776c2-9f99-460b-b360-45cde501e7c8', 'Agatha Christie', 'agatha-christie', 'English writer known for her sixty-six detective novels and fourteen short story collections.');

INSERT INTO author_aliases (author_id, alias) VALUES
    ('a759f490-3f2b-454e-b404-cdc4b3fe842a', 'Francis Scott Key Fitzgerald'),
    ('d4aba24e-24f6-4485-baa7-c2eaa6b7955c', 'Nelle Harper Lee'),
    ('63d11ddc-b846-4f26-9d61-a9739eef9298', 'Eric Arthur Blair'),
    ('775c1da8-4abc-4f97-b902-c9b6eb381b23', 'Jerome David Salinger'),
    ('0cebbdcc-bdfb-4aae-91d0-4ace46c2ef00', 'Sir William Gerald Golding'),
    ('f5000e73-f788-4174-bba9-1b4e1f244266', 'Joanne Rowling'),
    ('a57776c2-9f99-460b-b360-45cde501e7c8', 'Dame Agatha Mary Clarissa Christie');

INSERT INTO books (isbn, title, year, cover_url, pages, synopsis, publisher, long_title, language, binding, total_inventory, book_of_month) VALUES
    ('9780743273565', 'The Great Gatsby', 1925, NULL, 180, 'A classic American novel about the Jazz Age and the American Dream.', 'Scribner', NULL, 'English', NULL, 5, false),
    ('9780061120084', 'To Kill a Mockingbird', 1960, NULL, 376, 'A gripping tale of racial injustice and childhood innocence in the American South.', 'J.B. Lippincott & Co.', NULL, 'English', NULL, 5, false),
    ('9780451524935', '1984', 1949, NULL, 328, 'A dystopian social science fiction novel about totalitarian control.', 'Secker & Warburg', NULL, 'English', NULL, 5, false),
    ('9780452284234', 'Animal Farm', 1945, NULL, 112, 'A satirical allegorical novella about farm animals who rebel against their human farmer.', 'Secker & Warburg', NULL, 'English', NULL, 5, false),
    ('9780141439518', 'Pride and Prejudice', 1813, NULL, 432, 'A romantic novel of manners written by Jane Austen in 1813.', 'Penguin Classics', NULL, 'English', NULL, 5, false),
    ('9780141439662', 'Emma', 1815, NULL, 474, 'A novel about youthful hubris and romantic misunderstandings.', 'Penguin Classics', NULL, 'English', NULL, 5, false),
    ('9780316769174', 'The Catcher in the Rye', 1951, NULL, 277, 'A controversial novel originally published for adults, it has since become popular with adolescent readers.', 'Little, Brown and Company', NULL, 'English', NULL, 5, false),
    ('9780571056866', 'Lord of the Flies', 1954, NULL, 248, 'A 1954 novel about a group of British boys stuck on an uninhabited island.', 'Faber & Faber', NULL, 'English', NULL, 5, false),
    ('9780439708180', 'Harry Potter and the Sorcerer''s Stone', 1997, NULL, 309, 'A young wizard''s journey begins at Hogwarts School of Witchcraft and Wizardry.', 'Scholastic', NULL, 'English', NULL, 5, false),
    ('9780439064873', 'Harry Potter and the Chamber of Secrets', 1998, NULL, 341, 'Harry''s second year at Hogwarts is marked by mysterious attacks and ancient secrets.', 'Scholastic', NULL, 'English', NULL, 5, false),
    ('9780062073488', 'Murder on the Orient Express', 1934, NULL, 256, 'Hercule Poirot investigates a murder aboard the famous Orient Express train.', 'Collins Crime Club', NULL, 'English', NULL, 5, false),
    ('9780062073471', 'And Then There Were None', 1939, NULL, 272, 'Ten strangers are invited to an island where they are murdered one by one.', 'Collins Crime Club', NULL, 'English', NULL, 5, false);

INSERT INTO book_authors (book_isbn, author_id, display_order) VALUES
    ('9780743273565', 'a759f490-3f2b-454e-b404-cdc4b3fe842a', 0),
    ('9780061120084', 'd4aba24e-24f6-4485-baa7-c2eaa6b7955c', 0),
    ('9780451524935', '63d11ddc-b846-4f26-9d61-a9739eef9298', 0),
    ('9780452284234', '63d11ddc-b846-4f26-9d61-a9739eef9298', 0),
    ('9780141439518', '208e9931-1af7-4ff4-8a52-3bd6545d8cff', 0),
    ('9780141439662', '208e9931-1af7-4ff4-8a52-3bd6545d8cff', 0),
    ('9780316769174', '775c1da8-4abc-4f97-b902-c9b6eb381b23', 0),
    ('9780571056866', '0cebbdcc-bdfb-4aae-91d0-4ace46c2ef00', 0),
    ('9780439708180', 'f5000e73-f788-4174-bba9-1b4e1f244266', 0),
    ('9780439064873', 'f5000e73-f788-4174-bba9-1b4e1f244266', 0),
    ('9780062073488', 'a57776c2-9f99-460b-b360-45cde501e7c8', 0),
    ('9780062073471', 'a57776c2-9f99-460b-b360-45cde501e7c8', 0);

INSERT INTO reviews (id, book_isbn, reviewer_name, text, rating, created_at) VALUES
    ('c4c30609-f46c-4b66-b969-cd8d9a388966', '9780743273565', 'Sneaky Quetzal', 'A masterpiece of American literature! Fitzgerald''s prose is beautiful.', 5, TO_TIMESTAMP(1767639631.992)),
    ('9f6423f3-7746-41ad-a499-ac229c1073b4', '9780743273565', 'Luminous Rhino', 'The symbolism of the green light is haunting and powerful.', 4, TO_TIMESTAMP(1767639632.183)),
    ('0fbde6c0-afd8-4869-bba2-85bb7384a796', '9780743273565', 'Pompous Narwhal', 'A tragic tale of the American Dream. Beautifully written.', 5, TO_TIMESTAMP(1767639632.41)),
    ('e68643e1-b7d1-4258-8330-d4d121d4640a', '9780061120084', 'Sneaky Quetzal', 'An important book about justice and morality. Everyone should read this.', 5, TO_TIMESTAMP(1767639632.71)),
    ('dfb4a78a-330d-41d8-a8c7-38fe635fc7b7', '9780061120084', 'Luminous Rhino', 'Scout''s perspective makes this story both innocent and profound.', 4, TO_TIMESTAMP(1767639632.868)),
    ('0ef180d1-64ee-42fd-b583-a3459cc8f9bc', '9780061120084', 'Pompous Narwhal', 'A timeless classic that deals with serious social issues.', 5, TO_TIMESTAMP(1767639633.037)),
    ('770e78f4-1401-48cc-ab6a-6f826e52230a', '9780451524935', 'Sneaky Quetzal', 'Terrifyingly relevant even today. Orwell was a visionary.', 5, TO_TIMESTAMP(1767639633.274)),
    ('6ab87a0a-9a8a-40c5-b33f-d010d34e06a7', '9780451524935', 'Luminous Rhino', 'Big Brother is watching... A chilling dystopian masterpiece.', 5, TO_TIMESTAMP(1767639633.527)),
    ('26d24fd9-0c45-4fc1-9d28-76d9c7bde1e9', '9780451524935', 'Pompous Narwhal', 'Made me think about surveillance and freedom in new ways.', 4, TO_TIMESTAMP(1767639633.709)),
    ('5fe794cb-c8b1-4454-ae3b-ed68bdcb97d0', '9780452284234', 'Sneaky Quetzal', 'A brilliant allegory about power and corruption.', 5, TO_TIMESTAMP(1767639633.965)),
    ('9cc87457-b406-4381-bc60-b8886064500a', '9780452284234', 'Luminous Rhino', 'Short but incredibly impactful. ''All animals are equal...''', 4, TO_TIMESTAMP(1767639634.149)),
    ('12c58ef5-6399-43da-9416-f90ad4209bdd', '9780141439518', 'Sneaky Quetzal', 'Elizabeth Bennet is one of literature''s greatest heroines.', 5, TO_TIMESTAMP(1767639634.427)),
    ('4184cc61-e503-402a-bdfb-934e76948ea8', '9780141439518', 'Luminous Rhino', 'Witty dialogue and social commentary. Austen at her best.', 4, TO_TIMESTAMP(1767639634.594)),
    ('2f369b4a-45a9-44fc-ae83-d424acc895ed', '9780141439662', 'Sneaky Quetzal', 'A great read! Highly recommended.', 4, TO_TIMESTAMP(1767639634.831)),
    ('53b5c216-4599-4ebe-8b71-0c7c399fd609', '9780141439662', 'Luminous Rhino', 'Well-written and engaging story.', 4, TO_TIMESTAMP(1767639634.994)),
    ('5bb5fcb0-829b-464e-81e1-2cefa7691ec8', '9780316769174', 'Sneaky Quetzal', 'A great read! Highly recommended.', 4, TO_TIMESTAMP(1767639635.231)),
    ('55b35cfe-0bfc-47a2-b5a2-e628b35f7b9c', '9780316769174', 'Luminous Rhino', 'Well-written and engaging story.', 4, TO_TIMESTAMP(1767639635.391)),
    ('19a94003-a07f-46a7-a024-269814c64056', '9780571056866', 'Sneaky Quetzal', 'A great read! Highly recommended.', 4, TO_TIMESTAMP(1767639635.636)),
    ('b84bcb75-e499-4b33-80dc-544e3340991f', '9780571056866', 'Luminous Rhino', 'Well-written and engaging story.', 4, TO_TIMESTAMP(1767639635.795)),
    ('c29f76bd-a4b8-4bbb-9a6d-d451d8b1c8de', '9780439708180', 'Sneaky Quetzal', 'The book that started it all! Magic, friendship, and adventure.', 5, TO_TIMESTAMP(1767639636.031)),
    ('5a5a556e-4939-4317-9961-2df7ce299305', '9780439708180', 'Luminous Rhino', 'Hogwarts feels like home. Rowling created something special.', 5, TO_TIMESTAMP(1767639636.191)),
    ('322c3fc2-e4e1-408b-8901-91ca12ddc9e4', '9780439708180', 'Pompous Narwhal', 'Perfect for readers of all ages. Pure imagination.', 4, TO_TIMESTAMP(1767639636.349)),
    ('32d38d5d-b574-4f8a-8ec5-4c8c78d03a89', '9780439064873', 'Sneaky Quetzal', 'A great read! Highly recommended.', 4, TO_TIMESTAMP(1767639636.578)),
    ('44d06523-897f-414a-9791-720e98da679b', '9780439064873', 'Luminous Rhino', 'Well-written and engaging story.', 4, TO_TIMESTAMP(1767639636.737)),
    ('f71a4ac0-d81e-4cfa-9a26-eea63089422f', '9780062073488', 'Sneaky Quetzal', 'Christie''s plotting is ingenious. Didn''t see the ending coming!', 5, TO_TIMESTAMP(1767639636.967)),
    ('5a89216b-717b-47bd-9e73-907d7dc55d5d', '9780062073488', 'Luminous Rhino', 'Poirot is the greatest detective in literature.', 4, TO_TIMESTAMP(1767639637.129)),
    ('b1311123-3911-4db0-9fe8-547d8d359e9b', '9780062073471', 'Sneaky Quetzal', 'A great read! Highly recommended.', 4, TO_TIMESTAMP(1767639637.362)),
    ('17953079-c8ee-4933-ac81-f93f0711b565', '9780062073471', 'Luminous Rhino', 'Well-written and engaging story.', 4, TO_TIMESTAMP(1767639637.519));

INSERT INTO reservations (id, user_id, book_isbn, expiration_date) VALUES
    ('be0abfd2-505c-454a-be11-f9ed70fddbfb', 'b12cf4d6-cfcf-4b96-b8c2-56b07823945c', '9780743273565', 'Tue Jan 06 2026 07:00:37 GMT+0000 (Coordinated Universal Time)'::TIMESTAMPTZ),
    ('f91cd571-d76b-4f7a-b692-9bab17c11083', '30e3e680-3e1f-4e91-abe6-930ce0bd8b53', '9780451524935', 'Tue Jan 06 2026 07:00:38 GMT+0000 (Coordinated Universal Time)'::TIMESTAMPTZ),
    ('94360a44-cd35-419a-9489-7ca70032ecc5', 'ecdd649b-0f47-47b7-b1b2-8afe6b4be11a', '9780141439518', 'Tue Jan 06 2026 07:00:38 GMT+0000 (Coordinated Universal Time)'::TIMESTAMPTZ);