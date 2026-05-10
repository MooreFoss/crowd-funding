import { RoutePlaceholder } from "@/src/ui/placeholders/RoutePlaceholder";
import { requireAdminPageSession } from "@/src/infrastructure/auth/session";

export const dynamic = "force-dynamic";

export default async function AdminExpensesPage() {
  await requireAdminPageSession();

  return (
    <RoutePlaceholder
      scope="admin"
      title="Manage expenses"
      description="Placeholder for expense creation, editing, voiding, and audit trail."
      requirementRefs={["FR-050", "FR-051", "FR-052"]}
    />
  );
}
