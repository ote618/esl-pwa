/* Icons lifted from the mockup so the preview matches it exactly. */

export function Speaker () {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" stroke="none" />
      <path d="M17 8.5a5 5 0 0 1 0 7" />
      <path d="M20 6a9 9 0 0 1 0 12" />
    </svg>
  )
}

const PATHS = {
  video: (
    <>
      <rect x="2" y="4" width="20" height="16" rx="4" />
      <path d="M10 9.5v5l4.5-2.5z" fill="currentColor" stroke="none" />
    </>
  ),
  tarea: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="3" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </>
  ),
  juegos: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5l3.2 2.3-1.2 3.7h-4L8.8 9.8z" fill="currentColor" stroke="none" />
      <path d="M12 3v4.5M4.2 9.3l4.6.5M19.8 9.3l-4.6.5M7 20l3-6.5M17 20l-3-6.5" />
    </>
  )
}

export function LessonIcon ({ name }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  )
}
