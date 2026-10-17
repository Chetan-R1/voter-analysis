// Re-export everything from the new modular api/ folder
export { default } from "./api/client";
export * from "./api/auth";
export * from "./api/organizations";
export * from "./api/projects";
export * from "./api/voters";
export * from "./api/rbac";

// Re-export types for backward compatibility
export type {
  Voter, Booth, Relation, SearchResult,
  WardVotersResult, WardStats, ImportRecord,
  Organization, Project, RbacRole, RbacPermission,
  OrgMember, MyPermissions, RoleUser,
} from "./types";
export type { RoleHierarchy } from "./api/rbac";
