import { redirect } from "next/navigation";

export default function RbacRoot() {
  redirect("/rbac/roles");
}
