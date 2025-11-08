import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"

import { FileProvider } from "@/lib/file-context"
import { Navbar } from "@/components/navbar"
import "./globals.css"

// Initialize fonts
const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
})

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
})

export const metadata: Metadata = {
  title: "Any-file - Convert Files Privately",
  description: "Convert PDF, DOCX, XLSX, images, audio and video files online",
    generator: 'v0.app'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${geist.variable} ${geistMono.variable} font-sans antialiased`}>
        <Navbar />
        <FileProvider>{children}</FileProvider>
      </body>
    </html>
  )
}
