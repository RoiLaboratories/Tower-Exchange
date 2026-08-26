import type { Metadata } from "next";
import LegalPageShell from "@/components/legal/LegalPageShell";
import { loadLegalDocument } from "@/lib/legal/loadLegalDocument";

export const metadata: Metadata = {
  title: "Terms and Conditions | Tower Exchange",
  description:
    "Tower Exchange Terms and Conditions governing use of tower.exchange and app.tower.exchange.",
};

export default function TermsPage() {
  const { lastUpdated, sections } = loadLegalDocument("terms and conditions.md");

  return (
    <LegalPageShell
      pageType="terms"
      lastUpdated={lastUpdated}
      sections={sections}
    />
  );
}
