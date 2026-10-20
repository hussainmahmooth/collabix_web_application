import { useState } from "react";
import { Button } from "../components/ui";
import { check, supabase } from "../lib/supabase";
import { loadCollaboration } from "../collaboration/model";
import { loadResearch, emptyFilters, rows } from "./model";
import { ResearchFilters } from "./Analytics";
import { pdfBytes, reportDefinition, reportTypes } from "./pdfReports";
import { useResearch } from "./ResearchView";
import type { Task, Phase } from "../lib/types";
export default function Reports() {
  const c = useResearch();
  const [type, setType] = useState(reportTypes[0]);
  const [filters, setFilters] = useState(emptyFilters);
  const [working, setWorking] = useState(false);
  return (
    <>
      <h2>Research reports</h2>
      <p className="research-notice">
        A4 PDF reports are generated locally using freshly queried records
        allowed by your current permissions. No research data is sent to a
        third-party report service. Dataset reports contain registry summaries
        only. Export initiation is audited; this is not proof of a completed
        download.
      </p>
      <ResearchFilters value={filters} onChange={setFilters} />
      <label>
        Report type
        <select value={type} onChange={(e) => setType(e.target.value)}>
          {reportTypes.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      <p>
        Weekly and monthly reports use the date range you choose. Task filters
        apply to task tables; other tables use their event dates and the
        applicable member/phase filter. Missing values are labeled explicitly.
      </p>
      <Button
        disabled={working || c.busy}
        onClick={() => {
          setWorking(true);
          void c
            .run(async () => {
              if (type === "Individual Member Task Summary" && !filters.member)
                throw Error("Choose a member for an individual report");
              if (type === "Research Phase Progress Report" && !filters.phase)
                throw Error("Choose a research phase");
              if (
                (type.startsWith("Weekly") || type.startsWith("Monthly")) &&
                (!filters.from || !filters.to)
              )
                throw Error("Choose the reporting period");
              const w = c.workspace.workspace.id;
              const [research, collaboration, tasks, phases] =
                await Promise.all([
                  loadResearch(w),
                  loadCollaboration(w),
                  rows<Task>("rf_tasks", w),
                  rows<Phase>("rf_research_phases", w),
                ]);
              await c.act("report_event", { report_type: type });
              let logo: string | undefined;
              if (c.workspace.workspace.logo_path) {
                try {
                  const blob = check(
                    await supabase.storage
                      .from("researchflow-logos")
                      .download(c.workspace.workspace.logo_path),
                  );
                  if (blob && ["image/png", "image/jpeg"].includes(blob.type)) {
                    logo = await new Promise<string>((resolve, reject) => {
                      const reader = new FileReader();
                      reader.onload = () => resolve(String(reader.result));
                      reader.onerror = reject;
                      reader.readAsDataURL(blob);
                    });
                  }
                } catch {
                  /* Branding is optional; report still labels configured team and institution. */
                }
              }
              const blob = await pdfBytes(
                reportDefinition(
                  type,
                  { ...c.workspace, tasks, phases },
                  research,
                  collaboration,
                  filters,
                  new Date(),
                  logo,
                ),
              );
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `ResearchFlow-${type.replaceAll(" ", "-")}.pdf`;
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }, "Report generated")
            .finally(() => setWorking(false));
        }}
      >
        {working ? "Generating report…" : "Download PDF report"}
      </Button>
    </>
  );
}
