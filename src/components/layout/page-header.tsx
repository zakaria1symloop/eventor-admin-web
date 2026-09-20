import { ChevronLeft } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils/cn";

export interface BreadcrumbItem {
  label: ReactNode;
  href?: string;
}

export interface PageHeaderProps {
  breadcrumb?: BreadcrumbItem[];
  /** Shows a back chevron before the breadcrumb (detail pages). */
  back?: boolean;
  /** Omit on detail pages whose DetailHeader carries the title (USR-10). */
  title?: ReactNode;
  titleAddon?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  breadcrumb,
  back,
  title,
  titleAddon,
  subtitle,
  actions,
  className,
}: PageHeaderProps) {
  const backHref = back ? [...(breadcrumb ?? [])].reverse().find((b) => b.href)?.href : undefined;
  return (
    <div className={cn("mb-5 flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        {breadcrumb && breadcrumb.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-2 flex items-center gap-2 text-13 text-muted">
            {backHref && (
              <Link href={backHref} aria-label="Back" className="-ms-1 text-muted hover:text-ink">
                <ChevronLeft className="flip-rtl size-4" aria-hidden />
              </Link>
            )}
            <ol className="flex flex-wrap items-center gap-2">
              {breadcrumb.map((b, i) => {
                const last = i === breadcrumb.length - 1;
                return (
                  <Fragment key={i}>
                    <li aria-current={last ? "page" : undefined} className={cn(last && "text-ink")}>
                      {b.href && !last ? (
                        <Link href={b.href} className="hover:text-ink">
                          {b.label}
                        </Link>
                      ) : (
                        b.label
                      )}
                    </li>
                    {!last && (
                      <li aria-hidden className="text-faint">
                        /
                      </li>
                    )}
                  </Fragment>
                );
              })}
            </ol>
          </nav>
        )}
        {title !== undefined && (
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-26 font-semibold text-ink">{title}</h1>
            {titleAddon}
          </div>
        )}
        {subtitle && <p className="mt-1 text-14 text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
