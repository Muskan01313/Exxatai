import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center bg-sidebar px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-menu">{children}</div>
    </div>
  );
}
