# GSAP Integration Spec (Planned)

Status: `planned`

This document reserves the animation architecture for GSAP in Glass Atlas. It is intentionally non-final and should be treated as a planning spec until implementation decisions are approved.

Related docs:

- [styleguide.md](styleguide.md)
- [bits-ui.md](bits-ui.md)
- [CONVENTIONS.md](CONVENTIONS.md)

---

## 1) Decision Locked

- GSAP is the selected animation engine for advanced motion in this project.
- We are not implementing full motion architecture yet.
- Current scope is to establish constraints and future implementation boundaries.

---

## 2) Planned Scope

GSAP will be evaluated for:

- Editorial hero transitions and staged reveals on landing surfaces.
- Asymmetric section choreography that cannot be expressed cleanly with CSS-only transitions.
- Scroll-coupled effects where sequencing precision is required.
- Advanced timeline control for layered UI moments.

Out of scope for initial adoption:

- Rewriting all micro-interactions in GSAP.
- Animation for every component by default.
- Motion-heavy behavior on admin productivity flows.

---

## 3) Guardrails

When GSAP implementation begins, it must preserve:

- Style guide constraints (flat depth, sharp geometry, restrained accent usage).
- Accessibility expectations (reduced motion support and readable content order).
- Performance and compositional clarity (no excessive timeline nesting for simple UI states).

Integration principles:

- Prefer CSS transitions for basic state changes.
- Use GSAP when sequencing, orchestration, or scroll control justifies runtime animation logic.
- Keep animations enhancement-first; content must remain usable without motion.

---

## 4) Open Items Before Build

- Exact motion taxonomy per surface (`landing`, `notes`, `chat`, `admin`).
- Trigger model (entry, hover, scroll, navigation transition).
- Reduced-motion policy details and fallback behavior.
- Shared timeline helpers/utilities and file organization.
- Performance budget and instrumentation approach.

---

## 5) Implementation Readiness Criteria

Before active GSAP build work:

- Convert this planned spec into a final implementation spec.
- Define approved animation primitives and tokenized timing/easing set.
- Add concrete code examples for Svelte 5 integration patterns.
- Add test and QA expectations for reduced-motion and regression checks.

