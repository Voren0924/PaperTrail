import { AuthForm } from "@/components/AuthForm";

export default function RegisterPage() {
  return (
    <section className="auth-page" aria-labelledby="register-title">
      <div>
        <p className="eyebrow">Create account</p>
        <h1 id="register-title">Register</h1>
        <p className="lede">Create a local PaperTrail account for uploading and querying your papers.</p>
      </div>
      <AuthForm mode="register" />
    </section>
  );
}
