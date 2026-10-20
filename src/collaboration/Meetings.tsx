import { useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Plus, List } from "lucide-react";
import { Button, Empty, Modal } from "../components/ui";
import {
  displayTime,
  toInstant,
  zonedInput,
  safeLink,
  type Meeting,
} from "./model";
import { useCollab, usePerson, Stamp, Status } from "./Shared";
const meetingTypes = [
  "Team Meeting",
  "Supervisor Meeting",
  "Research Review",
  "Technical Discussion",
  "Other",
];
export default function Meetings() {
  const { workspace, data, userId, leader, busy, run, act } = useCollab();
  const person = usePerson();
  const [edit, setEdit] = useState<Meeting | null | undefined>(undefined);
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState("list");
  const [filter, setFilter] = useState("upcoming");
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [month, setMonth] = useState(
    zonedInput(new Date().toISOString(), zone).slice(0, 7),
  );
  const [tz, setTz] = useState(zone);
  const meeting = data.meetings.find((x) => x.id === selected);
  const meetings = data.meetings
    .filter((m) =>
      filter === "all" || filter === "cancelled"
        ? filter === "all" || m.cancelled
        : !m.cancelled &&
          (filter === "upcoming"
            ? new Date(m.ends_at) >= new Date()
            : new Date(m.ends_at) < new Date()),
    )
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const organizer = meeting && (leader || meeting.organizer_id === userId);
  const openEdit = (m: Meeting | null) => {
    setTz(m?.timezone || zone);
    setEdit(m);
    setSelected(null);
  };
  const dateKey = (m: Meeting) => zonedInput(m.starts_at, zone).slice(0, 10);
  const days = new Date(
    Number(month.slice(0, 4)),
    Number(month.slice(5, 7)),
    0,
  ).getDate();
  const offset = new Date(
    Number(month.slice(0, 4)),
    Number(month.slice(5, 7)) - 1,
    1,
  ).getDay();
  const card = (m: Meeting) => (
    <article key={m.id} className="panel collab-card">
      <div className="collab-card-top">
        <CalendarDays size={20} />
        <Status>
          {m.cancelled
            ? "Cancelled"
            : new Date(m.ends_at) < new Date()
              ? "Completed"
              : m.type}
        </Status>
      </div>
      <h2>
        <button
          className="collab-title-button"
          onClick={() => setSelected(m.id)}
        >
          {m.title}
        </button>
      </h2>
      <p>
        {displayTime(m.starts_at, m.timezone)} –{" "}
        {displayTime(m.ends_at, m.timezone)}
      </p>
      <small>{m.timezone}</small>
      <small>Organizer: {person(m.organizer_id)}</small>
      <Button variant="outline" onClick={() => setSelected(m.id)}>
        Meeting details
      </Button>
    </article>
  );
  return (
    <>
      <div className="collab-toolbar">
        <Button
          variant={view === "list" ? "default" : "outline"}
          onClick={() => setView("list")}
        >
          <List size={15} />
          List
        </Button>
        <Button
          variant={view === "calendar" ? "default" : "outline"}
          onClick={() => setView("calendar")}
        >
          <CalendarDays size={15} />
          Calendar
        </Button>
        <label>
          Meeting history
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="upcoming">Upcoming</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="all">All meetings</option>
          </select>
        </label>
        <Button onClick={() => openEdit(null)}>
          <Plus size={16} />
          Schedule meeting
        </Button>
      </div>
      {view === "calendar" ? (
        <section className="panel collab-panel">
          <label>
            Calendar month
            <input
              type="month"
              required
              value={month}
              onChange={(e) => {
                if (e.target.value) setMonth(e.target.value);
              }}
            />
          </label>
          <p className="form-hint">
            Calendar dates use {zone}. Meeting details also show the organizer’s
            timezone.
          </p>
          <div className="meeting-calendar">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <strong className="calendar-weekday" key={d}>
                {d}
              </strong>
            ))}
            {Array.from({ length: offset }, (_, i) => (
              <div className="calendar-day empty-day" key={`blank${i}`} />
            ))}
            {Array.from({ length: days }, (_, i) => {
              const day = `${month}-${String(i + 1).padStart(2, "0")}`;
              return (
                <div className="calendar-day" key={day}>
                  <strong>{i + 1}</strong>
                  {meetings
                    .filter((m) => dateKey(m) === day)
                    .map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setSelected(m.id)}
                        title={m.title}
                      >
                        {m.title}
                      </button>
                    ))}
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <div className="collab-grid">{meetings.map(card)}</div>
      )}
      {!meetings.length && (
        <Empty title="No matching meetings">
          Schedule your next discussion or choose another history filter.
        </Empty>
      )}
      {edit !== undefined && (
        <Modal
          title={edit ? "Edit meeting" : "Schedule meeting"}
          description="Choose local times in the specified IANA timezone. Times are stored as UTC instants."
          onClose={() => setEdit(undefined)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run(async () => {
                const start = toInstant(String(f.get("start")), tz),
                  end = toInstant(String(f.get("end")), tz);
                if (end <= start)
                  throw new Error("End time must be after the start time.");
                await act("meeting_save", {
                  id: edit?.id || null,
                  title: f.get("title"),
                  description: f.get("description"),
                  type: f.get("type"),
                  starts_at: start,
                  ends_at: end,
                  timezone: tz,
                  location: f.get("location"),
                  agenda: f.get("agenda"),
                  participants: f.getAll("participants"),
                });
                setEdit(undefined);
              }, "Meeting saved");
            }}
          >
            <label>
              Meeting title
              <input
                name="title"
                required
                maxLength={200}
                defaultValue={edit?.title}
              />
            </label>
            <label>
              Description
              <textarea
                name="description"
                maxLength={10000}
                defaultValue={edit?.description}
              />
            </label>
            <div className="form-grid">
              <label>
                Meeting type
                <select name="type" defaultValue={edit?.type || "Team Meeting"}>
                  {meetingTypes.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label>
                IANA timezone
                <input
                  name="timezone"
                  required
                  value={tz}
                  onChange={(e) => setTz(e.target.value)}
                  placeholder="Asia/Colombo"
                />
              </label>
              <label>
                Start
                <input
                  name="start"
                  type="datetime-local"
                  required
                  defaultValue={
                    edit ? zonedInput(edit.starts_at, edit.timezone) : ""
                  }
                />
              </label>
              <label>
                End
                <input
                  name="end"
                  type="datetime-local"
                  required
                  defaultValue={
                    edit ? zonedInput(edit.ends_at, edit.timezone) : ""
                  }
                />
              </label>
            </div>
            <label>
              Location or online meeting link
              <input
                name="location"
                maxLength={1000}
                defaultValue={edit?.location}
              />
            </label>
            <label>
              Agenda
              <textarea
                name="agenda"
                maxLength={10000}
                defaultValue={edit?.agenda}
              />
            </label>
            <fieldset>
              <legend>Participants (organizer is included)</legend>
              <div className="collab-checkboxes">
                {workspace.members.map((m) => (
                  <label key={m.user_id}>
                    <input
                      type="checkbox"
                      name="participants"
                      value={m.user_id}
                      defaultChecked={
                        edit
                          ? data.participants.some(
                              (p) =>
                                p.meeting_id === edit.id &&
                                p.user_id === m.user_id,
                            )
                          : true
                      }
                    />
                    {person(m.user_id)}
                  </label>
                ))}
              </div>
            </fieldset>
            <Button disabled={busy}>Save meeting</Button>
          </form>
        </Modal>
      )}
      {meeting && (
        <Modal
          title={meeting.title}
          description={`${displayTime(meeting.starts_at, meeting.timezone)} – ${displayTime(meeting.ends_at, meeting.timezone)} · ${meeting.timezone}`}
          onClose={() => setSelected(null)}
        >
          <Status>{meeting.cancelled ? "Cancelled" : meeting.type}</Status>
          <p className="collab-body">{meeting.description}</p>
          <p>Organizer: {person(meeting.organizer_id)}</p>
          <p>
            Participants:{" "}
            {data.participants
              .filter((p) => p.meeting_id === meeting.id)
              .map((p) => person(p.user_id))
              .join(", ")}
          </p>
          <p>
            {safeLink(meeting.location) ? (
              <a
                href={safeLink(meeting.location)!}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open online meeting
              </a>
            ) : (
              meeting.location
            )}
          </p>
          <h3>Agenda</h3>
          <p className="collab-body">{meeting.agenda || "No agenda added."}</p>
          {organizer && !meeting.cancelled && (
            <div className="collab-toolbar">
              <Button variant="outline" onClick={() => openEdit(meeting)}>
                Edit meeting
              </Button>
              <Button
                variant="destructive"
                disabled={busy}
                onClick={() =>
                  void run(
                    () => act("meeting_cancel", { id: meeting.id }),
                    "Meeting cancelled",
                  )
                }
              >
                Cancel meeting
              </Button>
            </div>
          )}
          <h3>Minutes, decisions & comments</h3>
          {data.notes
            .filter((n) => n.meeting_id === meeting.id)
            .sort((a, b) => a.created_at.localeCompare(b.created_at))
            .map((n) => (
              <article className="collab-history" key={n.id}>
                <strong>{n.kind}</strong>
                <Stamp user={n.author_id} at={n.created_at} />
                <p className="collab-body">{n.body}</p>
              </article>
            ))}
          {!meeting.cancelled && (
            <form
              className="collab-subform"
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const f = new FormData(form);
                void run(async () => {
                  await act("meeting_note", {
                    meeting_id: meeting.id,
                    kind: f.get("kind"),
                    body: f.get("body"),
                  });
                  form.reset();
                }, "Meeting record added");
              }}
            >
              <label>
                Record type
                <select name="kind">
                  <option>Comment</option>
                  {organizer && (
                    <>
                      <option>Minutes</option>
                      <option>Decision</option>
                    </>
                  )}
                </select>
              </label>
              <label>
                Meeting note
                <textarea name="body" required maxLength={10000} />
              </label>
              <Button disabled={busy}>Add meeting record</Button>
            </form>
          )}
          <h3>Action items</h3>
          {data.actions
            .filter((a) => a.meeting_id === meeting.id)
            .map((a) => (
              <article className="collab-history" key={a.id}>
                <strong>{a.title}</strong>
                <p>
                  {person(a.assignee_id)} · Due {a.due_date}
                </p>
                {a.task_id ? (
                  <Link to="/tasks">Open in tasks</Link>
                ) : (
                  leader && (
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        void run(
                          () => act("action_convert", { id: a.id }),
                          "Action converted to task",
                        )
                      }
                    >
                      Convert to task
                    </Button>
                  )
                )}
              </article>
            ))}
          {organizer && !meeting.cancelled && (
            <form
              className="collab-subform"
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const f = new FormData(form);
                void run(async () => {
                  await act("meeting_action", {
                    meeting_id: meeting.id,
                    title: f.get("title"),
                    assignee_id: f.get("assignee_id"),
                    due_date: f.get("due_date"),
                  });
                  form.reset();
                }, "Action item created");
              }}
            >
              <label>
                Action item
                <input name="title" required maxLength={200} />
              </label>
              <div className="form-grid">
                <label>
                  Responsible member
                  <select name="assignee_id" required>
                    {workspace.members
                      .filter((m) => m.role !== "supervisor")
                      .map((m) => (
                        <option key={m.user_id} value={m.user_id}>
                          {person(m.user_id)}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Action deadline
                  <input name="due_date" type="date" required />
                </label>
              </div>
              <Button disabled={busy}>Add action item</Button>
            </form>
          )}
        </Modal>
      )}
    </>
  );
}
