import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
})

export const metadata: Metadata = {
  title: "Collabix — Team Collaboration Platform",
  description: "Collabix is a web-based team collaboration and task management system built for premium workflows.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-bg text-text selection:bg-blue/20 selection:text-blue">
        {children}
      </body>
    </html>
  )
}
