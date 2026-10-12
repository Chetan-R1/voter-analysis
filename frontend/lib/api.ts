import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000",
  withCredentials: true,
});

export default api;

/* ── Auth ───────────────────────────────────────────── */
export async function login(email: string, password: string) {
  await api.post("/auth/login", { email, password });
}

export async function logout() {
  await api.post("/auth/logout");
}

export async function me() {
  const { data } = await api.get("/auth/me");
  return data as { email: string };
}

/* ── Voter search ───────────────────────────────────── */
export interface Voter {
  id: number;
  serial_no: number;
  epic_no: string;
  name: string;
  name_en: string;
  relative_name: string;
  relative_name_en: string;
  relation_type: string;
  house_no: string;
  age: number;
  gender: string;
  hamlet: string | null;
  status: string;
  booth: Booth;
}

export interface Booth {
  id: number;
  district: string;
  panchayat_samiti: string;
  gram_panchayat: string;
  ward_no: number;
  booth_no: number | null;
  booth_name: string | null;
  assembly_constituency: string | null;
}

export async function searchVoter(epic: string): Promise<Voter | null> {
  try {
    const { data } = await api.get(`/voters/${encodeURIComponent(epic.trim().toUpperCase())}`);
    return data;
  } catch (e: any) {
    if (e?.response?.status === 404) return null;
    throw e;
  }
}

/* ── Relationships ──────────────────────────────────── */
export interface Relation {
  relation: string;
  confidence: number;
  voter: Voter;
}

export async function getRelationships(voterId: number): Promise<Relation[]> {
  const { data } = await api.get(`/voters/${voterId}/relationships`);
  return data;
}

/* ── Name / flexible search ─────────────────────────── */
export interface SearchParams {
  q?: string;
  booth_id?: number;
  gender?: string;
  age_min?: number;
  age_max?: number;
  sort?: "name" | "age_asc" | "age_desc" | "serial";
  page?: number;
  page_size?: number;
}

export interface SearchResult {
  total: number;
  page: number;
  page_size: number;
  pages: number;
  voters: Voter[];
}

export async function searchVoters(params: SearchParams): Promise<SearchResult> {
  const { data } = await api.get("/voters/search", { params });
  return data;
}

export async function listBooths(): Promise<Booth[]> {
  const { data } = await api.get("/booths");
  return data;
}

export interface WardVotersResult {
  booth: Booth;
  summary: {
    total: number;
    male: number;
    female: number;
    third: number;
    age_groups: Record<string, number>;
  };
  total: number;
  page: number;
  page_size: number;
  pages: number;
  voters: Voter[];
}

export async function getWardVoters(
  boothId: number,
  params: Omit<SearchParams, "q" | "booth_id">
): Promise<WardVotersResult> {
  const { data } = await api.get(`/booths/${boothId}/voters`, { params });
  return data;
}

/* ── Ward analysis ──────────────────────────────────── */
export interface WardStats {
  booth: Booth;
  total: number;
  male: number;
  female: number;
  third: number;
  age_groups: Record<string, number>;
  hamlets: { hamlet: string; count: number }[];
}

export async function getWardStats(boothId: number): Promise<WardStats> {
  const { data } = await api.get(`/booths/${boothId}/stats`);
  return data;
}

/* ── Presigned upload ───────────────────────────────── */
export async function presignUpload(fileName: string): Promise<{ upload_url: string; key: string } | null> {
  try {
    const { data } = await api.post("/imports/presign", null, { params: { file_name: fileName } });
    return data;
  } catch {
    return null; // R2 not configured — fall back to direct upload
  }
}

export async function registerUpload(key: string, fileName: string) {
  const { data } = await api.post("/imports/register", { key, file_name: fileName });
  return data;
}
