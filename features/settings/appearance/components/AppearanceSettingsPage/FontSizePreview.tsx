type FontSizePreviewProps = {
  textSize: string
}

const FontSizePreview = ({ textSize }: FontSizePreviewProps) => (
  <div className="border-border bg-background flex h-16 w-full items-center justify-center overflow-hidden rounded-md border">
    <span style={{ fontSize: textSize }} className="text-foreground leading-none font-medium">
      Aa
    </span>
  </div>
)

export { FontSizePreview }
