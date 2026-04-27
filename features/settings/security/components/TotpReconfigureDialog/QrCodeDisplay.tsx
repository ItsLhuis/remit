import { QRCodeSVG } from "qrcode.react"

type QrCodeDisplayProps = {
  totpUri: string
}

const QrCodeDisplay = ({ totpUri }: QrCodeDisplayProps) => (
  <div className="mx-auto flex w-fit justify-center rounded-lg border bg-white p-4">
    <QRCodeSVG value={totpUri} bgColor="white" size={180} />
  </div>
)

export { QrCodeDisplay }
