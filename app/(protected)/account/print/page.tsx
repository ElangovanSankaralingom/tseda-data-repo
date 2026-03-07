import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getProfileByEmail } from "@/lib/profileStore";
import { profile as profileRoute, signin } from "@/lib/entryNavigation";

export const dynamic = "force-dynamic";

export default async function PrintProfile() {
  const session = await getServerSession();
  const email = session?.user?.email;
  if (!email) redirect(signin());
  const profile = await getProfileByEmail(email);
  if (!profile) redirect(profileRoute());

  return (
    <div className="mx-auto max-w-3xl bg-white text-black p-8 print:p-0">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">T&apos;SEDA Data Repository</h1>
          <p className="text-sm">Profile Print</p>
        </div>
        <button
          className="border px-3 py-1 text-sm print:hidden"
          onClick={() => window.print()}
        >
          Print
        </button>
      </div>

      <hr className="my-4" />

      <h2 className="text-lg font-semibold">Basic</h2>
      <p><b>Name:</b> {profile.userPreferredName}</p>
      <p><b>Email:</b> {profile.email}</p>

      <hr className="my-4" />

      <h2 className="text-lg font-semibold">Personal</h2>
      <p><b>Date of Birth:</b> {profile.personal.dob ?? "-"}</p>
      <p><b>Blood Group:</b> {profile.personal.bloodGroup ?? "-"}</p>

      <hr className="my-4" />

      <h2 className="text-lg font-semibold">Academic</h2>
      <p><b>Date of Joining TCE:</b> {profile.academic.dateOfJoiningTce ?? "-"}</p>
      <p><b>Designation:</b> {profile.academic.designation ?? "-"}</p>
      <p><b>Ph.D Status:</b> {profile.academic.phdStatus ?? "-"}</p>

      <hr className="my-4" />

      <h2 className="text-lg font-semibold">Experience Entries</h2>

      <h3 className="font-semibold mt-3">LOP Periods</h3>
      {profile.experience.lop.length === 0 ? (
        <p>-</p>
      ) : (
        <ul className="list-disc ml-5">
          {profile.experience.lop.map((x) => (
            <li key={x.id}>
              {x.startDate} to {x.endDate ?? "Today"}
            </li>
          ))}
        </ul>
      )}

      <h3 className="font-semibold mt-3">Academic Outside TCE</h3>
      {profile.experience.academicOutside.length === 0 ? (
        <p>-</p>
      ) : (
        <ul className="list-disc ml-5">
          {profile.experience.academicOutside.map((x) => (
            <li key={x.id}>
              {x.institution} — {x.startDate} to {x.endDate} (Certificate: {x.certificate?.fileName ?? "missing"})
            </li>
          ))}
        </ul>
      )}

      <h3 className="font-semibold mt-3">Industry</h3>
      {profile.experience.industry.length === 0 ? (
        <p>-</p>
      ) : (
        <ul className="list-disc ml-5">
          {profile.experience.industry.map((x) => (
            <li key={x.id}>
              {x.company} ({x.role}) — {x.startDate} to {x.endDate} (Certificate: {x.certificate?.fileName ?? "missing"})
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
