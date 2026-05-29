import { redirect } from "next/navigation";

// Cases have been renamed to Encounters. Redirect for backwards compatibility.
export default function CasesPage() {
  redirect("/encounters");
}
