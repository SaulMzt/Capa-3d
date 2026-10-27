const modal = document.getElementById("join-modal");
const openModalButton = document.querySelector("[data-open-modal]");
const closeModalButtons = document.querySelectorAll("[data-close-modal]");
const counters = document.querySelectorAll("[data-count]");
const revealItems = document.querySelectorAll(".reveal");
const parallaxTarget = document.querySelector("[data-parallax]");
const heroCopy = document.querySelector(".hero-copy");

const maintenanceBypassPages = ["maintenance.html", "login.html", "dashboard.html"];
const currentPage = window.location.pathname.split("/").pop() || "index.html";

if (!maintenanceBypassPages.includes(currentPage)) {
  fetch("api.php?action=maintenance_state", { cache: "no-store", credentials: "same-origin" })
    .then((response) => response.ok ? response.json() : Promise.reject())
    .then((data) => {
      if (data.maintenance && data.maintenance.enabled) window.location.href = "maintenance.html";
    })
    .catch(() => {});
}

const formatCounter = (value) => new Intl.NumberFormat("es-MX").format(value);

const openModal = () => {
  if (!modal) return;
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
};

const closeModal = () => {
  if (!modal) return;
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
};

if (openModalButton) {
  openModalButton.addEventListener("click", openModal);
}

closeModalButtons.forEach((button) => button.addEventListener("click", closeModal));

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && modal && modal.classList.contains("is-open")) {
    closeModal();
  }
});

const animateCounter = (element) => {
  if (element.dataset.counted) return;

  const target = Number(element.dataset.count);
  const duration = 1500;
  const start = performance.now();

  const tick = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    element.textContent = formatCounter(Math.round(target * eased));

    if (progress < 1) {
      requestAnimationFrame(tick);
    }
  };

  element.dataset.counted = "true";
  requestAnimationFrame(tick);
};

if ("IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");

        if (entry.target.classList.contains("hero-copy")) {
          counters.forEach(animateCounter);
        }

        revealObserver.unobserve(entry.target);
      });
    },
    { threshold: 0.16 }
  );

  revealItems.forEach((item, index) => {
    item.style.transitionDelay = `${Math.min(index * 55, 360)}ms`;
    revealObserver.observe(item);
  });
} else {
  revealItems.forEach((item) => item.classList.add("is-visible"));
  counters.forEach(animateCounter);
}

const moveParallax = () => {
  if (!parallaxTarget) return;
  const hero = document.querySelector(".hero");
  const heroHeight = hero ? hero.offsetHeight : 0;
  const progress = Math.min(window.scrollY / Math.max(heroHeight, 1), 1);
  const y = window.scrollY * 0.025;
  if (heroCopy) heroCopy.style.opacity = String(1 - progress * 0.72);
  parallaxTarget.style.opacity = String(1 - progress * 0.55);
  parallaxTarget.style.transform = `translate3d(0, ${y}px, 0)`;
};

window.addEventListener("scroll", moveParallax, { passive: true });

const canvas = document.getElementById("particles");
const ctx = canvas ? canvas.getContext("2d") : null;
let particles = [];
let animationFrame;

const resizeCanvas = () => {
  if (!canvas || !ctx) return;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(window.innerWidth * ratio);
  canvas.height = Math.floor(window.innerHeight * ratio);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  const particleCount = Math.max(34, Math.min(78, Math.floor(window.innerWidth / 18)));
  particles = Array.from({ length: particleCount }, () => ({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    r: Math.random() * 1.8 + 0.7,
    vx: (Math.random() - 0.5) * 0.22,
    vy: (Math.random() - 0.5) * 0.22,
    a: Math.random() * 0.45 + 0.2
  }));
};

const drawParticles = () => {
  if (!canvas || !ctx) return;
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

  particles.forEach((particle, index) => {
    particle.x += particle.vx;
    particle.y += particle.vy;

    if (particle.x < -10) particle.x = window.innerWidth + 10;
    if (particle.x > window.innerWidth + 10) particle.x = -10;
    if (particle.y < -10) particle.y = window.innerHeight + 10;
    if (particle.y > window.innerHeight + 10) particle.y = -10;

    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(39, 197, 104, ${particle.a})`;
    ctx.fill();

    for (let next = index + 1; next < particles.length; next += 1) {
      const other = particles[next];
      const distance = Math.hypot(particle.x - other.x, particle.y - other.y);

      if (distance < 120) {
        ctx.beginPath();
        ctx.moveTo(particle.x, particle.y);
        ctx.lineTo(other.x, other.y);
        ctx.strokeStyle = `rgba(255, 255, 255, ${(1 - distance / 120) * 0.08})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  });

  animationFrame = requestAnimationFrame(drawParticles);
};

resizeCanvas();
drawParticles();

window.addEventListener("resize", () => {
  cancelAnimationFrame(animationFrame);
  resizeCanvas();
  drawParticles();
});
