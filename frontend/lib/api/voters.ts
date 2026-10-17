import api from "./client";
import type { Relation, SearchResult, Voter, WardStats, WardVotersResult } from "@/lib/types";

export async function searchVoterByEpic(epic: string): Promise<Voter | null> {
  try {
    const { data } = await api.get(`/voters/${encodeURIComponent(epic.trim().toUpperCase())}`);
    return data;
  } catch (e: any) {
    if (e?.response?.status === 404) return null;
    throw e;
  }
}

export async function searchVoters(params: {
  q?: string;
  booth_id?: number;
  gender?: string;
  age_min?: number;
  age_max?: number;
  sort?: "name" | "age_asc" | "age_desc" | "serial";
  page?: number;
  page_size?: number;
}): Promise<SearchResult> {
  const { data } = await api.get("/voters/search", { params });
  return data;
}

export async function getFamily(voterId: number): Promise<Relation[]> {
  const { data } = await api.get(`/voters/${voterId}/family`);
  return data;
}

export async function getWardVoters(
  boothId: number,
  params: {
    gender?: string;
    age_min?: number;
    age_max?: number;
    sort?: string;
    page?: number;
    page_size?: number;
  }
): Promise<WardVotersResult> {
  const { data } = await api.get(`/booths/${boothId}/voters`, { params });
  return data;
}

export async function getWardStats(boothId: number): Promise<WardStats> {
  const { data } = await api.get(`/booths/${boothId}/stats`);
  return data;
}
