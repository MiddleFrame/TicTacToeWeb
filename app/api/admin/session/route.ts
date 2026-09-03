import { adminJson, requireAdmin } from "../../../backend/admin-auth";

export async function GET(request: Request): Promise<Response> {
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return admin;
  return adminJson({ admin: { nickname: admin.profile.nickname, publicCode: admin.profile.publicCode } });
}
