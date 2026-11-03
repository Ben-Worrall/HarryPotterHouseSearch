import type { Metadata } from 'next'
import { IM_Fell_English, Source_Serif_4, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'

const imFell = IM_Fell_English({
  weight: '400',
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-body',
  display: 'swap',
})

const ibmMono = IBM_Plex_Mono({
  weight: ['400', '500'],
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'The Sorting Register',
  description: 'Sort fictional characters from books and films into Hogwarts houses',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${imFell.variable} ${sourceSerif.variable} ${ibmMono.variable}`}>
        {children}
      </body>
    </html>
  )
}
