export default function SnsSection() {
  const links = [
    {
      name: "X (Twitter)",
      handle: "@xinglang_cafe",
      href: "https://twitter.com/xinglang_cafe",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
    },
    {
      name: "Instagram",
      handle: "@xinglang_cafe",
      href: "https://instagram.com/xinglang_cafe",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
        </svg>
      ),
    },
    {
      name: "TikTok",
      handle: "@xinglang_cafe",
      href: "https://tiktok.com/@xinglang_cafe",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.3 6.3 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15.3a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V9.01a8.16 8.16 0 0 0 4.79 1.53V7.1a4.85 4.85 0 0 1-1.03-.41z" />
        </svg>
      ),
    },
  ];

  return (
    <section id="sec07" className="py-20 px-4 star-bg">
      <h2 className="section-title gradient-text">SNS</h2>

      <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-xl mx-auto">
        {links.map((link) => (
          <a
            key={link.name}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="glass flex-1 p-6 flex flex-col items-center gap-3 hover:border-neon-violet transition-all duration-300 hover:scale-105 text-center"
          >
            <span className="text-neon-purple">{link.icon}</span>
            <div>
              <div className="font-bold text-white">{link.name}</div>
              <div className="text-xs text-white/50">{link.handle}</div>
            </div>
          </a>
        ))}
      </div>

      <p className="text-center text-white/40 text-sm mt-10">
        © 2024 星狼 All rights reserved.
      </p>
    </section>
  );
}
