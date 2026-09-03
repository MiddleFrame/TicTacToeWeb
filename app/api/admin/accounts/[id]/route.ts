import { getRawDb } from "../../../../../db";
import { adminJson, requireAdmin } from "../../../../backend/admin-auth";
import { readAdminAccount } from "../../../../backend/admin-data";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return admin;
  const { id } = await context.params;
  if (!/^[a-f0-9-]{36}$/i.test(id)) return adminJson({ error: "invalid-account-id" }, 400);
  const detail = await readAdminAccount(getRawDb(), admin.id, id);
  return detail ? adminJson(detail) : adminJson({ error: "account-not-found" }, 404);
}
