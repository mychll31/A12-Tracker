"use client";

import { useActionState, useState } from "react";

import { GOAL_CATEGORY_KEYS, type GoalCategoryKey } from "@/lib/domain";
import type { OnboardingState } from "@/server/onboarding";

import { submitOnboarding } from "./actions";
import { INITIAL_ONBOARDING_STATE } from "./form-state";

const STEP_COUNT = 5;

const PLACEHOLDERS: Record<GoalCategoryKey, { goal: string; task: string }> = {
  PERSONAL: {
    goal: "e.g. Lose 15 pounds without crash dieting",
    task: "e.g. Book a gym induction",
  },
  PROFESSIONAL: {
    goal: "e.g. Get promoted to senior",
    task: "e.g. Ask my manager what senior looks like",
  },
  CONTRIBUTION: {
    goal: "e.g. Mentor 3 junior colleagues",
    task: "e.g. Offer to mentor one junior this month",
  },
};

/** The disciplines are seeded per organization; an unknown key still gets a face. */
const CORE_TASK_ICONS: Record<string, string> = {
  MEDITATION: "🧠",
  COACHING_CALL: "📞",
  EXERCISE: "🏋️",
  EVERYDAY_LEARNING: "📖",
};
const CORE_TASK_FALLBACK_ICON = "◆";

const MOODS = ["😞", "😕", "😐", "🙂", "😄"];
const MOOD_LABELS = ["Rough", "Off", "Even", "Good", "Great"];

type GoalDraft = { title: string; task: string };

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
  marginTop: 10,
};

function emptyGoals(): Record<GoalCategoryKey, GoalDraft> {
  return {
    PERSONAL: { title: "", task: "" },
    PROFESSIONAL: { title: "", task: "" },
    CONTRIBUTION: { title: "", task: "" },
  };
}

