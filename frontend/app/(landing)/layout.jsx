import { Logo } from "@/components/shared/Logo";
import { ThemeToggle } from "@/components/shared/ThemeToggle";

export default function LandingLayout({ children }) {
  return <div className="min-h-screen bg-background">{children}</div>;
}
