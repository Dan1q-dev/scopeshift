import type { Metadata } from "next";
import { ResultsView } from "@/components/results/ResultsView";

export const metadata: Metadata = { title: "Results | ScopeShift" };

export default function Results() {
  return <ResultsView />;
}
