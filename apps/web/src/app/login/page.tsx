import { AuthForm } from "@/components/AuthForm";

export default function LoginPage() {
  return (
    <section className="auth-page" aria-labelledby="login-title">
      <div>
        <p className="eyebrow">Welcome back</p>
        <h1 id="login-title">Log in</h1>
        <p className="lede">Continue to your paper library and grounded chat sessions.</p>
      </div>
      <AuthForm mode="login" />
    </section>
  );
}
