import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Spark Minting Portal</title>
      </head>
      <body className="min-h-screen">
        <div className="max-w-3xl mx-auto p-6">{children}</div>
      </body>
    </html>
  );
}
