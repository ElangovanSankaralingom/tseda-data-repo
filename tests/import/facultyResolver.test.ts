import test from "node:test";
import assert from "node:assert/strict";
import { resolveName, resolveNameList, nameSimilarity, nameTokens } from "@/lib/import/facultyResolver";

const REGISTRY = [
  { email: "elan@tce.edu", name: "Elangovan Sankaralingom" },
  { email: "priya@tce.edu", name: "Priya Ramachandran" },
  { email: "priyanka@tce.edu", name: "Priyanka Raman" },
  { email: "karthik@tce.edu", name: "Karthik Subramanian" },
  { email: "meena@tce.edu", name: "Meenakshi Sundaram" },
];

test("titles and initials: 'Dr. E. Sankaralingom' resolves", () => {
  assert.deepEqual(nameTokens("Dr. E. Sankaralingom"), ["e", "sankaralingom"]);
  const r = resolveName("Dr. E. Sankaralingom", REGISTRY);
  assert.equal(r.kind, "resolved");
  assert.equal((r as { email: string }).email, "elan@tce.edu");
});

test("reordered and truncated forms resolve", () => {
  assert.equal(resolveName("Sankaralingom Elangovan", REGISTRY).kind, "resolved");
  assert.equal(resolveName("Elangovan S", REGISTRY).kind, "resolved");
  const typo = resolveName("Karthik Subramaniam", REGISTRY); // typo: -iam
  assert.equal(typo.kind, "resolved");
  assert.equal((typo as { email: string }).email, "karthik@tce.edu");
});

test("ambiguity between near-namesakes downgrades to suggestion", () => {
  // "Priya R" sits between Priya Ramachandran and Priyanka Raman.
  const r = resolveName("Priya R", REGISTRY);
  assert.notEqual(r.kind, "unresolved");
  if (r.kind === "resolved") {
    // If it does resolve, it must be the exact-token candidate, never the fuzzier one.
    assert.equal(r.email, "priya@tce.edu");
  }
});

test("externals stay unresolved; email cells resolve directly", () => {
  assert.equal(resolveName("Rahul Mehrotra", REGISTRY).kind, "unresolved");
  const byEmail = resolveName("meena@tce.edu (corresponding)", REGISTRY);
  assert.equal(byEmail.kind, "resolved");
  assert.equal((byEmail as { email: string }).email, "meena@tce.edu");
});

test("multi-name cells split and resolve individually", () => {
  const parts = resolveNameList("Dr. E. Sankaralingom, Priya Ramachandran & Rahul Mehrotra", REGISTRY);
  assert.equal(parts.length, 3);
  assert.equal(parts[0].resolution.kind, "resolved");
  assert.equal(parts[1].resolution.kind, "resolved");
  assert.equal(parts[2].resolution.kind, "unresolved");
});

test("similarity is symmetric-ish and bounded", () => {
  const s = nameSimilarity("Meenakshi Sundaram", "Meenakshi Sundaram");
  assert.equal(s, 1);
  assert.ok(nameSimilarity("M. Sundaram", "Meenakshi Sundaram") > 0.7);
  assert.ok(nameSimilarity("Someone Else", "Meenakshi Sundaram") < 0.3);
});
