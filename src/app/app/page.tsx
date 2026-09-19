import { ensureUser } from "@/lib/auth";

export default async function AppHome() {
  const user = await ensureUser();

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Home</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Signed in as {user.email}. Your trips will appear here.
      </p>
    </div>
  );
}
