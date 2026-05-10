import { RoutePlaceholder } from "@/src/ui/placeholders/RoutePlaceholder";

export default function AdminExpensesPage() {
  return (
    <RoutePlaceholder
      scope="admin"
      title="Manage expenses"
      description="Placeholder for expense creation, editing, voiding, and audit trail."
      requirementRefs={["FR-050", "FR-051", "FR-052"]}
    />
  );
}
