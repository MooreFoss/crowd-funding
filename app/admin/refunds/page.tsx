import { RoutePlaceholder } from "@/src/ui/placeholders/RoutePlaceholder";
import { requireAdminPageSession } from "@/src/infrastructure/auth/session";

export const dynamic = "force-dynamic";

export default async function AdminRefundsPage() {
  await requireAdminPageSession();

  return (
    <RoutePlaceholder
      scope="admin"
      title="Manage refunds"
      description="Placeholder for refund request, status tracking, and final result reconciliation."
      requirementRefs={["FR-042", "FR-071"]}
    />
  );
}
