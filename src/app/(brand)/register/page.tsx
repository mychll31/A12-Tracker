"use client";

import { useActionState, useState } from "react";
import Link from "next/link";

import { signUp, type AuthState } from "../../(auth)/actions";

const initialState: AuthState = { error: null };

const fieldStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--a12-bg)",
  border: "1px solid var(--a12-line)",
  borderRadius: 11,
  padding: "13px 14px",
  color: "var(--a12-text)",
  fontSize: 14.5,
  fontFamily: "inherit",
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  color: "var(--a12-muted)",
  marginBottom: 7,
};

const hintStyle: React.CSSProperties = {
  fontSize: 12.5,
  color: "var(--a12-muted-2)",
  marginTop: 8,
};

/**
 * Create account — the front door of the onboarding experience.
 *
 * It wears the same navy-and-gold chrome as the /onboarding wizard (design
 * bundle: page-designs/project/Abundance12 Onboarding.dc.html) so that signing
 * up and setting up read as one continuous flow. Account creation itself still
 * needs an email and password — which the wizard's welcome step does not — so
 * those fields live here; `signUp` then drops the new account straight into the
 * five-step wizard.
 */
export default function RegisterPage() {
  const [state, formAction, pending] = useActionState(signUp, initialState);

  // Controlled fields. A `<form action>` is reset by React once the action
  // returns without navigating, so on a validation error uncontrolled inputs
  // would blank out — state keeps what the user typed alongside the warning.
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background:
          "radial-gradient(1000px 560px at 85% -10%, rgba(47,73,201,.18), transparent 60%), radial-gradient(800px 500px at 0% 15%, rgba(88,200,255,.07), transparent 55%), var(--a12-bg)",
      }}
    >
      {/* TOP BAR — identical to the wizard's, so the two pages share a masthead. */}
      <div style={{ borderBottom: "1px solid var(--a12-hairline)" }}>
        <div
          style={{
            maxWidth: 760,
            margin: "0 auto",
            padding: "18px 22px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <Link
            href="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              textDecoration: "none",
            }}
          >
            <div className="a12-orb" style={{ width: 36, height: 36 }} />
            <div style={{ lineHeight: 1 }}>
              <div
                className="cz"
                style={{
                  fontWeight: 700,
                  fontSize: 15,
                  letterSpacing: ".05em",
                  color: "var(--a12-text)",
                }}
              >
                ABUNDANCE 12
              </div>
              <div
                style={{
                  fontSize: 9.5,
                  letterSpacing: ".3em",
                  color: "var(--a12-gold)",
                  marginTop: 3,
                }}
              >
                THE GAME OF MY LIFE
              </div>
            </div>
          </Link>
          <div style={{ fontSize: 13, color: "var(--a12-muted)" }}>
            Create your account
          </div>
        </div>
      </div>

      {/* CARD */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "clamp(24px,5vw,54px) 22px",
        }}
      >
        <form
          action={formAction}
          className="a12-step-in"
          style={{
            width: "100%",
            maxWidth: 520,
            background: "var(--a12-panel)",
            border: "1px solid var(--a12-line)",
            borderRadius: 18,
            padding: "clamp(26px,4vw,44px)",
            boxShadow: "0 30px 70px rgba(0,0,0,.5)",
          }}
        >
          <div
            style={{
              fontSize: 12,
              letterSpacing: ".16em",
              textTransform: "uppercase",
              color: "var(--a12-cyan)",
              marginBottom: 12,
            }}
          >
            Create your account
          </div>
          <h1
            className="cz"
            style={{
              fontSize: "clamp(23px,4vw,32px)",
              fontWeight: 700,
              letterSpacing: ".01em",
              marginBottom: 10,
              color: "var(--a12-text)",
            }}
          >
            Enter Abundance 12
          </h1>
          <p
            style={{
              fontSize: 15,
              lineHeight: 1.55,
              color: "var(--a12-muted)",
              marginBottom: 28,
            }}
          >
            Your goals, your daily disciplines, your nightly reckoning — forged
            into one honest score. Setup takes about two minutes.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <div>
              <label htmlFor="a12-first" style={labelStyle}>
                First name
              </label>
              <input
                id="a12-first"
                name="firstName"
                autoComplete="given-name"
                placeholder="e.g. Maychell"
                required
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                style={fieldStyle}
              />
            </div>
            <div>
              <label htmlFor="a12-last" style={labelStyle}>
                Last name
              </label>
              <input
                id="a12-last"
                name="lastName"
                autoComplete="family-name"
                placeholder="e.g. Alcorin"
                required
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                style={fieldStyle}
              />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label htmlFor="a12-email" style={labelStyle}>
              Email
            </label>
            <input
              id="a12-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@abundancehub.io"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              style={fieldStyle}
            />
          </div>

          <div>
            <label htmlFor="a12-password" style={labelStyle}>
              Password
            </label>
            <input
              id="a12-password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              style={fieldStyle}
            />
            <p style={hintStyle}>
              At least 10 characters, with an uppercase letter and a number.
            </p>
          </div>

          {state.error ? (
            <p
              role="alert"
              style={{ ...hintStyle, color: "var(--a12-rose)", marginTop: 16 }}
            >
              {state.error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="a12-cta"
            style={{
              width: "100%",
              marginTop: 28,
              border: "none",
              fontWeight: 800,
              fontSize: 14.5,
              padding: "14px 28px",
              borderRadius: 11,
              cursor: pending ? "progress" : "pointer",
              opacity: pending ? 0.6 : 1,
              boxShadow: "0 6px 18px rgba(217,155,44,.35)",
            }}
          >
            {pending ? "Creating…" : "Create account"}
          </button>

          <p
            style={{
              marginTop: 18,
              textAlign: "center",
              fontSize: 13.5,
              color: "var(--a12-muted)",
            }}
          >
            Already have an account?{" "}
            <Link href="/login" style={{ fontWeight: 600 }}>
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
