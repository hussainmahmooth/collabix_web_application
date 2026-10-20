import { useState } from "react";
import { Plus, Pin } from "lucide-react";
import { Button, Empty, Modal } from "../components/ui";
import { acceptFiles, uploadAttachment, type Announcement } from "./model";
import { useCollab, Stamp, Files, Status } from "./Shared";
export default function Announcements() {
  const { workspace, data, userId, leader, busy, run, act } = useCollab();
  const [edit, setEdit] = useState<Announcement | null | undefined>(undefined);
  const [archived, setArchived] = useState(false);
  const items = data.announcements
    .filter((a) => a.archived === archived)
    .sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        b.created_at.localeCompare(a.created_at),
    );
  return (
    <>
      <div className="collab-toolbar">
        <label className="collab-check">
          <input
            type="checkbox"
            checked={archived}
            onChange={(e) => setArchived(e.target.checked)}
          />
          Archived announcements
        </label>
        {leader && (
          <Button onClick={() => setEdit(null)}>
            <Plus size={16} />
            Publish announcement
          </Button>
        )}
      </div>
      <div className="announcement-list">
        {items.map((a) => (
          <article className="panel collab-card" key={a.id}>
            <div className="collab-card-top">
              {a.pinned && <Pin size={17} />}
              <Status>{a.priority}</Status>
              {!data.announcementReads.some(
                (x) => x.announcement_id === a.id,
              ) && <Status>Unread</Status>}
            </div>
            <h2>{a.title}</h2>
            <Stamp user={a.author_id} at={a.created_at} />
            <p className="collab-body">{a.body}</p>
            <Files
              files={data.files.filter((f) => f.announcement_id === a.id)}
            />
            <div className="collab-toolbar">
              {!data.announcementReads.some(
                (x) => x.announcement_id === a.id,
              ) && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    void run(
                      () => act("announcement_read", { id: a.id }),
                      "Announcement marked as read",
                    )
                  }
                >
                  Mark as read
                </Button>
              )}
              {leader && (
                <Button variant="ghost" onClick={() => setEdit(a)}>
                  Edit announcement
                </Button>
              )}
            </div>
          </article>
        ))}
      </div>
      {!items.length && (
        <Empty title="No announcements yet">
          Team leaders can share important updates here.
        </Empty>
      )}
      {edit !== undefined && (
        <Modal
          title={edit ? "Edit announcement" : "Publish announcement"}
          onClose={() => setEdit(undefined)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const file = f.get("file");
              void run(async () => {
                const id = await act("announcement_save", {
                  id: edit?.id || null,
                  title: f.get("title"),
                  body: f.get("body"),
                  priority: f.get("priority"),
                  pinned: f.get("pinned") === "on",
                  archived: f.get("archived") === "on",
                });
                setEdit(undefined);
                if (file instanceof File && file.size)
                  await uploadAttachment(workspace.workspace.id, userId, file, {
                    announcement_id: id,
                  });
              }, "Announcement saved");
            }}
          >
            <label>
              Announcement title
              <input
                name="title"
                required
                maxLength={200}
                defaultValue={edit?.title}
              />
            </label>
            <label>
              Announcement content
              <textarea
                name="body"
                required
                maxLength={10000}
                defaultValue={edit?.body}
              />
            </label>
            <label>
              Priority
              <select name="priority" defaultValue={edit?.priority || "Normal"}>
                <option>Normal</option>
                <option>Important</option>
                <option>Urgent</option>
              </select>
            </label>
            <label className="collab-check">
              <input
                type="checkbox"
                name="pinned"
                defaultChecked={edit?.pinned}
              />
              Pin announcement
            </label>
            {edit && (
              <label className="collab-check">
                <input
                  type="checkbox"
                  name="archived"
                  defaultChecked={edit.archived}
                />
                Archive announcement
              </label>
            )}
            <label>
              Attachment (optional)
              <input type="file" name="file" accept={acceptFiles} />
            </label>
            <Button disabled={busy}>Save announcement</Button>
          </form>
        </Modal>
      )}
    </>
  );
}
