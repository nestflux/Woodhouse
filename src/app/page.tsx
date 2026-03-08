import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="bg-background flex min-h-screen flex-col items-center justify-center gap-6">
      <h1 className="text-primary text-4xl font-bold">Woodhouse</h1>
      <p className="text-muted-foreground">Your AI recruiting agent.</p>
      <p className="text-blue-500">Tailwind is working.</p>
      <Button>shadcn/ui Button</Button>
    </main>
  );
}
