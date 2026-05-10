import { RoutePlaceholder } from "@/src/ui/placeholders/RoutePlaceholder";

export default function AdminRefundsPage() {
  return (
    <RoutePlaceholder
      scope="admin"
      title="Manage refunds"
      description="Placeholder for refund request, status tracking, and final result reconciliation."
      requirementRefs={["FR-042", "FR-071"]}
    />
  );
}
