import { redirect } from "next/navigation";

import { RegistrationExperience } from "@/components/student/registration-experience";
import { getAuthenticatedUser } from "@/lib/auth";
import { getRegistrationCatalog } from "@/lib/repositories/registration";

export default async function StudentRegistrationPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/auth");

  const catalog = await getRegistrationCatalog();

  return <RegistrationExperience catalog={catalog} />;
}
