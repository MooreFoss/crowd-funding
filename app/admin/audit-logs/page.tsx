import { RoutePlaceholder } from "@/src/ui/placeholders/RoutePlaceholder";

export default function AdminAuditLogsPage() {
  return (
    <RoutePlaceholder
      scope="admin"
      title="Audit logs"
      description="Placeholder for admin operation logs and payment/refund notification processing history."
      requirementRefs={["FR-070", "FR-071"]}
    />
  );
}
