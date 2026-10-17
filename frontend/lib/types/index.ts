export interface Organization {
  id: number;
  name: string;
  slug: string;
  voter_symbol: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Project {
  id: number;
  org_id: number;
  name: string;
  election_type: string;
  state: string | null;
  district: string | null;
  constituency: string | null;
  is_active: boolean;
  created_at: string;
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

export interface Relation {
  relation: string;
  confidence: number;
  voter: Voter;
}

export interface SearchResult {
  total: number;
  page: number;
  page_size: number;
  pages: number;
  voters: Voter[];
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

export interface WardStats {
  booth: Booth;
  total: number;
  male: number;
  female: number;
  third: number;
  age_groups: Record<string, number>;
  hamlets: { hamlet: string; count: number }[];
}

export interface ImportRecord {
  id: number;
  file_name: string;
  status: "uploaded" | "processing" | "done" | "review" | "failed";
  total_voters: number | null;
  issues: number;
  imported_at: string | null;
}

export interface RbacRole {
  id: number;
  org_id: number;
  name: string;
  code: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  permission_ids: number[];
}

export interface RoleUser {
  id: number;
  email: string;
  is_active: boolean;
}

export interface OrgMember {
  id: number;
  email: string;
  is_active: boolean;
  created_at: string;
  role_id: number | null;
  role_code: string | null;
  role_name: string | null;
}

export interface MyPermissions {
  user_id: number;
  roles: string[];
  permissions: string[];
}

export interface RbacPermission {
  id: number;
  name: string;
  code: string;
  resource: string;
  action: string;
  description: string | null;
  is_active: boolean;
}

export const ELECTION_TYPE_LABELS: Record<string, string> = {
  loksabha: "Lok Sabha",
  vidhan_sabha: "Vidhan Sabha",
  nagar_nigam: "Nagar Nigam",
  nagar_palika: "Nagar Palika",
  nagar_panchayat: "Nagar Panchayat",
  gram_panchayat: "Gram Panchayat",
  block: "Block",
};
