import { QRCodeSVG } from "qrcode.react"

type QrCodeDisplayProps = {
  totpUri: string
}

// A literal white background rather than a theme token, on both the frame and the code itself: a
// QR code has to stay dark-on-light to scan, and a `bg-background` here would invert it under the
// dark theme and leave the user unable to enrol.
const QrCodeDisplay = ({ totpUri }: QrCodeDisplayProps) => (
  <div className="mx-auto flex w-fit justify-center rounded-lg border bg-white p-4">
    <QRCodeSVG value={totpUri} bgColor="white" size={180} />
  </div>
)

export { QrCodeDisplay }
