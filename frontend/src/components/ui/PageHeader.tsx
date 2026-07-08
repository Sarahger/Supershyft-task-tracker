interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4 mb-8">
      <div className="min-w-0">
        <h1 className="text-[1.75rem] font-semibold text-text-primary tracking-tight leading-tight">{title}</h1>
        {subtitle && <p className="text-sm text-text-secondary mt-1">{subtitle}</p>}
      </div>
      {action && (
        <div className="shrink-0 flex justify-end md:justify-start">
          {action}
        </div>
      )}
    </div>
  );
}

export function WorkspaceSection({ title, count, children, empty }: {
  title: string;
  count?: number;
  children: React.ReactNode;
  empty?: React.ReactNode;
}) {
  const isEmpty = empty !== undefined;
  return (
    <section className="workspace-section">
      <h2 className="workspace-section-title">
        {title}{count !== undefined ? ` · ${count}` : ''}
      </h2>
      {isEmpty ? empty : children}
    </section>
  );
}
