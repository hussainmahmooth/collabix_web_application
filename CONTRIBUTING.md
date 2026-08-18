# Contributing to Collabix

Thank you for contributing to Collabix! To maintain code quality and security, please follow these guidelines.

## Development Workflow
1. **Branch Naming**: Use feature-specific prefixes:
   - `feature/auth`
   - `feature/tasks`
   - `feature/ai`
2. **Linting & Code Style**: Prettier and ESLint are pre-configured. Run tests before submitting commits:
   ```bash
   npm run lint
   ```
3. **TypeScript Compliance**: Code must build without TypeScript type errors:
   ```bash
   npm run build
   ```
4. **Database Migrations**: Add SQL files to `database/migrations/` sequentially, and verify RLS policies are enabled for new tables.
5. **Real-time Subscriptions**: Ensure socket channel hooks are cleaned up in React unmount parameters.
