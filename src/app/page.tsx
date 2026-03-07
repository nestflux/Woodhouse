export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center" style={{ background: "var(--background)" }}>
      <h1 className="text-4xl font-bold" style={{ color: "var(--primary)" }}>
        Woodhouse
      </h1>
      <p className="mt-4" style={{ color: "var(--text-secondary)" }}>
        Your AI recruiting agent.
      </p>
      <p className="mt-2 text-blue-500">Tailwind is working.</p>
    </main>
  );
}
