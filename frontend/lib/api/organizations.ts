import api from "./client";
import type { Organization } from "@/lib/types";

export async function listOrganizations(): Promise<Organization[]> {
  const { data } = await api.get("/organizations");
  return data;
}

export async function createOrganization(body: {
  name: string;
  slug: string;
  voter_symbol?: string;
}): Promise<Organization> {
  const { data } = await api.post("/organizations", body);
  return data;
}

export async function getOrganization(id: number): Promise<Organization> {
  const { data } = await api.get(`/organizations/${id}`);
  return data;
}

export async function updateOrganization(
  id: number,
  body: Partial<{ name: string; voter_symbol: string; is_active: boolean }>
): Promise<Organization> {
  const { data } = await api.patch(`/organizations/${id}`, body);
  return data;
}
