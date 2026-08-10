import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Badge, Card } from "@/components/ui";

function StatCard({ label, value, change }) {
  return (
    <Card variant="elevated" padding="lg" className="h-full">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
      {change ? <p className="mt-2 text-sm text-slate-500">{change}</p> : null}
    </Card>
  );
}

function ModuleCard({ module }) {
  const Icon = module.icon;

  return (
    <Card variant="default" padding="lg" className="h-full">
      <div className="flex items-start gap-4">
        {Icon ? (
          <div className="rounded-2xl border border-sky-100 bg-sky-50 p-3 text-sky-700">
            <Icon className="h-5 w-5" />
          </div>
        ) : null}
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-slate-900">{module.title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">{module.description}</p>
          {module.items?.length ? (
            <ul className="mt-3 space-y-1.5 text-sm text-slate-500">
              {module.items.map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

export default function ControlCenterPage({
  badge = "Workspace",
  title,
  description,
  tags = [],
  stats = [],
  modules = [],
  actions = [],
}) {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-white/80 p-8 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.32)] backdrop-blur-xl sm:p-10">
        <div className="pointer-events-none absolute -left-16 top-0 h-44 w-44 rounded-full bg-sky-300/25 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 bottom-0 h-48 w-48 rounded-full bg-violet-300/25 blur-3xl" />

        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-3xl">
            <Badge variant="secondary">{badge}</Badge>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              {title}
            </h1>
            <p className="mt-3 text-base leading-7 text-slate-600">{description}</p>
            {tags.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <Badge key={tag} variant="muted" className="normal-case tracking-normal">
                    {tag}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>

          {actions.length ? (
            <div className="flex flex-wrap items-center gap-3">
              {actions.map((action) => (
                <Link
                  key={action.label}
                  to={action.to}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/90 px-4 py-2 text-sm font-semibold text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-200 hover:bg-white"
                >
                  {action.label}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {stats.length ? (
        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <StatCard
              key={stat.label}
              label={stat.label}
              value={stat.value}
              change={stat.change}
            />
          ))}
        </section>
      ) : null}

      {modules.length ? (
        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          {modules.map((module) => (
            <ModuleCard key={module.title} module={module} />
          ))}
        </section>
      ) : null}
    </div>
  );
}
