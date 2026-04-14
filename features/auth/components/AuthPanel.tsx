import Image from "next/image"

import { AuroraText, Typography } from "@/components/ui"

const AuthPanel = () => {
  return (
    <div className="relative hidden h-screen w-1/3 flex-col overflow-hidden lg:flex">
      <Image
        src="/login.jpg"
        alt=""
        fill
        priority
        quality={90}
        sizes="33vw"
        className="absolute inset-0 z-0 object-cover object-[center_20%]"
      />
      <div
        className="absolute inset-0 z-10"
        style={{
          background: "linear-gradient(to right, rgba(0,0,0,0.82), rgba(0,0,0,0.2), transparent)"
        }}
      />
      <div
        className="absolute inset-0 z-10"
        style={{
          background: "linear-gradient(to top, rgba(0,0,0,0.95), rgba(0,0,0,0.45), transparent)"
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 z-10 opacity-25"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "128px 128px"
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background: "radial-gradient(ellipse at 65% 40%, transparent 30%, rgba(0,0,0,0.45) 100%)"
        }}
      />
      <div className="absolute top-8 left-8 z-20 flex items-center gap-2.5">
        <Image src="/logo.png" width={32} height={32} alt="Remit" />
        <Typography variant="h5" className="tracking-tight text-white">
          Remit
        </Typography>
      </div>
      <div className="absolute inset-x-8 bottom-8 z-20 flex flex-col items-start">
        <Typography variant="h1" className="leading-[1.15] text-white">
          Your work.
          <br />
          <AuroraText>Your terms.</AuroraText>
        </Typography>
        <div className="bg-primary my-4 h-px w-8" />
        <Typography className="max-w-67 leading-relaxed text-white/55">
          Manage clients, projects, proposals and invoices &mdash; self-hosted and fully yours. No
          subscriptions, no lock-in.
        </Typography>
        <div className="mt-6 flex items-center gap-3">
          <Typography affects={["small", "uppercase"]} className="tracking-widest text-white/35">
            Self-hosted
          </Typography>
          <Typography className="text-white/20">·</Typography>
          <Typography affects={["small", "uppercase"]} className="tracking-widest text-white/35">
            Open source
          </Typography>
          <Typography className="text-white/20">·</Typography>
          <Typography affects={["small", "uppercase"]} className="tracking-widest text-white/35">
            Own your data
          </Typography>
        </div>
      </div>
    </div>
  )
}

export { AuthPanel }
