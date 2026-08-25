import { type ComponentProps } from "react"

import { cn, getInitials } from "@/lib/utils"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/Avatar"

type EntityAvatarProps = Omit<ComponentProps<typeof Avatar>, "children"> & {
  name: string
  src?: string | null
  alt: string
  shape?: "circle" | "square"
}

// The one visual identity for any named record — a client, a lead, a contact, a team member — so a
// record without an image never leaves a hole. Lives in `components/ui` rather than in
// `features/clients` because leads and contacts want the same fallback and deciding it once is the
// point.
//
// The fallback is initials on the muted surface, with no colour derived from the record's id. An
// id-hashed hue is the usual answer and was rejected: DESIGN.md's Single Voice Rule permits indigo
// and the four semantic states as the only chroma on screen, so a palette of avatar colours would
// spend the system's entire colour budget on decoration. The initials carry the identity instead.
//
// `square` is the default because most Remit clients are companies, and a company mark reads wrong
// cropped to a circle; `circle` is for a person.
const EntityAvatar = ({
  name,
  src,
  alt,
  shape = "square",
  className,
  ...props
}: EntityAvatarProps) => (
  <Avatar
    data-slot="entity-avatar"
    className={cn(shape === "square" && "rounded-lg after:rounded-lg", className)}
    {...props}
  >
    <AvatarImage
      src={src}
      alt={alt}
      className={cn("object-contain", shape === "square" && "rounded-lg")}
    />
    <AvatarFallback className={cn("text-xs font-medium", shape === "square" && "rounded-lg")}>
      {getInitials(name)}
    </AvatarFallback>
  </Avatar>
)

export { EntityAvatar }
