import { Link } from "@tanstack/react-router";

type LogoProps = {
  className?: string;
};

export function Logo({ className = "" }: LogoProps) {
  return (
    <Link to="/" className={`w-auto ${className}`}>
      <img
        src="/logo-dark.svg"
        alt="Morrow"
        className="h-7 w-auto dark:hidden"
      />
      <img
        src="/logo-light.svg"
        alt="Morrow"
        className="hidden h-7 w-auto dark:block"
      />
    </Link>
  );
}
