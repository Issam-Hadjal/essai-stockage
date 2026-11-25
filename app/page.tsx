import { Notes } from "@/components/notes";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Essai stockage</h1>
      <p className="mt-2 text-zinc-700 dark:text-zinc-300">
        Projet jetable pour essayer ouvrir-projet 1.1.0 et le kit IndexedDB.
      </p>
      <Notes />
    </main>
  );
}
