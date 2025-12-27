'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="container">
      <div className="header">
        <h1>Something went wrong!</h1>
      </div>
      <div className="section">
        <p style={{ color: '#666', marginBottom: '1rem' }}>
          {error.message || 'An unexpected error occurred'}
        </p>
        <button onClick={reset} className="btn btn-primary">
          Try again
        </button>
      </div>
    </div>
  );
}









