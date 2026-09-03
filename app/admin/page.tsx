import type { Metadata } from "next";
import AdminPanel from "./AdminPanel";

export const metadata: Metadata = { title: "Администрирование — Tic Tac Toe Plus", robots: { index: false, follow: false } };

export default function AdminPage() {
  return <AdminPanel />;
}
