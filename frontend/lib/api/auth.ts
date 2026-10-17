import api from "./client";

export async function login(email: string, password: string) {
  await api.post("/auth/login", { email, password });
}

export async function logout() {
  await api.post("/auth/logout");
}

export async function me(): Promise<{ email: string }> {
  const { data } = await api.get("/auth/me");
  return data;
}

export async function createUser(email: string, password: string): Promise<{ id: number; email: string }> {
  const { data } = await api.post("/auth/register", { email, password });
  return data;
}
