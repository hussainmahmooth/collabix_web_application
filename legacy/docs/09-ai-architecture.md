# Collabix AI Architecture

- **Engine**: Google Gemini model (`gemini-1.5-flash`).
- **Context Construction**:
  1. User prompt is submitted.
  2. Server action queries active workspace projects, tasks, and members (filtered by RLS).
  3. Context is serialized to JSON.
  4. System guidelines and context are sent to Gemini.
  5. Text response is returned.
- **Fallback**: Includes a sandbox mock evaluator if `GEMINI_API_KEY` is not configured.\n