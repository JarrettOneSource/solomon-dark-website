const RELEASES = 'https://github.com/JarrettOneSource/solomon-dark-website/releases/latest'
const DOWNLOADS = [
  { target: 'win32-x64', name: 'Windows', detail: '64-bit Windows · ZIP' },
  { target: 'darwin-arm64', name: 'Mac · Apple silicon', detail: 'M1 and newer · ZIP' },
  { target: 'darwin-x64', name: 'Mac · Intel', detail: 'Intel processors · ZIP' },
  { target: 'linux-x64', name: 'Linux', detail: '64-bit Linux · ZIP' },
]

export default function Downloads() {
  return <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
    <p className="mb-3 text-sm uppercase tracking-widest text-gold">Take the Dark with you</p>
    <h1 className="h-display text-3xl sm:text-4xl">Solomon Darker, offline</h1>
    <p className="mt-5 max-w-2xl text-lg leading-relaxed text-bone-dim">Play solo without an account or internet connection, or host a game for friends on your own computer. Your progress stays on your device.</p>
    <div className="mt-9 grid gap-4 sm:grid-cols-2">
      {DOWNLOADS.map(download => <a key={download.target} href={`${RELEASES}/download/Solomon-Darker-${download.target}.zip`} className="panel panel-ornate block p-6 hover:border-gold/60">
        <h2 className="h-display text-xl">Download for {download.name}</h2>
        <p className="mt-2 text-sm text-bone-dim">{download.detail}</p>
      </a>)}
    </div>
    <div className="mt-10 space-y-6 text-bone-dim">
      <p>Extract the ZIP and run Solomon Darker. Keep the extracted folder together. The app will let you know when an update is available; save and close the game before replacing it. Your local saves are kept separately.</p>
      <p>To play together, choose Host game and share an invite from the Game menu. Friends choose Join a friend. For internet play, the host needs a reachable IP or VPN address and an allowed, forwarded TCP port. Everyone needs the same version, and the host must keep the app open.</p>
      <p>These builds are not publisher-signed or notarized, so Windows or macOS may ask you to confirm the first launch. Cloud saves, accounts and Dark Cloud content are available in the web app.</p>
      <a href={RELEASES} className="link-arcane inline-block">Release notes and checksums →</a>
    </div>
  </main>
}
