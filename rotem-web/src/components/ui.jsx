export function Code({ title, children }) {
  return (
    <div className="codeblock">
      {title && (
        <div className="codeblock-head">
          <span>{title}</span>
        </div>
      )}
      <pre>{children}</pre>
    </div>
  )
}

export function Callout({ kind = 'info', title, children }) {
  return (
    <div className={`callout ${kind}`}>
      {title && <div className="callout-title">{title}</div>}
      {children}
    </div>
  )
}

export function Mini({ title, children }) {
  return (
    <div className="mini">
      <h4>{title}</h4>
      <p>{children}</p>
    </div>
  )
}

export function Card({ title, children }) {
  return (
    <div className="card">
      {title && <div className="card-title">{title}</div>}
      {children}
    </div>
  )
}

export function Table({ head, rows }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Tag({ color, children }) {
  return (
    <span className="tag">
      {color && <span className="swatch" style={{ background: `var(--${color})` }} />}
      {children}
    </span>
  )
}
