/** The public home page at `/`. Intentionally minimal: the LYA site is not built yet,
 *  and the personality test (the live deliverable) is reached directly at /personality-test
 *  via a shared link / QR at the event — not advertised here. */
export function UnderConstruction() {
  return (
    <div className="screen">
      <div className="screen-center">
        <img src="/brand/logo.png" alt="" width={86} height={86} style={{ marginBottom: '.4rem' }} />
        <div className="eyebrow">Lutheran Young Adults</div>
        <h1 style={{ color: 'var(--teal)', fontWeight: 800, fontSize: '2rem', letterSpacing: '.02em', lineHeight: 1.1, margin: '.5rem 0 0' }}>
          Coming&nbsp;soon
        </h1>
        <p className="serif" style={{ fontSize: '1.25rem', opacity: 0.8, maxWidth: '24ch', lineHeight: 1.35, marginTop: '.5rem' }}>
          Our site is under construction. Check back soon!
        </p>
      </div>
    </div>
  )
}
