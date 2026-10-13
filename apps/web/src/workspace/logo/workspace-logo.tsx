import { Avatar, AvatarFallback, AvatarImage } from "@/design-system/ui/avatar";
import { getInitials } from "@/design-system/get-initials";
import { cn } from "@/design-system/cn";

type WorkspaceLogoProps = {
  name: string;
  logo: string | null | undefined;
  className?: string;
};

/** A workspace's logo, or its initials when it has none. */
export function WorkspaceLogo({ name, logo, className }: WorkspaceLogoProps) {
  return (
    <Avatar className={cn("size-5 rounded-md", className)}>
      <AvatarImage src={logo ?? ""} alt="" />
      <AvatarFallback className="rounded-md border border-border/30 text-[10px] font-medium">
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
