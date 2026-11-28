import { useEffect, useRef, type CSSProperties, type ReactNode, type RefObject } from 'react'
import {
  ArrowsClockwiseIcon,
  BriefcaseIcon,
  CalendarBlankIcon,
  CircleIcon,
  FolderSimpleIcon,
  FootprintsIcon,
  LinkSimpleIcon,
  MagnifyingGlassIcon,
  NoteIcon,
  PlusIcon,
  TargetIcon,
  TimerIcon,
  WarningIcon,
} from '@phosphor-icons/react'

type Mode = 'login' | 'signup'

/**
 * Background distractions, out of focus around the wordmark (LOGIN.md).
 * Positions are percentages of the viewport; sizes scale with its width.
 * `drift` is how fast each one rises as you scroll; `blur` its resting blur.
 */
const WORDS: { text: string; drift: number; blur: number; style: CSSProperties }[] = [
  { text: 'Reorganize bookmarks', drift: 0.5, blur: 5, style: { left: '5.6%', top: '10.5%', fontSize: 'max(20px, 2.65vw)', fontStyle: 'italic', color: 'var(--color-neutral-600)' } },
  { text: 'Reply to Sam about dinner', drift: 0.25, blur: 0, style: { left: '36%', top: '6%', fontSize: 'max(15px, 1.72vw)', color: 'var(--color-neutral-600)' } },
  { text: 'Browse flights', drift: 0.7, blur: 7, style: { right: '7.5%', top: '13.75%', fontSize: 'max(24px, 3.1vw)', color: 'var(--color-neutral-500)' } },
  { text: 'Clean out the inbox', drift: 0.35, blur: 0, style: { left: '11.7%', top: '31%', fontSize: 'max(16px, 1.88vw)', color: 'var(--color-neutral-600)' } },
  { text: 'New video game?', drift: 0.45, blur: 3.5, style: { right: '9.4%', top: '36%', fontSize: 'max(17px, 2.03vw)', fontStyle: 'italic', color: 'var(--color-neutral-600)' } },
  { text: 'Rearrange the desk', drift: 0.8, blur: 8, style: { left: '3.75%', top: '59%', fontSize: 'max(26px, 3.44vw)', color: 'var(--color-neutral-500)' } },
  { text: 'Watch that documentary', drift: 0.3, blur: 0, style: { right: '5%', top: '62.5%', fontSize: 'max(15px, 1.72vw)', color: 'var(--color-neutral-600)' } },
  { text: 'Sort old photos', drift: 0.4, blur: 1, style: { left: '11%', bottom: '10%', fontSize: 'max(17px, 2.03vw)', fontStyle: 'italic', color: 'var(--color-neutral-600)' } },
  { text: 'Price new headphones', drift: 0.65, blur: 6, style: { right: '14%', bottom: '7.5%', fontSize: 'max(20px, 2.5vw)', color: 'var(--color-neutral-500)' } },
]

/** Fixed illustrative copy: shown before sign-in, so never the user's real goals. */
const SAMPLE_GOALS = ['Ship Focus v1', 'Run a half marathon', 'Build an emergency fund']

const GOAL_BARS = [
  { title: 'Ship Focus v1', pct: 62, delay: 500 },
  { title: 'Run a half marathon', pct: 40, delay: 750 },
  { title: 'Build an emergency fund', pct: 25, delay: 1000 },
]

const ALSO = [
  { icon: <TimerIcon aria-hidden />, title: 'Focus timer', text: 'Sits in the nav bar. 25 minutes unless you change it.' },
  { icon: <BriefcaseIcon aria-hidden />, title: 'Personal and Work', text: 'Separate goals, lists and settings for each workspace.' },
  { icon: <FolderSimpleIcon aria-hidden />, title: 'Projects and files', text: 'Tasks and attachments, grouped under a goal.' },
  { icon: <NoteIcon aria-hidden />, title: 'Notes', text: 'Plain writing space, searchable with everything else.' },
  { icon: <CalendarBlankIcon aria-hidden />, title: 'Calendar', text: 'Dated to-dos and deadlines by month.' },
  { icon: <MagnifyingGlassIcon aria-hidden />, title: 'Search with ⌘K', text: 'Find any goal, to-do, note or file, or add a new to-do.' },
]

