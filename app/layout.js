import './globals.css'

export const metadata = {
  title: 'Polymarket Insider Tracker',
  description: 'Track insider trading patterns in Polymarket Tech markets',
}

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
