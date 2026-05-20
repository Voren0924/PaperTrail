import type { ReactNode } from "react";

type AlertProps = {
  children: ReactNode;
  tone?: "info" | "error" | "success" | "warning";
  title?: string;
};

export function Alert({ children, title, tone = "info" }: AlertProps) {
  return (
    <div className={`alert alert--${tone}`} role={tone === "error" ? "alert" : "status"}>
      {title ? <strong>{title}</strong> : null}
      <div>{children}</div>
    </div>
  );
}
