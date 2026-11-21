import type { Metadata } from "next";
import { AdminDashboard } from "@/components/views/AdminDashboard";

export const metadata: Metadata = {
    title: "Administration",
    description: "Manage Oilinga sellers, shops, orders and marketplace operations.",
};

export default function AdminPage() {
    return <AdminDashboard />;
}
