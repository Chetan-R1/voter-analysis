import api from "./client";
import type { Booth, ImportRecord, Project } from "@/lib/types";

export async function listProjects(orgId: number): Promise<Project[]> {
  const { data } = await api.get(`/organizations/${orgId}/projects`);
  return data;
}

export async function createProject(
  orgId: number,
  body: {
    name: string;
    election_type: string;
    state?: string;
    district?: string;
    constituency?: string;
  }
): Promise<Project> {
  const { data } = await api.post(`/organizations/${orgId}/projects`, body);
  return data;
}

export async function getProject(orgId: number, projectId: number): Promise<Project> {
  const { data } = await api.get(`/organizations/${orgId}/projects/${projectId}`);
  return data;
}

export async function updateProject(
  orgId: number,
  projectId: number,
  body: Partial<{ name: string; election_type: string; state: string; district: string; constituency: string; is_active: boolean }>
): Promise<Project> {
  const { data } = await api.patch(`/organizations/${orgId}/projects/${projectId}`, body);
  return data;
}

export async function deleteProject(orgId: number, projectId: number): Promise<void> {
  await api.delete(`/organizations/${orgId}/projects/${projectId}`);
}

export async function getProjectBooths(orgId: number, projectId: number): Promise<Booth[]> {
  const { data } = await api.get(`/organizations/${orgId}/projects/${projectId}/booths`);
  return data;
}

export async function getProjectImports(orgId: number, projectId: number): Promise<ImportRecord[]> {
  const { data } = await api.get(`/organizations/${orgId}/projects/${projectId}/imports`);
  return data;
}

export async function presignUpload(
  projectId: number,
  fileName: string
): Promise<{ upload_url: string; key: string; project_id: number } | null> {
  try {
    const { data } = await api.post("/imports/presign", null, {
      params: { file_name: fileName, project_id: projectId },
    });
    return data;
  } catch {
    return null;
  }
}

export async function registerUpload(key: string, fileName: string, projectId: number) {
  const { data } = await api.post("/imports/register", { key, file_name: fileName, project_id: projectId });
  return data;
}

export async function uploadPdf(projectId: number, file: File) {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post(`/imports/upload?project_id=${projectId}`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function retryImport(importId: number) {
  await api.post(`/imports/${importId}/retry`);
}

export async function deleteImport(importId: number) {
  await api.delete(`/imports/${importId}`);
}
