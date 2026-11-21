import type { Metadata } from "next";
import { ShopsDirectoryView } from "@/components/views/ShopsDirectoryView";

export const metadata: Metadata = {
    title: "Shops",
    description: "Meet the producers, farms and co-operatives behind products published on Oilinga.",
};

export default function ShopsPage() { return <ShopsDirectoryView />; }
