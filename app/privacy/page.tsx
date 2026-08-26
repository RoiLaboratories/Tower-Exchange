import type { Metadata } from "next";
import LegalPageShell from "@/components/legal/LegalPageShell";
import { loadLegalDocument } from "@/lib/legal/loadLegalDocument";

export const metadata: Metadata = {
  title: "Privacy Policy | Tower Exchange",
  description:
    "Tower Exchange Privacy Policy describing how Towerdex Inc. collects and uses personal data.",
};

export default function PrivacyPage() {
  const { lastUpdated, sections } = loadLegalDocument("privacy policy.md");

  return (
    <LegalPageShell
      pageType="privacy"
      lastUpdated={lastUpdated}
      sections={sections}
      showTableOfContents
    />
  );
}