export function OnboardingWizard({
  state,
  menteeGroupId,
}: {
  state: OnboardingState;
  /** The circle a coach already placed them in, if any — read-only when set. */
  menteeGroupId: string | null;
}) {
  const [formState, formAction, isPending] = useActionState(
    submitOnboarding,
    INITIAL_ONBOARDING_STATE,
  );

  const [step, setStep] = useState(0);
  const [name, setName] = useState(state.firstName);
  const [goals, setGoals] =
    useState<Record<GoalCategoryKey, GoalDraft>>(emptyGoals);
  const [mood, setMood] = useState(4);
  const [wins, setWins] = useState("");
  const [circleId, setCircleId] = useState<string | null>(
    state.hasGroup ? menteeGroupId : null,
  );
  const [focusedMood, setFocusedMood] = useState<number | null>(null);
  const [focusedCircle, setFocusedCircle] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);

  const placedCircle =
    state.circles.find((circle) => circle.id === menteeGroupId) ?? null;

  const goalsComplete = GOAL_CATEGORY_KEYS.every(
    (key) => goals[key].title.trim() !== "" && goals[key].task.trim() !== "",
  );
  const circleChosen = state.hasGroup || circleId !== null;

  const canAdvance =
    (step === 0 && name.trim() !== "") ||
    (step === 1 && goalsComplete) ||
    step === 2 ||
    step === 3 ||
    (step === 4 && circleChosen);

  const hint =
    step === 0
      ? "Tell us what to call you."
      : step === 1
        ? "Every realm needs a goal and its first task."
        : step === 4
          ? "Pick the council you’ll climb with."
          : "";

  const meta = [
    {
      eyebrow: "Welcome",
      title: name.trim() ? `Welcome, ${name.trim()}.` : "Enter Abundance 12",
      subtitle:
        "Let’s forge the system that scores whether you actually showed up.",
    },
    {
      eyebrow: "Your goals",
      title: "Set one goal in each realm",
      subtitle:
        "Three areas of a full life. Each one starts with a single task — add more later.",
    },
    {
      eyebrow: "Core tasks",
      title: "Your daily disciplines",
      subtitle:
        "These are non-negotiable. Thirty percent of your score is simply doing them, every day.",
    },
    {
      eyebrow: "First reckoning",
      title: "Log your first check-in",
      subtitle:
        "A minute of honesty a night. This is what keeps the streak — and the story — alive.",
    },
    {
      eyebrow: "Community",
      title: "Join a council",
      subtitle: "Legends are not made alone. Pick the council you’ll climb with.",
    },
  ][step];

  const nextLabel =
    step === 4 ? "Enter Abundance 12" : step === 0 ? "Begin" : "Continue";

  function goNext() {
    if (!canAdvance) {
      setShowHint(true);
      return;
    }
    setShowHint(false);
    setStep((current) => Math.min(STEP_COUNT - 1, current + 1));
  }

  function goBack() {
    setShowHint(false);
    setStep((current) => Math.max(0, current - 1));
  }

  function setGoal(key: GoalCategoryKey, patch: Partial<GoalDraft>) {
    setGoals((current) => ({
      ...current,
      [key]: { ...current[key], ...patch },
    }));
  }

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
      {/* TOP BAR */}
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
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
          </div>
          <div style={{ fontSize: 13, color: "var(--a12-muted)" }}>
            Step {step + 1} of {STEP_COUNT}
          </div>
        </div>
      </div>

      {/* PROGRESS */}
      <div
        style={{
          maxWidth: 760,
          width: "100%",
          margin: "0 auto",
          padding: "0 22px",
        }}
      >
        <div
          style={{
            height: 4,
            background: "var(--a12-panel)",
            borderRadius: 99,
            marginTop: 20,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${((step + 1) / STEP_COUNT) * 100}%`,
              background:
                "linear-gradient(90deg,var(--a12-gold-deep),var(--a12-gold-lit))",
              borderRadius: 99,
              transition: "width .35s ease",
            }}
          />
        </div>

        <ol
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 12,
            listStyle: "none",
            padding: 0,
          }}
        >
          {Array.from({ length: STEP_COUNT }, (_, index) => {
            const done = index < step;
            const current = index === step;
            return (
              <li
                key={index}
                aria-current={current ? "step" : undefined}
                style={{ display: "flex", justifyContent: "center", flex: 1 }}
              >
                <span
                  className="cz"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 700,
                    background: done
                      ? "var(--a12-gold)"
                      : current
                        ? "rgba(234,183,63,.14)"
                        : "var(--a12-panel)",
                    color: done
                      ? "var(--a12-ink)"
                      : current
                        ? "var(--a12-gold)"
                        : "var(--a12-muted-2)",
                    border: `1px solid ${
                      current ? "var(--a12-gold)" : "var(--a12-line)"
                    }`,
                  }}
                >
                  {done ? "✓" : index + 1}
                </span>
              </li>
            );
          })}
        </ol>
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
          key={step}
          className="a12-step-in"
          style={{
            width: "100%",
            maxWidth: 640,
            background: "var(--a12-panel)",
            border: "1px solid var(--a12-line)",
            borderRadius: 18,
            padding: "clamp(26px,4vw,44px)",
            boxShadow: "0 30px 70px rgba(0,0,0,.5)",
          }}
        >
          {/* Steps unmount as the wizard moves, so every answer is mirrored here. */}
          <input type="hidden" name="name" value={name} />
          {GOAL_CATEGORY_KEYS.map((key) => (
            <span key={key}>
              <input
                type="hidden"
                name={`goal:${key}:title`}
                value={goals[key].title}
              />
              <input
                type="hidden"
                name={`goal:${key}:task`}
                value={goals[key].task}
              />
            </span>
          ))}
          <input type="hidden" name="wins" value={wins} />
          <input type="hidden" name="circleId" value={circleId ?? ""} />
          {step !== 3 && <input type="hidden" name="mood" value={mood} />}

          <div
            style={{
              fontSize: 12,
              letterSpacing: ".16em",
              textTransform: "uppercase",
              color: "var(--a12-cyan)",
              marginBottom: 12,
            }}
          >
            {meta.eyebrow}
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
            {meta.title}
          </h1>
          <p
            style={{
              fontSize: 15,
              lineHeight: 1.55,
              color: "var(--a12-muted)",
              marginBottom: 28,
            }}
          >
            {meta.subtitle}
          </p>

          <div style={{ minHeight: 220 }}>
            {/* STEP 0 — WELCOME */}
            {step === 0 && (
              <div>
                <div style={{ marginBottom: 16 }}>
                  <label htmlFor="a12-name" style={labelStyle}>
                    What shall we call you, champion?
                  </label>
                  <input
                    id="a12-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="e.g. Maychell"
                    autoComplete="given-name"
                    style={fieldStyle}
                  />
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    marginTop: 8,
                    background: "var(--a12-bg)",
                    border: "1px solid var(--a12-line)",
                    borderRadius: 12,
                    padding: 16,
                  }}
                >
                  <span style={{ fontSize: 20 }} aria-hidden>
                    ⚔️
                  </span>
                  <p
                    style={{
                      fontSize: 13.5,
                      lineHeight: 1.5,
                      color: "var(--a12-muted)",
                    }}
                  >
                    Abundance 12 forges your goals, daily disciplines and
                    nightly reckonings into one honest score. Setup takes about
                    two minutes.
                  </p>
                </div>
              </div>
            )}

            {/* STEP 1 — GOALS. Each goal carries its first task: a goal's score
                IS the share of its tasks done, so one without work scores zero. */}
            {step === 1 && (
              <div>
                {state.categories.map((category) => (
                  <div key={category.key} style={{ marginBottom: 22 }}>
                    <label
                      htmlFor={`a12-goal-${category.key}`}
                      style={labelStyle}
                    >
                      {category.name}
                    </label>
                    <input
                      id={`a12-goal-${category.key}`}
                      value={goals[category.key].title}
                      onChange={(event) =>
                        setGoal(category.key, { title: event.target.value })
                      }
                      placeholder={PLACEHOLDERS[category.key].goal}
                      style={fieldStyle}
                    />
                    <label
                      htmlFor={`a12-task-${category.key}`}
                      style={{ ...labelStyle, marginTop: 10 }}
                    >
                      First task
                    </label>
                    <input
                      id={`a12-task-${category.key}`}
                      value={goals[category.key].task}
                      onChange={(event) =>
                        setGoal(category.key, { task: event.target.value })
                      }
                      placeholder={PLACEHOLDERS[category.key].task}
                      style={fieldStyle}
                    />
                  </div>
                ))}
                <p style={hintStyle}>
                  A goal is scored by the work inside it — so each one starts
                  with a single task. You can add more later.
                </p>
              </div>
            )}

            {/* STEP 2 — CORE TASKS. Organization-wide and identical for everyone:
                this is a commitment, not a menu, so nothing here toggles off. */}
            {step === 2 && (
              <div>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 10 }}
                >
                  {state.coreTasks.map((task) => (
                    <div
                      key={task.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        background: "#0f2233",
                        border: "1px solid #2a5c7a",
                        borderRadius: 11,
                        padding: "13px 15px",
                      }}
                    >
                      <span
                        aria-hidden
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 6,
                          flex: "none",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 12,
                          fontWeight: 800,
                          background: "var(--a12-cyan)",
                          color: "#08121f",
                        }}
                      >
                        ✓
                      </span>
                      <span style={{ fontSize: 15 }} aria-hidden>
                        {CORE_TASK_ICONS[task.key] ?? CORE_TASK_FALLBACK_ICON}
                      </span>
                      <span
                        style={{
                          fontSize: 14.5,
                          color: "var(--a12-text)",
                          fontWeight: 500,
                        }}
                      >
                        {task.name}
                      </span>
                    </div>
                  ))}
                </div>
                <p style={hintStyle}>
                  The same four for everyone in Abundance 12. There is nothing
                  to choose here — only to commit to.
                </p>
              </div>
            )}

            {/* STEP 3 — FIRST RECKONING */}
            {step === 3 && (
              <div>
                <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                  <legend style={{ ...labelStyle, marginBottom: 10 }}>
                    How was today?
                  </legend>
                  <div style={{ display: "flex", gap: 10, marginBottom: 22 }}>
                    {MOODS.map((face, index) => {
                      const value = index + 1;
                      const selected = mood === value;
                      return (
                        <label
                          key={value}
                          style={{
                            position: "relative",
                            flex: 1,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: selected
                              ? "rgba(234,183,63,.14)"
                              : "var(--a12-bg)",
                            border: `1px solid ${
                              selected ? "var(--a12-gold)" : "var(--a12-line)"
                            }`,
                            borderRadius: 12,
                            padding: "14px 0",
                            fontSize: 24,
                            cursor: "pointer",
                            outline:
                              focusedMood === value
                                ? "2px solid var(--a12-cyan)"
                                : "none",
                            outlineOffset: 2,
                          }}
                        >
                          <input
                            type="radio"
                            name="mood"
                            value={value}
                            checked={selected}
                            onChange={() => setMood(value)}
                            onFocus={() => setFocusedMood(value)}
                            onBlur={() => setFocusedMood(null)}
                            style={{
                              position: "absolute",
                              inset: 0,
                              margin: 0,
                              opacity: 0,
                              cursor: "pointer",
                            }}
                          />
                          <span aria-hidden>{face}</span>
                          <span
                            style={{
                              position: "absolute",
                              width: 1,
                              height: 1,
                              overflow: "hidden",
                              clipPath: "inset(50%)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {MOOD_LABELS[index]}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>

                <label htmlFor="a12-wins" style={labelStyle}>
                  Today’s victory
                </label>
                <textarea
                  id="a12-wins"
                  rows={3}
                  value={wins}
                  onChange={(event) => setWins(event.target.value)}
                  placeholder="One real sentence beats five polite ones…"
                  style={{ ...fieldStyle, resize: "vertical" }}
                />
              </div>
            )}

            {/* STEP 4 — CIRCLE. Self-join is offered only to someone no coach has
                placed yet; otherwise the circle is shown, not chosen. */}
            {step === 4 && (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                {state.hasGroup ? (
                  <>
                    {placedCircle ? (
                      <div
                        style={{
                          background: "#171d3f",
                          border: "1px solid var(--a12-gold)",
                          borderRadius: 13,
                          padding: "16px 18px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 14,
                        }}
                      >
                        <div>
                          <div
                            className="cz"
                            style={{
                              fontSize: 15.5,
                              fontWeight: 700,
                              marginBottom: 3,
                              color: "var(--a12-text)",
                            }}
                          >
                            {placedCircle.name}
                          </div>
                          {placedCircle.description && (
                            <div
                              style={{ fontSize: 13, color: "var(--a12-muted)" }}
                            >
                              {placedCircle.description}
                            </div>
                          )}
                          <div
                            style={{
                              fontSize: 12,
                              color: "var(--a12-muted-2)",
                              marginTop: 6,
                            }}
                          >
                            {placedCircle.coachName} · {placedCircle.memberCount}{" "}
                            members
                          </div>
                        </div>
                        <div
                          className="cz"
                          style={{
                            fontSize: 20,
                            fontWeight: 700,
                            color: "var(--a12-gold)",
                          }}
                        >
                          {placedCircle.averageScore}
                        </div>
                      </div>
                    ) : null}
                    <p style={hintStyle}>
                      Your coach has already placed you in this council — you are
                      in. Nothing to choose here.
                    </p>
                  </>
                ) : (
                  state.circles.map((circle) => {
                    const selected = circleId === circle.id;
                    return (
                      <label
                        key={circle.id}
                        style={{
                          position: "relative",
                          cursor: "pointer",
                          background: selected ? "#171d3f" : "var(--a12-bg)",
                          border: `1px solid ${
                            selected ? "var(--a12-gold)" : "var(--a12-line)"
                          }`,
                          borderRadius: 13,
                          padding: "16px 18px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 14,
                          outline:
                            focusedCircle === circle.id
                              ? "2px solid var(--a12-cyan)"
                              : "none",
                          outlineOffset: 2,
                        }}
                      >
                        <input
                          type="radio"
                          name="circleChoice"
                          value={circle.id}
                          checked={selected}
                          onChange={() => {
                            setCircleId(circle.id);
                            setShowHint(false);
                          }}
                          onFocus={() => setFocusedCircle(circle.id)}
                          onBlur={() => setFocusedCircle(null)}
                          style={{
                            position: "absolute",
                            inset: 0,
                            margin: 0,
                            opacity: 0,
                            cursor: "pointer",
                          }}
                        />
                        <span>
                          <span
                            className="cz"
                            style={{
                              display: "block",
                              fontSize: 15.5,
                              fontWeight: 700,
                              marginBottom: 3,
                              color: "var(--a12-text)",
                            }}
                          >
                            {circle.name}
                          </span>
                          {circle.description && (
                            <span
                              style={{
                                display: "block",
                                fontSize: 13,
                                color: "var(--a12-muted)",
                              }}
                            >
                              {circle.description}
                            </span>
                          )}
                          <span
                            style={{
                              display: "block",
                              fontSize: 12,
                              color: "var(--a12-muted-2)",
                              marginTop: 6,
                            }}
                          >
                            {circle.coachName} · {circle.memberCount} members
                          </span>
                        </span>
                        <span
                          className="cz"
                          style={{
                            fontSize: 20,
                            fontWeight: 700,
                            color: "var(--a12-gold)",
                          }}
                        >
                          {circle.averageScore}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {showHint && !canAdvance && hint && (
            <p style={{ ...hintStyle, color: "var(--a12-gold)" }}>{hint}</p>
          )}
          {formState.error && (
            <p role="alert" style={{ ...hintStyle, color: "var(--a12-rose)" }}>
              {formState.error}
            </p>
          )}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 32,
              gap: 12,
            }}
          >
            <button
              type="button"
              onClick={goBack}
              style={{
                background: "transparent",
                border: "1px solid var(--a12-line-2)",
                color: "var(--a12-muted)",
                fontWeight: 600,
                fontSize: 14.5,
                padding: "12px 20px",
                borderRadius: 11,
                cursor: "pointer",
                visibility: step === 0 ? "hidden" : "visible",
              }}
            >
              Back
            </button>

            {step === STEP_COUNT - 1 ? (
              <button
                type="submit"
                disabled={!canAdvance || isPending}
                className="a12-cta"
                style={{
                  border: "none",
                  fontWeight: 800,
                  fontSize: 14.5,
                  padding: "12px 28px",
                  borderRadius: 11,
                  cursor: isPending ? "progress" : "pointer",
                  opacity: !canAdvance || isPending ? 0.6 : 1,
                  boxShadow: "0 6px 18px rgba(217,155,44,.35)",
                }}
              >
                {isPending ? "Entering…" : nextLabel}
              </button>
            ) : (
              <button
                type="button"
                onClick={goNext}
                aria-disabled={!canAdvance}
                className="a12-cta"
                style={{
                  border: "none",
                  fontWeight: 800,
                  fontSize: 14.5,
                  padding: "12px 28px",
                  borderRadius: 11,
                  cursor: "pointer",
                  opacity: canAdvance ? 1 : 0.6,
                  boxShadow: "0 6px 18px rgba(217,155,44,.35)",
                }}
              >
                {nextLabel}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
