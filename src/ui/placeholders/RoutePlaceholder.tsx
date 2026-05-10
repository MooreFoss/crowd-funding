import Link from "next/link";
import { adminRoutes, publicRoutes, type RouteScope } from "@/src/config/navigation";

type RoutePlaceholderProps = {
  title: string;
  description: string;
  scope: RouteScope;
  requirementRefs?: string[];
};

export function RoutePlaceholder({
  title,
  description,
  scope,
  requirementRefs = [],
}: RoutePlaceholderProps) {
  const routes = scope === "admin" ? adminRoutes : publicRoutes;

  return (
    <main className="flex min-h-screen flex-1 bg-zinc-50 text-zinc-950">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-10">
        <nav className="flex flex-wrap gap-2">
          {routes.map((route) => (
            <Link
              className="rounded border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:border-zinc-400 hover:text-zinc-950"
              href={route.href}
              key={route.href}
            >
              {route.label}
            </Link>
          ))}
        </nav>

        <section className="rounded border border-dashed border-zinc-300 bg-white p-8 shadow-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Scaffold only
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-600">{description}</p>
          {requirementRefs.length > 0 ? (
            <div className="mt-6 flex flex-wrap gap-2">
              {requirementRefs.map((ref) => (
                <span
                  className="rounded border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs text-zinc-600"
                  key={ref}
                >
                  {ref}
                </span>
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