const DIFFERENT = [
  { title: 'Goals come first', text: "You set what you're working toward before you write a single task. Lists stay in service of it." },
  { title: 'It says no for you', text: "A limit on active goals and a flag on to-dos that don't serve one. Taking on everything stops being the default." },
  { title: 'It helps you begin', text: 'When a to-do feels too big, Focus offers one small first step instead of another reminder.' },
]

/**
 * The public homepage (docs/design_handoff_focus_landing): the login splash
 * as the hero, then Why Focus, What's inside, What makes it different and a
 * closing sign-up. Every Log in / Sign up opens the auth panel.
 */
export default function Landing({ onAuth }: { onAuth: (mode: Mode) => void }) {
  const root = useRef<HTMLDivElement>(null)
  useLandingMotion(root)

  const cta = (mode: Mode, kind: 'primary' | 'secondary' | 'ghost', extra = '') => (
    <button type="button" className={`btn btn-${kind} ${extra}`} onClick={() => onAuth(mode)}>
      {mode === 'login' ? 'Log in' : 'Sign up'}
    </button>
  )

  return (
    <div className="landing" ref={root}>
      <header className="landing-nav" data-sticky>
        <span className="landing-nav-mark">Focus</span>
        <div className="landing-nav-actions">
          {cta('login', 'ghost', 'landing-nav-btn')}
          {cta('signup', 'primary', 'landing-nav-btn')}
        </div>
      </header>

      <main className="login" data-screen-label="Hero">
        <div className="login-words" aria-hidden="true">
          {WORDS.map((w) => (
            <span
              key={w.text}
              className="login-word"
              data-drift={w.drift}
              data-blur={w.blur}
              style={{ ...w.style, filter: w.blur ? `blur(${w.blur}px)` : undefined }}
            >
              {w.text}
            </span>
          ))}
        </div>
        <div className="login-center" data-hero>
          <h1 className="login-wordmark">Focus</h1>
          <div className="login-goals">
            {SAMPLE_GOALS.map((g) => (
              <span key={g} className="login-goal">
                <TargetIcon aria-hidden />
                {g}
              </span>
            ))}
          </div>
          <p className="login-tagline">A few goals at a time. Every project and to-do traces back to one.</p>
          <div className="login-buttons">
            {cta('login', 'primary', 'login-cta')}
            {cta('signup', 'secondary', 'login-cta')}
          </div>
        </div>
      </main>

      <section className="landing-why" data-screen-label="Purpose">
        <h6 className="landing-kicker" data-rv="up">
          Why Focus
        </h6>
        <h2 className="landing-why-title" data-rv="focus" data-d="100">
          Most to-do lists grow faster than the goals behind them.
        </h2>
        <p className="landing-why-body" data-rv="up" data-d="350">
          Focus starts from the other end. You name the few things you're working toward. Projects, to-dos and notes
          each point back to one of them, and anything that doesn't gets flagged.
        </p>
      </section>

      <section className="landing-features" data-screen-label="Features">
        <div className="landing-heading">
          <h6 className="landing-kicker" data-rv="up">
            What's inside
          </h6>
          <h2 className="landing-h2" data-rv="up" data-d="100">
            Three habits, built in.
          </h2>
        </div>

        <Feature
          icon={<TargetIcon aria-hidden />}
          title="A cap on active goals"
          text="Choose how many goals can be active at once. Three is the default. A new goal waits until there's room."
        >
          <div className="card elev-sm landing-card landing-card-goals" data-rv="card" data-d="150" aria-hidden="true">
            <div className="landing-card-head">
              <span className="landing-card-label">Goals</span>
              <span className="landing-card-count" data-rv="fade" data-d="1500">
                3 of 3 active
              </span>
            </div>
            {GOAL_BARS.map((g) => (
              <div key={g.title} className="landing-goal">
                <div className="landing-goal-row">
                  <span className="landing-goal-title">{g.title}</span>
                  <span className="landing-goal-pct">{g.pct}%</span>
                </div>
                <div className="landing-bar">
                  <div
                    className="landing-bar-fill"
                    data-rv="bar"
                    data-w={`${g.pct}%`}
                    data-d={g.delay}
                    style={{ width: `${g.pct}%` }}
                  />
                </div>
              </div>
            ))}
            <div className="landing-goal-add" data-rv="up" data-d="1700">
              <span className="btn btn-secondary landing-mini-btn is-disabled">
                <PlusIcon />
                Add goal
              </span>
              Finish or pause one to make room.
            </div>
          </div>
        </Feature>

        <Feature
          icon={<LinkSimpleIcon aria-hidden />}
          title="Every to-do checked"
          text="Each new to-do is matched to the goal or project it serves. Anything that doesn’t fit gets flagged, so you can relink it or let it go."
        >
          <div className="card elev-sm landing-card landing-card-todos" data-rv="card" data-d="150" aria-hidden="true">
            <span className="landing-card-label">To-dos</span>
            <div className="landing-todo">
              <CircleIcon className="landing-todo-icon" />
              <span className="landing-todo-title">Easy 5 km run</span>
              <span className="tag tag-accent landing-tag" data-rv="pop" data-d="650">
                <TargetIcon />
                Run a half marathon
              </span>
            </div>
            <div className="landing-todo">
              <CircleIcon className="landing-todo-icon" />
              <span className="landing-todo-title">Transfer $20 to savings</span>
              <span className="tag tag-accent landing-tag" data-rv="pop" data-d="950">
                <TargetIcon />
                Build an emergency fund
              </span>
            </div>
            <div className="landing-todo-flagged">
              <div className="landing-todo is-plain">
                <CircleIcon className="landing-todo-icon" />
                <span className="landing-todo-title is-blurred" data-rv="blur" data-d="1450">
                  Research a new video game to play
                </span>
              </div>
              <span className="landing-flag" data-rv="up" data-d="1800">
                <WarningIcon />
                Doesn't relate to any active goal.
              </span>
            </div>
          </div>
        </Feature>

        <Feature
          icon={<FootprintsIcon aria-hidden />}
          title="Help me start"
          text="Stuck on a to-do? Get a small first step you can add to the list."
        >
          <div className="card elev-sm landing-card landing-card-hint" data-rv="card" data-d="150" aria-hidden="true">
            <div className="landing-todo is-plain">
              <CircleIcon className="landing-todo-icon" />
              <span className="landing-todo-title">Plan the Japan trip</span>
              <span className="btn btn-ghost btn-icon landing-hint-btn" data-rv="pop" data-d="600">
                <FootprintsIcon />
              </span>
            </div>
            <div className="landing-hint" data-rv="slide" data-d="950">
              <FootprintsIcon className="landing-hint-icon" />
              <div className="landing-hint-main">
                <div className="landing-hint-text">
                  <span className="landing-hint-kicker">Start here</span>
                  <p>Open a note and list three cities you want to see.</p>
                </div>
                <div className="landing-hint-actions">
                  <span className="btn btn-secondary landing-mini-btn">
                    <PlusIcon />
                    Add as to-do
                  </span>
                  <span className="btn btn-ghost landing-mini-btn is-ghost">
                    <ArrowsClockwiseIcon />
                    Another idea
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Feature>

        <div className="landing-also">
          <h4 className="landing-also-title" data-rv="up">
            Also in Focus
          </h4>
          <div className="landing-also-grid">
            {ALSO.map((a, i) => (
              <div key={a.title} className="landing-also-item" data-rv="up" data-d={i * 60}>
                <span className="landing-also-name">
                  {a.icon}
                  {a.title}
                </span>
                <span className="landing-also-text">{a.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-different" data-screen-label="Different">
        <div className="landing-heading">
          <h6 className="landing-kicker" data-rv="up">
            What makes it different
          </h6>
          <h2 className="landing-h2 landing-different-title" data-rv="up" data-d="100">
            Most apps help you add more. Focus helps you choose.
          </h2>
        </div>
        <div className="landing-different-grid">
          {DIFFERENT.map((d, i) => (
            <div key={d.title} className="landing-different-col" data-rv="up" data-d={i * 180}>
              <span className="landing-numeral">{i + 1}</span>
              <h4>{d.title}</h4>
              <p>{d.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-close" data-screen-label="Close">
        <h2 className="landing-close-title" data-rv="focus">
          Pick your three.
        </h2>
        <p className="landing-close-line" data-rv="up" data-d="300">
          Start with one goal. Add the rest when you need them.
        </p>
        <div className="landing-close-actions" data-rv="up" data-d="450">
          {cta('signup', 'primary', 'login-cta')}
          {cta('login', 'secondary', 'login-cta')}
        </div>
      </section>

      <footer className="landing-footer">
        <span className="landing-footer-mark">Focus</span>
        <span>© 2026</span>
      </footer>
    </div>
  )
}

function Feature({
  icon,
  title,
  text,
  children,
}: {
  icon: ReactNode
  title: string
  text: string
  children: ReactNode
}) {
  return (
    <div className="landing-feature">
      <div className="landing-feature-text">
        <span className="landing-feature-icon" data-rv="up">
          {icon}
        </span>
        <h3 data-rv="up" data-d="80">
          {title}
        </h3>
        <p data-rv="up" data-d="160">
          {text}
        </p>
      </div>
      {children}
    </div>
  )
}

// — motion (README "Motion") —

const EASE = 'cubic-bezier(.2,.7,.2,1)'
type Styles = Partial<Record<'opacity' | 'transform' | 'filter' | 'width', string>>
const FROM: Record<string, Styles> = {
  up: { opacity: '0', transform: 'translateY(28px)' },
  card: { opacity: '0', transform: 'translateY(56px) scale(0.98)' },
  focus: { opacity: '0.2', filter: 'blur(10px)' },
  fade: { opacity: '0' },
  pop: { opacity: '0', transform: 'scale(0.8)' },
  slide: { opacity: '0', transform: 'translateY(-12px)' },
  blur: { opacity: '1', filter: 'blur(0px)' },
  bar: { width: '0%' },
}
const TO: Record<string, Styles> = {
  up: { opacity: '1', transform: 'none' },
  card: { opacity: '1', transform: 'none' },
  focus: { opacity: '1', filter: 'blur(0px)' },
  fade: { opacity: '1' },
  pop: { opacity: '1', transform: 'none' },
  slide: { opacity: '1', transform: 'none' },
  blur: { opacity: '0.7', filter: 'blur(1.5px)' },
}

/**
 * Reveals (once, as each element enters; a card triggers all of its
 * children together), the hero's scroll parallax and the sticky nav. The
 * markup's own styles are the end states, so nothing stays hidden without
 * JS; reduced motion skips straight to them.
 */
function useLandingMotion(root: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = root.current
    if (!el) return
    const motion = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const reveals = Array.from(el.querySelectorAll<HTMLElement>('[data-rv]'))
    const words = Array.from(el.querySelectorAll<HTMLElement>('[data-drift]'))
    const hero = el.querySelector<HTMLElement>('[data-hero]')
    const nav = el.querySelector<HTMLElement>('[data-sticky]')

    const show = (node: HTMLElement) => {
      const type = node.dataset.rv ?? ''
      const delay = Number(node.dataset.d ?? 0)
      node.style.transition = ['opacity 800ms', 'transform 800ms', 'filter 1000ms', 'width 1300ms']
        .map((p) => `${p} ${EASE} ${delay}ms`)
        .join(', ')
      if (type === 'bar') node.style.width = node.dataset.w ?? ''
      else Object.assign(node.style, TO[type] ?? {})
    }

    let io: IntersectionObserver | undefined
    if (motion) {
      for (const node of reveals) {
        node.style.transition = 'none'
        Object.assign(node.style, FROM[node.dataset.rv ?? ''] ?? {})
      }
      io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue
            const target = entry.target as HTMLElement
            const card = target.closest<HTMLElement>('[data-rv="card"]')
            // Inside a card: the card itself starts them all.
            if (card && card !== target) continue
            const group =
              target.dataset.rv === 'card'
                ? [target, ...target.querySelectorAll<HTMLElement>('[data-rv]')]
                : [target]
            for (const node of group) {
              show(node)
              io?.unobserve(node)
            }
          }
        },
        { threshold: 0.2, rootMargin: '0px 0px -10% 0px' }
      )
      for (const node of reveals) io.observe(node)
    }

    let raf = 0
    const tick = () => {
      raf = 0
      const y = window.scrollY
      const h = window.innerHeight || 800
      if (motion) {
        for (const w of words) {
          w.style.transform = `translateY(${-y * Number(w.dataset.drift)}px)`
          w.style.filter = `blur(${Number(w.dataset.blur) + y / 45}px)`
          w.style.opacity = String(Math.max(0, 1 - y / (h * 0.7)))
        }
        if (hero) {
          hero.style.transform = `translateY(${y * 0.2}px)`
          hero.style.opacity = String(Math.max(0, 1 - y / (h * 0.85)))
        }
      }
      nav?.classList.toggle('is-shown', y > h * 0.8)
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(tick)
    }
    tick()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      io?.disconnect()
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [root])
}
