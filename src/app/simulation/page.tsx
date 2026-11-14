import type { Metadata } from "next";
import { Workspace } from "@/components/simulation/Workspace";

export const metadata: Metadata = { title: "Simulation | ScopeShift" };

export default function Simulation() {
  return <Workspace />;
}
