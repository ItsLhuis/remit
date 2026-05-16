"use client"

import { type ComponentProps } from "react"

import { cn } from "@/lib/utils"

import NextImage, { type ImageProps } from "next/image"

import { Avatar as AvatarPrimitive } from "radix-ui"

type AvatarImageProps = Omit<ImageProps, "src"> & {
  src?: ImageProps["src"] | null
}

const Avatar = ({
  className,
  size = "default",
  ...props
}: ComponentProps<typeof AvatarPrimitive.Root> & {
  size?: "default" | "sm" | "lg"
}) => (
  <AvatarPrimitive.Root
    data-slot="avatar"
    data-size={size}
    className={cn(
      "group/avatar after:border-border relative flex size-8 shrink-0 rounded-full select-none after:absolute after:inset-0 after:rounded-full after:border after:mix-blend-darken data-[size=lg]:size-10 data-[size=sm]:size-6 dark:after:mix-blend-lighten",
      className
    )}
    {...props}
  />
)

const AvatarImage = ({
  className,
  src,
  alt = "",
  width = 160,
  height = 160,
  ...props
}: AvatarImageProps) => {
  const imageSrc = src === "" ? null : src

  return (
    <AvatarPrimitive.Image src={typeof imageSrc === "string" ? imageSrc : undefined} asChild>
      {imageSrc ? (
        <NextImage
          data-slot="avatar-image"
          src={imageSrc}
          alt={alt}
          width={width}
          height={height}
          className={cn("aspect-square size-full rounded-full object-cover", className)}
          {...props}
        />
      ) : null}
    </AvatarPrimitive.Image>
  )
}

const AvatarFallback = ({
  className,
  ...props
}: ComponentProps<typeof AvatarPrimitive.Fallback>) => (
  <AvatarPrimitive.Fallback
    data-slot="avatar-fallback"
    className={cn(
      "bg-muted text-muted-foreground flex size-full items-center justify-center rounded-full text-sm group-data-[size=sm]/avatar:text-xs",
      className
    )}
    {...props}
  />
)

const AvatarBadge = ({ className, ...props }: ComponentProps<"span">) => (
  <span
    data-slot="avatar-badge"
    className={cn(
      "bg-primary text-primary-foreground ring-background absolute right-0 bottom-0 z-10 inline-flex items-center justify-center rounded-full bg-blend-color ring-2 select-none",
      "group-data-[size=sm]/avatar:size-2 group-data-[size=sm]/avatar:[&>svg]:hidden",
      "group-data-[size=default]/avatar:size-2.5 group-data-[size=default]/avatar:[&>svg]:size-2",
      "group-data-[size=lg]/avatar:size-3 group-data-[size=lg]/avatar:[&>svg]:size-2",
      className
    )}
    {...props}
  />
)

const AvatarGroup = ({ className, ...props }: ComponentProps<"div">) => (
  <div
    data-slot="avatar-group"
    className={cn(
      "group/avatar-group *:data-[slot=avatar]:ring-background flex -space-x-2 *:data-[slot=avatar]:ring-2",
      className
    )}
    {...props}
  />
)

const AvatarGroupCount = ({ className, ...props }: ComponentProps<"div">) => (
  <div
    data-slot="avatar-group-count"
    className={cn(
      "bg-muted text-muted-foreground ring-background relative flex size-8 shrink-0 items-center justify-center rounded-full text-sm ring-2 group-has-data-[size=lg]/avatar-group:size-10 group-has-data-[size=sm]/avatar-group:size-6 [&>svg]:size-4 group-has-data-[size=lg]/avatar-group:[&>svg]:size-5 group-has-data-[size=sm]/avatar-group:[&>svg]:size-3",
      className
    )}
    {...props}
  />
)

export { Avatar, AvatarBadge, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage }
