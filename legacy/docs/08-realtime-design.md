# Real-Time Sockets Architecture

Uses Supabase Realtime client:
1. **Task Board**: Subscribes to `tasks` table updates to sync status card drag movements immediately across peers.
2. **Instant Messenger**: Subscribes to `messages` inserts to append chat bubbles.
3. **Notifications**: Subscribes to `notifications` inserts for active account alert toasts.\n