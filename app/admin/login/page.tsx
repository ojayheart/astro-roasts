import { redirect } from "next/navigation";
import { adminAuthConfigured, isAdminAuthed } from "@/lib/admin-auth";
import LoginForm from "./LoginForm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  if (await isAdminAuthed()) {
    redirect("/admin");
  }

  const configured = adminAuthConfigured();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="mb-10 text-center">
        <p className="text-blood text-xs uppercase tracking-[0.4em] mb-2">
          Astroroast
        </p>
        <h1 className="font-syne text-3xl font-extrabold uppercase tracking-tight">
          Admin
        </h1>
      </div>

      {configured ? (
        <LoginForm />
      ) : (
        <p className="max-w-sm text-center text-ash/60 text-sm leading-relaxed">
          Admin login is disabled. Set the{" "}
          <code className="text-blood">ADMIN_PASSWORD</code> environment variable
          on the server, then reload this page.
        </p>
      )}
    </main>
  );
}
