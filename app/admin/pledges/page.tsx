import { RoutePlaceholder } from "@/src/ui/placeholders/RoutePlaceholder";
import { requireAdminPageSession } from "@/src/infrastructure/auth/session";

export const dynamic = "force-dynamic";

export default async function AdminPledgesPage() {
  await requireAdminPageSession();

  return (
    <RoutePlaceholder
      scope="admin"
      title="Manage sponsorship records"
      description="Placeholder for querying paid orders, editing display fields, and viewing audit details."
      requirementRefs={["FR-040", "FR-041", "FR-043"]}
    />
  );
}
