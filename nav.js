const nav = document.querySelector(".site-nav");
const toggle = document.querySelector(".nav-toggle");

if (nav && toggle) {
  toggle.addEventListener("click", () => {
    const next = !nav.classList.contains("is-open");
    nav.classList.toggle("is-open", next);
    toggle.setAttribute("aria-expanded", String(next));
  });
}
