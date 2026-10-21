import { statuses } from "../lib/types";
import { choices } from "./Forms";
import type { Filters } from "./model";
import { useResearch } from "./ResearchView";
export function ResearchFilters({
  value,
  onChange,
}: {
  value: Filters;
  onChange: (f: Filters) => void;
}) {
  const { workspace } = useResearch();
  const field = (
    key: keyof Filters,
    label: string,
    options?: { value: string; label: string }[],
  ) => (
    <label key={key}>
      {label}
      {options ? (
        <select
          value={value[key]}
          onChange={(e) => onChange({ ...value, [key]: e.target.value })}
        >
          <option value="">All</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type="date"
          value={value[key]}
          onChange={(e) => onChange({ ...value, [key]: e.target.value })}
        />
      )}
    </label>
  );
  return (
    <div className="research-filter">
      {field("from", "Created from")}
      {field("to", "Created through")}
      {field(
        "member",
        "Member",
        workspace.members.map((m) => ({
          value: m.user_id,
          label: m.rf_profiles.full_name,
        })),
      )}
      {field(
        "phase",
        "Research phase",
        workspace.phases.map((p) => ({ value: p.id, label: p.name })),
      )}
      {field("status", "Task status", choices([...statuses]))}
    </div>
  );
}
