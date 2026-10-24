/** Trash is recoverable and retains linked evidence; it does not revoke read access.
 * Documents retain their separate, stricter Trash access policy. */
export const recordTables: Record<string, string> = {
  phases: "rf_research_phases",
  channels: "rf_channels",
  documents: "rf_documents",
  meetings: "rf_meetings",
  announcements: "rf_announcements",
  papers: "rf_papers",
  sections: "rf_paper_sections",
  references: "rf_references",
  datasets: "rf_datasets",
  repositories: "rf_github_repositories",
  links: "rf_github_links",
  document_comments: "rf_document_comments",
  meeting_notes: "rf_meeting_notes",
  meeting_actions: "rf_meeting_actions",
};
export function activeRecords<T>(records: T[]): T[] {
  return records.filter(
    (r) => !(r as { deleted_at?: string | null }).deleted_at,
  );
}
