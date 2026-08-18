# Software Requirements Specification (SRS)

## Functional Requirements
- **FR-01**: User registration (email/password).
- **FR-02**: User session authentication and sign out.
- **FR-03**: Workspace creation and URL slug mapping.
- **FR-04**: Workspace team member management (invitations and role updates).
- **FR-05**: Project creation with progress trackers.
- **FR-06**: Task creation with due dates.
- **FR-07**: Task assignment.
- **FR-08**: Task status modifications (TODO, IN_PROGRESS, IN_REVIEW, COMPLETED, BLOCKED, CANCELLED).
- **FR-09**: Task comments.
- **FR-10**: File attachments reference in Supabase storage.
- **FR-11**: Project progress calculation.
- **FR-12**: Monthly calendar displaying milestones and task deadlines.
- **FR-13**: Real-time team messaging (channels and direct messages).
- **FR-14**: Workspace activities notifications.
- **FR-15**: Reporting charts detailing workloads and completion rates.
- **FR-16**: Collabix AI context-aware assistant.
- **FR-17**: User settings with theme toggle.
- **FR-18**: Role-based access control permissions.

## Non-Functional Requirements
- **NFR-01 (Performance)**: Fast load times, client hydration optimization, database indexes.
- **NFR-02 (Security)**: Workspace data isolation using PostgreSQL Row Level Security (RLS).
- **NFR-03 (Scalability)**: Efficient relation indexing to support increasing tasks.
- **NFR-04 (Availability)**: Production ready deployment on Vercel and Supabase cloud.
- **NFR-05 (Usability)**: Highly intuitive, consistent visual branding.
- **NFR-06 (Responsiveness)**: Multi-breakpoint grid scaling (Mobile to Desktop).
- **NFR-07 (Maintainability)**: Type-safe codebase, modular layout architecture.\n