import Link from "next/link";

export function AppNav() {
  return (
    <nav className="nav" aria-label="Primary navigation">
      <Link href="/papers">Documents</Link>
      <Link href="/papers/new">Import</Link>
      <Link href="/settings">Settings</Link>
    </nav>
  );
}
