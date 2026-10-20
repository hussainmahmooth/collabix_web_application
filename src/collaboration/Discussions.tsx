import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Hash, Plus, Reply, Pencil, Trash2 } from "lucide-react";
import { Button, Empty, Modal } from "../components/ui";
import { check, supabase } from "../lib/supabase";
import { initials } from "../lib/types";
import {
  acceptFiles,
  uploadAttachment,
  type Message,
  type Channel,
} from "./model";
import { useCollab, usePerson, Stamp, Files, Status } from "./Shared";
export default function Discussions({ connection }: { connection: string }) {
  const { workspace, data, userId, leader, busy, run, act, refresh } =
    useCollab();
  const person = usePerson();
  const [channelId, setChannelId] = useState("");
  const [limit, setLimit] = useState(100);
  const [reply, setReply] = useState<Message | null>(null);
  const [manage, setManage] = useState<Channel | null | undefined>(undefined);
  const [edit, setEdit] = useState<Message | null>(null);
  const [remove, setRemove] = useState<Message | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const current =
    data.channels.find((x) => x.id === channelId) ||
    data.channels.find((x) => !x.archived) ||
    data.channels[0];
  const id = current?.id;
  const w = workspace.workspace.id;
  const q = useQuery({
    queryKey: ["messages", w, id, limit, userId],
    enabled: !!id,
    queryFn: async () => {
      return (check(
        await supabase
          .from("rf_messages")
          .select("*")
          .eq("workspace_id", w)
          .eq("channel_id", id!)
          .order("created_at", { ascending: false })
          .limit(limit),
      ) || []) as Message[];
    },
    refetchInterval: 30000,
  });
  const newest = q.data?.[0]?.created_at;
  useEffect(() => {
    if (!id || !newest) return;
    const mark = () => {
      if (document.visibilityState === "visible")
        void act("channel_read", { channel_id: id, last_read_at: newest })
          .then(refresh)
          .catch(() => {});
    };
    mark();
    window.addEventListener("focus", mark);
    document.addEventListener("visibilitychange", mark);
    return () => {
      window.removeEventListener("focus", mark);
      document.removeEventListener("visibilitychange", mark);
    };
    // Refresh is intentionally invoked only when the loaded message cursor changes.
  }, [id, newest, w]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "nearest" });
  }, [newest, id]);
  return (
    <>
      <div className="discussion-layout">
        <aside className="panel channel-list">
          <div className="panel-heading">
            <h2>Channels</h2>
            {leader && (
              <Button
                variant="ghost"
                onClick={() => setManage(null)}
                aria-label="Create channel"
              >
                <Plus size={16} />
              </Button>
            )}
          </div>
          <label className="collab-check">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Show archived
          </label>
          {data.channels
            .filter((c) => showArchived || !c.archived)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((c) => (
              <button
                className={`channel-link ${c.id === id ? "active" : ""}`}
                key={c.id}
                onClick={() => {
                  setChannelId(c.id);
                  setReply(null);
                  setLimit(100);
                }}
              >
                <Hash size={15} />
                <span>
                  {c.name}
                  {c.archived ? " (archived)" : ""}
                </span>
                {!!data.unread.find((x) => x.channel_id === c.id)
                  ?.unread_count && (
                  <strong>
                    {
                      data.unread.find((x) => x.channel_id === c.id)
                        ?.unread_count
                    }
                  </strong>
                )}
              </button>
            ))}
        </aside>
        <section className="panel chat-panel">
          <div className="panel-heading">
            <div>
              <h2>{current?.name || "Choose a channel"}</h2>
              <small role="status">{connection}</small>
            </div>
            {current && leader && (
              <Button variant="outline" onClick={() => setManage(current)}>
                Manage channel
              </Button>
            )}
          </div>
          <div className="message-stream" aria-live="polite">
            {q.isPending ? (
              <p>Loading messages…</p>
            ) : q.error ? (
              <div role="alert">
                {q.error.message}
                <Button onClick={() => void q.refetch()}>Retry messages</Button>
              </div>
            ) : (
              <>
                {q.data?.length === limit && (
                  <Button
                    variant="ghost"
                    onClick={() => setLimit((x) => x + 100)}
                  >
                    Load earlier messages
                  </Button>
                )}
                {!q.data?.length && (
                  <Empty title="Start the conversation">
                    Share a question, idea or research update.
                  </Empty>
                )}
                {[...(q.data || [])].reverse().map((m) => (
                  <article className="message-row" key={m.id}>
                    <span
                      className="avatar small"
                      aria-label={`${person(m.author_id)} avatar`}
                    >
                      {initials(person(m.author_id))}
                    </span>
                    <div className="message-content">
                      <strong>{person(m.author_id)}</strong>
                      <Stamp user={m.author_id} at={m.created_at} />
                      {m.reply_to && (
                        <blockquote>
                          Reply to{" "}
                          {person(
                            q.data?.find((x) => x.id === m.reply_to)
                              ?.author_id || "",
                          )}{" "}
                          ·{" "}
                          {q.data
                            ?.find((x) => x.id === m.reply_to)
                            ?.body.slice(0, 120) || "Earlier message"}
                        </blockquote>
                      )}
                      <p className="collab-body">
                        {m.deleted ? "Message deleted" : m.body}
                      </p>
                      {m.updated_at !== m.created_at && !m.deleted && (
                        <small>Edited</small>
                      )}
                      {!m.deleted && (
                        <>
                          <Files
                            files={data.files.filter(
                              (f) => f.message_id === m.id,
                            )}
                          />
                          <div className="message-tools">
                            <Button variant="ghost" onClick={() => setReply(m)}>
                              <Reply size={13} />
                              Reply
                            </Button>
                            {m.author_id === userId && (
                              <Button
                                variant="ghost"
                                onClick={() => setEdit(m)}
                              >
                                <Pencil size={13} />
                                Edit
                              </Button>
                            )}
                            {(leader || m.author_id === userId) && (
                              <Button
                                variant="ghost"
                                onClick={() => setRemove(m)}
                              >
                                <Trash2 size={13} />
                                Delete
                              </Button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </article>
                ))}
                <div ref={bottom} />
              </>
            )}
          </div>
          {current?.archived ? (
            <p className="form-hint">
              This channel is archived. Its history remains available.
            </p>
          ) : (
            current && (
              <form
                className="chat-compose"
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const f = new FormData(form);
                  const file = f.get("file");
                  void run(async () => {
                    const message = await act("message_send", {
                      channel_id: id,
                      body: f.get("body"),
                      reply_to: reply?.id || null,
                    });
                    form.reset();
                    setReply(null);
                    if (file instanceof File && file.size)
                      await uploadAttachment(w, userId, file, {
                        message_id: message,
                      });
                  }, "Message sent");
                }}
              >
                {reply && (
                  <div className="reply-label">
                    Replying to {person(reply.author_id)}
                    <Button type="button" variant="ghost" onClick={() => setReply(null)}>
                      Cancel reply
                    </Button>
                  </div>
                )}
                <label>
                  Message
                  <textarea
                    name="body"
                    required
                    maxLength={10000}
                    rows={3}
                    placeholder={`Message ${current.name}`}
                    enterKeyHint="enter"
                  />
                </label>
                <div className="collab-toolbar">
                  <label>
                    Attachment (optional)
                    <input name="file" type="file" accept={acceptFiles} />
                  </label>
                  <Button disabled={busy}>Send message</Button>
                </div>
              </form>
            )
          )}
        </section>
      </div>
      {manage !== undefined && (
        <Modal
          title={manage ? "Manage channel" : "Create channel"}
          onClose={() => setManage(undefined)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run(async () => {
                await act("channel_save", {
                  id: manage?.id || null,
                  name: f.get("name"),
                  archived: f.get("archived") === "on",
                });
                setManage(undefined);
              }, "Channel saved");
            }}
          >
            <label>
              Channel name
              <input
                name="name"
                required
                maxLength={100}
                defaultValue={manage?.name}
              />
            </label>
            {manage && (
              <label className="collab-check">
                <input
                  type="checkbox"
                  name="archived"
                  defaultChecked={manage.archived}
                />
                Archive channel (history is preserved)
              </label>
            )}
            <Button disabled={busy}>Save channel</Button>
          </form>
        </Modal>
      )}
      {edit && (
        <Modal title="Edit message" onClose={() => setEdit(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const body = new FormData(e.currentTarget).get("body");
              void run(async () => {
                await act("message_edit", { id: edit.id, body });
                setEdit(null);
              }, "Message updated");
            }}
          >
            <label>
              Message
              <textarea
                name="body"
                required
                maxLength={10000}
                defaultValue={edit.body}
              />
            </label>
            <Button disabled={busy}>Save message</Button>
          </form>
        </Modal>
      )}
      {remove && (
        <Modal
          title="Delete message?"
          description="The message body and its attachments will no longer be available to the channel."
          onClose={() => setRemove(null)}
        >
          <Button
            variant="destructive"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await act("message_delete", { id: remove.id });
                setRemove(null);
              }, "Message deleted")
            }
          >
            Delete message
          </Button>
        </Modal>
      )}
      {!data.channels.length && (
        <Status>No channels available. Ask your leader to create one.</Status>
      )}
    </>
  );
}
