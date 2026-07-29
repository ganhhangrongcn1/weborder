export default function FullPageState({ title, description }) {
  return (
    <main className="full-page-state">
      <div className="state-mark" aria-hidden="true">GHR</div>
      <h1>{title}</h1>
      <p>{description}</p>
    </main>
  );
}
