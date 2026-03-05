export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-md space-y-8">
          {/* BOSAL Logo */}
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#C8102E] shadow-lg">
                <svg viewBox="0 0 24 24" className="h-7 w-7 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2" />
                  <path d="M8.5 2h7" />
                  <path d="M7 16.5h10" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">BOSAL</h1>
                <p className="text-xs text-muted-foreground tracking-widest uppercase">Chemistry Copilot</p>
              </div>
            </div>
          </div>

          {children}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t py-4 text-center text-xs text-muted-foreground">
        Made by BelgaLabs &mdash; Petrica Dulgheru
      </footer>
    </div>
  );
}
