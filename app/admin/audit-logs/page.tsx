import { RoutePlaceholder } from "@/src/ui/placeholders/RoutePlaceholder";
import { requireAdminPageSession } from "@/src/infrastructure/auth/session";

export const dynamic = "force-dynamic";

export default async function AdminAuditLogsPage() {
  await requireAdminPageSession();

  return (
    <RoutePlaceholder
      scope="admin"
      title="Audit logs"
      description="Placeholder for admin operation logs and payment/refund notification processing history."
      requirementRefs={["FR-070", "FR-071"]}
    />
  );
}
