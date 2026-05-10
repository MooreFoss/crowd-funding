export type RouteScope = "public" | "admin";

export type AppRoute = {
  href: string;
  label: string;
  scope: RouteScope;
};

export const publicRoutes: AppRoute[] = [
  { href: "/", label: "Overview", scope: "public" },
  { href: "/pledges", label: "Sponsorships", scope: "public" },
  { href: "/expenses", label: "Expenses", scope: "public" },
  { href: "/sponsor", label: "Sponsor", scope: "public" },
  { href: "/terms", label: "Terms", scope: "public" },
];

export const adminRoutes: AppRoute[] = [
  { href: "/admin/pledges", label: "Sponsorships", scope: "admin" },
  { href: "/admin/refunds", label: "Refunds", scope: "admin" },
  { href: "/admin/expenses", label: "Expenses", scope: "admin" },
  { href: "/admin/terms", label: "Terms", scope: "admin" },
  { href: "/admin/audit-logs", label: "Audit logs", scope: "admin" },
];
