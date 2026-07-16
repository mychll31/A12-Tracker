import { getCurrentUser } from "@/lib/auth";

import { HeroVideo } from "./hero-video";

const SYSTEM_STEPS = [
  {
    n: "I",
    title: "Forge your goals",
    desc: "Three realms — Personal, Professional, Contribution. Break each into tasks that move the score.",
  },
  {
    n: "II",
    title: "Keep the core",
    desc: "Your daily disciplines. Thirty percent of your Overall is simply showing up, every day.",
  },
  {
    n: "III",
    title: "Reckon nightly",
    desc: "Wins, challenges, gratitude, mood. A minute of honesty that keeps the streak alive.",
  },
  {
    n: "IV",
    title: "Climb the ranks",
    desc: "One number that can’t be faked. Rise on the leaderboard and unlock what you earn.",
  },
];

const STATS = [
  { value: "3", label: "realms of life", color: "var(--a12-gold)" },
  { value: "4", label: "daily disciplines", color: "var(--a12-cyan)" },
  { value: "60+", label: "day streaks", color: "var(--a12-gold)" },
  { value: "1", label: "honest score", color: "var(--a12-cyan)" },
];

/**
 * Marketing copy, not records. These three are real seeded users, but this page
 * is public — it must never reach for the database to say their names.
 */
const MENTEES = [
  {
    initials: "PN",
    name: "Priya Nadkarni",
    streak: 60,
    tasks: "93%",
    score: "75.3",
    scoreColor: "var(--a12-cyan)",
    avatar: "linear-gradient(135deg,#f0607a,#8b6cff)",
  },
  {
    initials: "MD",
    name: "Marcus Delgado",
    streak: 4,
    tasks: "43%",
    score: "52.3",
    scoreColor: "var(--a12-gold)",
    avatar: "linear-gradient(135deg,#5ee6a8,#58c8ff)",
  },
  {
    initials: "JW",
    name: "Jonah Whitfield",
    streak: 4,
    tasks: "71%",
    score: "43.5",
    scoreColor: "var(--a12-gold)",
    avatar: "linear-gradient(135deg,#8b6cff,#58c8ff)",
  },
];

const COACHING_BULLETS = [
  "Needs-attention alerts before someone slips",
  "Coaching notes, shared or sealed",
  "Follow-ups you swore to return to",
];

const SCORE_TILES = [
  { label: "Personal", value: "100", color: "var(--a12-green)" },
  { label: "Professional", value: "33.3", color: "var(--a12-gold)" },
  { label: "Contribution", value: "25", color: "var(--a12-rose)" },
];

/** One missed day in an otherwise unbroken run — the point the copy is making. */
const STREAK_SQUARES = Array.from({ length: 42 }, (_, i) =>
  i === 20 ? "var(--a12-line)" : "var(--a12-green)",
);

const cardStyle: React.CSSProperties = {
  background: "var(--a12-panel)",
  border: "1px solid var(--a12-line)",
  borderRadius: 16,
  padding: 30,
};

