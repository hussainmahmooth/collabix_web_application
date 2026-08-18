# API & Service Architecture

Collabix uses Next.js Server Actions for secure database operations:

- `signInWithPassword`: Authenticates user.
- `signUp`: Registers user and triggers profile creation.
- `askAI`: Queries workspace context and invokes Gemini.
- `createTask`: Inserts new task to database.
- `createProject`: Inserts new project to database.
- `updateTask`: Updates task properties.\n