"use client";

import { useMemo, useState } from "react";
import SelectDropdown from "@/components/controls/SelectDropdown";
import { getButtonClass } from "@/lib/ui/buttonRoles";
import { type Option } from "./adminLocalTypes";

export default function AdminExportForm({
  users,
  categories,
  statusOptions,
  fieldOptionsByCategory,
  downloadPath,
}: {
  users: string[];
  categories: Option[];
  statusOptions: Option[];
  fieldOptionsByCategory: Record<string, Option[]>;
  downloadPath: string;
}) {
  const defaultUser = users[0] ?? "";
  const defaultCategory = categories[0]?.key ?? "all";

  const [userEmail, setUserEmail] = useState(defaultUser);
  const [category, setCategory] = useState(defaultCategory);
  const [format, setFormat] = useState<"xlsx" | "csv">("xlsx");
  const [selectedFields, setSelectedFields] = useState<string[]>(
    () => (fieldOptionsByCategory[defaultCategory] ?? []).map((field) => field.key)
  );
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const fieldOptions = useMemo(
    () => fieldOptionsByCategory[category] ?? [],
    [category, fieldOptionsByCategory]
  );

  function handleCategoryChange(nextCategory: string) {
    setCategory(nextCategory);
    const nextFields = fieldOptionsByCategory[nextCategory] ?? [];
    setSelectedFields(nextFields.map((field) => field.key));
  }

  function toggleField(fieldKey: string) {
    setSelectedFields((current) =>
      current.includes(fieldKey)
        ? current.filter((key) => key !== fieldKey)
        : [...current, fieldKey]
    );
  }

  function toggleStatus(status: string) {
    setSelectedStatuses((current) =>
      current.includes(status)
        ? current.filter((key) => key !== status)
        : [...current, status]
    );
  }

  function selectAllFields() {
    setSelectedFields(fieldOptions.map((field) => field.key));
  }

  function clearFields() {
    setSelectedFields([]);
  }

  function handleDownload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userEmail) return;

    const params = new URLSearchParams();
    params.set("userEmail", userEmail);
    params.set("category", category);
    params.set("format", format);
    if (selectedFields.length > 0) {
      params.set("fields", selectedFields.join(","));
    }
    if (selectedStatuses.length > 0) {
      params.set("statuses", selectedStatuses.join(","));
    }
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);

    window.location.assign(`${downloadPath}?${params.toString()}`);
  }

  return (
    <form onSubmit={handleDownload} className="space-y-5">
      <div className="grid gap-4 md:grid-cols-4">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Faculty</span>
          <SelectDropdown
            value={userEmail}
            onChange={(value) => setUserEmail(value)}
            options={users.map((email) => ({ label: email, value: email }))}
            placeholder="Select faculty"
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Category</span>
          <SelectDropdown
            value={category}
            onChange={(value) => handleCategoryChange(value)}
            options={categories.map((item) => ({ label: item.label, value: item.key }))}
            placeholder="Select category"
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Format</span>
          <SelectDropdown
            value={format}
            onChange={(value) => setFormat(value === "csv" ? "csv" : "xlsx")}
            options={[
              { label: "Excel (.xlsx)", value: "xlsx" },
              { label: "CSV (.csv)", value: "csv" },
            ]}
            placeholder="Select format"
          />
        </label>

        <div className="space-y-1 text-sm">
          <span className="text-muted-foreground">Statuses (optional)</span>
            <div className="rounded-lg border border-border bg-background px-3 py-2">
              <div className="flex flex-wrap gap-2">
                {statusOptions.map((status) => (
                  <label key={status.key} className="inline-flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={selectedStatuses.includes(status.key)}
                      onChange={() => toggleStatus(status.key)}
                    />
                    <span>{status.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">From Date (optional)</span>
          <input
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
            className="select-styled h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm shadow-sm outline-none transition-colors hover:border-slate-400 focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/20"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">To Date (optional)</span>
          <input
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
            className="select-styled h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm shadow-sm outline-none transition-colors hover:border-slate-400 focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/20"
          />
        </label>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-medium">
            Fields ({selectedFields.length}/{fieldOptions.length})
          </div>
          <div className="flex gap-2">
            <button type="button" className={getButtonClass("ghost")} onClick={selectAllFields}>
              Select all
            </button>
            <button type="button" className={getButtonClass("ghost")} onClick={clearFields}>
              Clear
            </button>
          </div>
        </div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {fieldOptions.map((field) => (
            <label key={field.key} className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selectedFields.includes(field.key)}
                onChange={() => toggleField(field.key)}
              />
              <span>{field.label}</span>
              <span className="text-xs text-muted-foreground">({field.key})</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" className={getButtonClass("context")} disabled={!userEmail}>
          Download Export
        </button>
        <div className="text-xs text-muted-foreground">
          Uses normalized DataStore values and schema labels.
        </div>
      </div>
    </form>
  );
}