export default async function LandingPage() {
  const user = await getCurrentUser();
  const signedIn = user !== null;

  const arenaHref = signedIn ? "/dashboard" : "/register";
  const finalCtaHref = signedIn ? "/dashboard" : "/register";
  const finalCtaLabel = signedIn
    ? "Back to your dashboard"
    : "Create your account";

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(1200px 700px at 78% -8%, rgba(47,73,201,.18), transparent 60%), radial-gradient(900px 600px at 5% 20%, rgba(88,200,255,.08), transparent 55%), var(--a12-bg)",
      }}
    >
      {/* NAV */}
      <nav
        style={{
          position: "relative",
          zIndex: 5,
          maxWidth: 1220,
          margin: "0 auto",
          padding: "20px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
          <div className="a12-orb" style={{ width: 40, height: 40 }} />
          <div style={{ lineHeight: 1 }}>
            <div
              className="cz"
              style={{
                fontWeight: 700,
                fontSize: 18,
                letterSpacing: ".06em",
                color: "var(--a12-text)",
              }}
            >
              ABUNDANCE 12
            </div>
            <div
              style={{
                fontSize: 10.5,
                letterSpacing: ".34em",
                color: "var(--a12-gold)",
                marginTop: 3,
              }}
            >
              THE GAME OF MY LIFE
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 26,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 26,
              fontSize: 14,
              color: "var(--a12-muted)",
            }}
          >
            <a href="#how" style={{ color: "var(--a12-muted)" }}>
              The System
            </a>
            <a href="#features" style={{ color: "var(--a12-muted)" }}>
              Arsenal
            </a>
            <a href="#coaching" style={{ color: "var(--a12-muted)" }}>
              Coaching
            </a>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {!signedIn && (
              <a
                href="/login"
                style={{ fontSize: 14, color: "var(--a12-text)" }}
              >
                Sign in
              </a>
            )}
            <a
              className="a12-cta"
              href={arenaHref}
              style={{
                fontWeight: 700,
                fontSize: 14,
                padding: "9px 17px",
                borderRadius: 9,
                boxShadow: "0 4px 14px rgba(217,155,44,.35)",
              }}
            >
              Enter the arena
            </a>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <header
        style={{
          position: "relative",
          maxWidth: 1320,
          margin: "0 auto",
          padding: "clamp(24px,4vw,40px) 24px 0",
        }}
      >
        <HeroVideo
          cta={
            <a
              className="a12-cta a12-pulse"
              href={arenaHref}
              style={{
                fontWeight: 800,
                fontSize: 15.5,
                padding: "15px 30px",
                borderRadius: 12,
              }}
            >
              Begin your ascent
            </a>
          }
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 9,
              padding: "6px 13px",
              border: "1px solid rgba(88,200,255,.4)",
              borderRadius: 999,
              background: "rgba(11,26,51,.55)",
              backdropFilter: "blur(6px)",
              fontSize: 12,
              letterSpacing: ".16em",
              color: "var(--a12-cyan-lit)",
              marginBottom: 18,
            }}
          >
            WHERE LEGENDS ARE MADE
          </div>
          <h1
            className="cz a12-gold-text"
            style={{
              fontSize: "clamp(34px,6vw,68px)",
              lineHeight: 1,
              fontWeight: 800,
              letterSpacing: ".01em",
              marginBottom: 16,
              textShadow: "0 2px 30px rgba(234,183,63,.25)",
            }}
          >
            THE GAME
            <br />
            OF MY LIFE
          </h1>
          <p
            style={{
              fontSize: "clamp(15px,2.2vw,19px)",
              lineHeight: 1.55,
              color: "#d9ddec",
              maxWidth: 520,
              marginBottom: 26,
            }}
          >
            Your goals, your daily disciplines, your nightly reckoning — forged
            into one score that proves you showed up. This is Abundance 12.
          </p>
        </HeroVideo>

        {/* STATS STRIP */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 16,
            justifyContent: "center",
            marginTop: 26,
          }}
        >
          {STATS.map((stat) => (
            <div
              key={stat.label}
              style={{
                flex: "1 1 150px",
                textAlign: "center",
                padding: 16,
                background: "var(--a12-panel)",
                border: "1px solid var(--a12-line)",
                borderRadius: 14,
              }}
            >
              <div
                className="cz"
                style={{ fontSize: 26, fontWeight: 700, color: stat.color }}
              >
                {stat.value}
              </div>
              <div style={{ fontSize: 12.5, color: "var(--a12-muted)" }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </header>

      {/* THE SYSTEM */}
      <section
        id="how"
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "clamp(56px,7vw,96px) 24px",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 52 }}>
          <div
            style={{
              fontSize: 12.5,
              letterSpacing: ".18em",
              textTransform: "uppercase",
              color: "var(--a12-cyan)",
              marginBottom: 14,
            }}
          >
            The System
          </div>
          <h2
            className="cz"
            style={{
              fontSize: "clamp(28px,4vw,42px)",
              fontWeight: 700,
              letterSpacing: ".02em",
              color: "var(--a12-text)",
            }}
          >
            Four moves. Every single day.
          </h2>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))",
            gap: 18,
          }}
        >
          {SYSTEM_STEPS.map((step) => (
            <div
              key={step.n}
              style={{
                background: "var(--a12-panel)",
                border: "1px solid var(--a12-line)",
                borderRadius: 15,
                padding: 26,
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                className="cz"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 11,
                  background: "rgba(234,183,63,.12)",
                  color: "var(--a12-gold)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: 19,
                  marginBottom: 16,
                  border: "1px solid rgba(234,183,63,.3)",
                }}
              >
                {step.n}
              </div>
              <h3
                style={{
                  fontSize: 17.5,
                  fontWeight: 700,
                  marginBottom: 8,
                  color: "var(--a12-text)",
                }}
              >
                {step.title}
              </h3>
              <p
                style={{
                  fontSize: 14,
                  lineHeight: 1.55,
                  color: "var(--a12-muted)",
                }}
              >
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ARSENAL */}
      <section
        id="features"
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "clamp(10px,3vw,30px) 24px clamp(56px,7vw,96px)",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))",
            gap: 18,
          }}
        >
          <div
            className="a12-wide"
            style={{
              background:
                "linear-gradient(160deg,var(--a12-panel-2),var(--a12-panel))",
              border: "1px solid var(--a12-line-2)",
              borderRadius: 16,
              padding: 30,
            }}
          >
            <h3
              className="cz"
              style={{
                fontSize: 22,
                fontWeight: 700,
                marginBottom: 10,
                color: "var(--a12-text)",
                letterSpacing: ".01em",
              }}
            >
              Your Total Score
            </h3>
            <p
              style={{
                fontSize: 14.5,
                lineHeight: 1.55,
                color: "var(--a12-muted)",
                maxWidth: 520,
                marginBottom: 22,
              }}
            >
              Three realms combined — half of your Overall. See which part of
              your life is carrying you, and which one is quietly slipping into
              shadow.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {SCORE_TILES.map((tile) => (
                <div
                  key={tile.label}
                  style={{
                    flex: "1 1 130px",
                    background: "var(--a12-bg)",
                    border: "1px solid var(--a12-line)",
                    borderRadius: 11,
                    padding: 14,
                  }}
                >
                  <div style={{ fontSize: 12, color: "var(--a12-muted)" }}>
                    {tile.label}
                  </div>
                  <div
                    className="cz"
                    style={{ fontSize: 22, fontWeight: 700, color: tile.color }}
                  >
                    {tile.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={cardStyle}>
            <div style={{ fontSize: 24, marginBottom: 14 }} aria-hidden>
              🏆
            </div>
            <h3
              className="cz"
              style={{
                fontSize: 19,
                fontWeight: 700,
                marginBottom: 10,
                color: "var(--a12-text)",
              }}
            >
              Leaderboards
            </h3>
            <p
              style={{
                fontSize: 14,
                lineHeight: 1.55,
                color: "var(--a12-muted)",
              }}
            >
              See where you stand — and who you are climbing toward. Ranked by
              score, tasks, consistency and circle.
            </p>
          </div>

          <div style={cardStyle}>
            <div style={{ fontSize: 24, marginBottom: 14 }} aria-hidden>
              🎖️
            </div>
            <h3
              className="cz"
              style={{
                fontSize: 19,
                fontWeight: 700,
                marginBottom: 10,
                color: "var(--a12-text)",
              }}
            >
              Achievements
            </h3>
            <p
              style={{
                fontSize: 14,
                lineHeight: 1.55,
                color: "var(--a12-muted)",
              }}
            >
              First Flame. Thirty Days Strong. Unbroken. Every badge is earned
              in battle, never given.
            </p>
          </div>

          <div className="a12-wide" style={cardStyle}>
            <h3
              className="cz"
              style={{
                fontSize: 19,
                fontWeight: 700,
                marginBottom: 10,
                color: "var(--a12-text)",
              }}
            >
              The streak grid
            </h3>
            <p
              style={{
                fontSize: 14,
                lineHeight: 1.55,
                color: "var(--a12-muted)",
                maxWidth: 520,
              }}
            >
              A filled square is a day you showed up. Sixty of them tell a story
              no goal-setting app ever could.
            </p>
            <div
              aria-hidden
              style={{
                display: "flex",
                gap: 5,
                flexWrap: "wrap",
                marginTop: 18,
              }}
            >
              {STREAK_SQUARES.map((color, index) => (
                <div
                  key={index}
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 4,
                    background: color,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* COACHING */}
      <section
        id="coaching"
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "0 24px clamp(56px,7vw,96px)",
        }}
      >
        <div
          style={{
            background: "linear-gradient(150deg,var(--a12-panel-2),#0b1026)",
            border: "1px solid var(--a12-line-2)",
            borderRadius: 20,
            padding: "clamp(28px,4vw,52px)",
            display: "flex",
            flexWrap: "wrap",
            gap: 40,
            alignItems: "center",
          }}
        >
          <div style={{ flex: "1 1 340px", minWidth: 0 }}>
            <div
              style={{
                fontSize: 12.5,
                letterSpacing: ".16em",
                textTransform: "uppercase",
                color: "var(--a12-cyan)",
                marginBottom: 14,
              }}
            >
              Coaching, built in
            </div>
            <h2
              className="cz"
              style={{
                fontSize: "clamp(24px,3.4vw,36px)",
                fontWeight: 700,
                letterSpacing: ".01em",
                marginBottom: 16,
                color: "var(--a12-text)",
              }}
            >
              A guide who sees your Tuesdays, not just your triumphs.
            </h2>
            <p
              style={{
                fontSize: 15,
                lineHeight: 1.6,
                color: "var(--a12-muted)",
                marginBottom: 24,
              }}
            >
              Coaches command a live view of every mentee: who is on track, who
              has gone quiet, and who needs them first. Shared notes,
              follow-ups, and honest counsel — right where the work happens.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {COACHING_BULLETS.map((bullet) => (
                <div
                  key={bullet}
                  style={{ display: "flex", gap: 10, alignItems: "flex-start" }}
                >
                  <span style={{ color: "var(--a12-gold)" }} aria-hidden>
                    ◆
                  </span>
                  <span style={{ fontSize: 14.5, color: "var(--a12-text-2)" }}>
                    {bullet}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              flex: "1 1 320px",
              minWidth: 0,
              background: "var(--a12-bg)",
              border: "1px solid var(--a12-line)",
              borderRadius: 14,
              padding: 22,
            }}
          >
            <div
              style={{
                fontSize: 13,
                color: "var(--a12-muted)",
                marginBottom: 16,
              }}
            >
              Your mentees · strongest first
            </div>
            {MENTEES.map((mentee) => (
              <div
                key={mentee.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 0",
                  borderBottom: "1px solid var(--a12-hairline)",
                }}
              >
                <div
                  aria-hidden
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    background: mentee.avatar,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#fff",
                    flex: "none",
                  }}
                >
                  {mentee.initials}
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "var(--a12-text)",
                    }}
                  >
                    {mentee.name}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--a12-muted)" }}>
                    🔥 {mentee.streak} · {mentee.tasks} tasks
                  </div>
                </div>
                <div
                  className="cz"
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: mentee.scoreColor,
                  }}
                >
                  {mentee.score}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section
        id="cta"
        style={{
          maxWidth: 1000,
          margin: "0 auto",
          padding: "clamp(20px,4vw,40px) 24px clamp(80px,10vw,120px)",
          textAlign: "center",
        }}
      >
        <div
          className="a12-orb"
          style={{ width: 54, height: 54, margin: "0 auto 24px" }}
        />
        <h2
          className="cz a12-gold-text"
          style={{
            fontSize: "clamp(30px,5vw,54px)",
            fontWeight: 800,
            letterSpacing: ".02em",
            marginBottom: 18,
          }}
        >
          STOP SETTING GOALS.
          <br />
          START KEEPING SCORE.
        </h2>
        <p
          style={{
            fontSize: "clamp(15px,2vw,18px)",
            color: "var(--a12-muted)",
            maxWidth: 520,
            margin: "0 auto 32px",
          }}
        >
          Enter Abundance 12 and let one honest number prove the days you showed
          up.
        </p>
        <a
          className="a12-cta"
          href={finalCtaHref}
          style={{
            display: "inline-block",
            fontWeight: 800,
            fontSize: 16,
            padding: "16px 36px",
            borderRadius: 12,
            boxShadow: "0 8px 26px rgba(217,155,44,.4)",
          }}
        >
          {finalCtaLabel}
        </a>
        <div
          style={{ fontSize: 13, color: "var(--a12-muted-2)", marginTop: 16 }}
        >
          Free to start · No credit card
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: "1px solid var(--a12-hairline)" }}>
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "28px 24px",
            display: "flex",
            flexWrap: "wrap",
            gap: 16,
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <div className="a12-orb" style={{ width: 30, height: 30 }} />
            <span
              className="cz"
              style={{
                fontWeight: 700,
                fontSize: 14,
                letterSpacing: ".05em",
                color: "var(--a12-text)",
              }}
            >
              ABUNDANCE 12
            </span>
          </div>
          <div style={{ fontSize: 13, color: "var(--a12-muted-2)" }}>
            © 2026 · The Game of My Life · Where legends are made
          </div>
        </div>
      </footer>
    </div>
  );
}
