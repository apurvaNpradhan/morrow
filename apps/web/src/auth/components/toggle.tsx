import { Link } from "@tanstack/react-router";
import { useRegistrationStatus } from "@/auth/use-registration-status";

type AuthToggleProps = {
  message: string;
  linkText: string;
  linkTo: string;
};

export function AuthToggle({ message, linkText, linkTo }: AuthToggleProps) {
  const { data: registration } = useRegistrationStatus();

  if (registration?.open === false) {
    return null;
  }

  return (
    <div className="text-center text-sm text-muted-foreground mt-3">
      {message}{" "}
      <Link
        to={linkTo}
        className="underline underline-offset-4 hover:text-primary"
      >
        {linkText}
      </Link>
    </div>
  );
}
