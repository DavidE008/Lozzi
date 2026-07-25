import { redirect } from "next/navigation";

import { getAuthenticatedUser } from "@/lib/auth";
import { getRoleHomeForUser } from "@/lib/repositories/access";

export default async function Home() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/auth");
  redirect(await getRoleHomeForUser(user.id));
}
