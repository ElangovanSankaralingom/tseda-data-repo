export type Faculty = {
  name: string;
  email: string;
};

const RAW_FACULTY: Faculty[] = [
  { name: "Dr. G. Balaji", email: "gbarch@tce.edu" },
  { name: "Dr.J.Jinu Louishidha Kitchley", email: "jinujoshua@tce.edu" },
  { name: "Ar. S. Karthikeya Raja", email: "skrarch@tce.edu" },
  { name: "Dr. I. Chandramathy", email: "cmarch@tce.edu" },
  { name: "Ar. P. Vivek", email: "pvkarch@tce.edu" },
  { name: "Ar. S. Thangalavanya", email: "lavanya_arch@tce.edu" },
  { name: "Ar. M. Sindhuja", email: "crissindhu@tce.edu" },
  { name: "Ar. R. Jeyabalaji", email: "ajarch@tce.edu" },
  { name: "Dr. R. Meena Kumari", email: "rmiarch@tce.edu" },
  { name: "Ar. U. Vijay Anand", email: "uvaarch@tce.edu" },
  { name: "Mr. R. Vinoth Kumar", email: "rvkarch@tce.edu" },
  { name: "Ar. A. Ayswarya", email: "aaarch@tce.edu" },
  { name: "Ar. P. Pavalavelsh", email: "ppharch@tce.edu" },
  { name: "Ar. S. M. Vidhya Sankari", email: "smvsarch@tce.edu" },
  { name: "Ar. C. Piraiarasi", email: "cparch@tce.edu" },
  { name: "Ar. S. Elangovan", email: "senarch@tce.edu" },
  { name: "Ar.G.Vaishali", email: "gviarch@tce.edu" },
  { name: "Ar. M. Lekshmi Shunnma", email: "mlsarch@tce.edu" },
  { name: "Ar. M. Vishal", email: "mvlarch@tce.edu" },
  { name: "Ms. S. Anu", email: "saarch@tce.edu" },
  { name: "Ar. D. Gokul", email: "dglarch@tce.edu" },
  { name: "Ar. A. Geo", email: "agarch@tce.edu" },
  { name: "Ar. Divya Raveendran", email: "drnarch@tce.edu" },
  { name: "Ar. R. Prathiksha", email: "rpaarch@tce.edu" },
  { name: "Ar. SV. Lakshmipriya", email: "svlarch@tce.edu" },
  { name: "Ar. R. Roshma", email: "rrarch@tce.edu" },
  { name: "Ar. A. Akeel Alawdeen Kamal", email: "aakarch@tce.edu" },
  { name: "Ar. R. Saravana Raja", email: "rsrarch@tce.edu" },
  { name: "Ar. Gayathri Suresh", email: "gsharch@tce.edu" },
  { name: "Ar. S. Aravind Roshan", email: "sararch@tce.edu" },
  { name: "Ar. S. Sindhu", email: "ssuarch@tce.edu" },
  { name: "Dr. G. Sooraj", email: "gsjarch@tce.edu" },
];

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function movePreferredFaculty(entries: Faculty[]) {
  const remaining = [...entries];

  const takeFirst = (matcher: (entry: Faculty) => boolean) => {
    const index = remaining.findIndex(matcher);
    if (index < 0) return null;
    return remaining.splice(index, 1)[0];
  };

  const jinu = takeFirst((entry) => entry.name.toLowerCase().includes("jinu"));
  const balaji = takeFirst((entry) => normalizeEmail(entry.email) === "gbarch@tce.edu");

  return [jinu, balaji, ...remaining].filter((entry): entry is Faculty => entry !== null);
}

export const FACULTY: Faculty[] = movePreferredFaculty(
  RAW_FACULTY.map((entry) => ({
    name: entry.name,
    email: normalizeEmail(entry.email),
  }))
);

export function findFacultyByEmail(email: string): Faculty | null {
  const normalized = normalizeEmail(email);
  return FACULTY.find((entry) => entry.email === normalized) ?? null;
}

export function findFacultyByName(name: string): Faculty | null {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return null;
  return FACULTY.find((entry) => entry.name.trim().toLowerCase() === normalized) ?? null;
}

export function getCanonicalName(email: string): string | null {
  return findFacultyByEmail(email)?.name ?? null;
}
