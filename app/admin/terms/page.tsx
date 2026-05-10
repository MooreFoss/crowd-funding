import { RoutePlaceholder } from "@/src/ui/placeholders/RoutePlaceholder";

export default function AdminTermsPage() {
  return (
    <RoutePlaceholder
      scope="admin"
      title="Manage terms versions"
      description="Placeholder for versioned terms drafting, publishing, disabling, and public activation."
      requirementRefs={["FR-012", "FR-015"]}
    />
  );
}
