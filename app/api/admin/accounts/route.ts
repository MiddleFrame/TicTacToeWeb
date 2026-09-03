import { getRawDb } from "../../../../db";
import { adminJson, requireAdmin } from "../../../backend/admin-auth";
import { searchAdminAccounts } from "../../../backend/admin-data";
import { adminSearchQuery } from "../../../backend/admin-policy";

export async function GET(request: Request): Promise<Response> {
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return admin;
  const query = adminSearchQuery(new URL(request.url).searchParams.get("query"));
  if (!query) return adminJson({ error: "invalid-search" }, 400);
  return adminJson(await searchAdminAccounts(getRawDb(), query));
}
