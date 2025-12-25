'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
          <h1>Something went wrong!</h1>
          <p>{error.message || 'An unexpected error occurred'}</p>
          <button onClick={reset} style={{ padding: '0.5rem 1rem', marginTop: '1rem' }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}








