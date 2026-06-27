import { cookies } from "next/headers";
import { ADMIN_COOKIE, verifyAdminToken } from "@/lib/admin-auth";
import styles from "./admin.module.css";
import LoginForm from "./LoginForm";

export default async function AdminPage() {
  const secret = process.env.ADMIN_SECRET?.trim() ?? "";
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  const authed = secret
    ? await verifyAdminToken(token, secret, Date.now())
    : false;

  return (
    <div className={styles.shell}>
      {authed ? (
        <div className={styles.muted}>Authed ✓ (dashboard in Task 8)</div>
      ) : (
        <LoginForm />
      )}
    </div>
  );
}
