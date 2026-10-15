import { Avatar, AvatarFallback, AvatarImage } from "@/design-system/ui/avatar";
import { cn } from "@/design-system/cn";
import { getInitials } from "@/design-system/get-initials";
import type { Person } from "../queries/use-workspace-people";

/** A Member's picture, or their initials. */
export function PersonAvatar({
  person,
  className,
}: {
  person: Pick<Person, "name" | "image">;
  className?: string;
}) {
  return (
    <Avatar className={cn("size-5 text-[0.625rem]", className)}>
      {person.image ? <AvatarImage src={person.image} alt="" /> : null}
      <AvatarFallback>{getInitials(person.name)}</AvatarFallback>
    </Avatar>
  );
}
