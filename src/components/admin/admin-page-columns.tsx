import type { ReactNode } from "react";

export function AdminPageColumns({ children }: { children: ReactNode }) {
  return <section className="grid items-start gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">{children}</section>;
}
