// Replace these demo URLs once and every matching button updates automatically.
const BUSINESS_LINKS = {
  instagram: "https://www.instagram.com/showydreamhome/",
  facebook: "https://www.facebook.com/showy.dreamhome.5",
  youtube: "https://www.youtube.com/@ShowyDreamhomeSolution",
  reviews: "https://www.google.com/maps/place/Showy+Dream+Home+Solutions/@13.2319665,77.687969,15z/data=!4m8!3m7!1s0x3bae1d8aea4629d1:0xd2fbf9124e42f1a0!8m2!3d13.2329965!4d77.6953447!9m1!1b1!16s%2Fg%2F11fmd6565c?entry=ttu&g_ep=EgoyMDI2MDYxMy4wIKXMDSoASAFQAw%3D%3D",
  website: "https://showydreamhome.com/",
  whatsapp: "https://wa.me/919740925180",
  phone: "tel:+91 97409 25180",
  office: "https://maps.app.goo.gl/mBZkdHJLZuXtGBaH7",
  experience: "https://maps.app.goo.gl/XgGoyFMv5C8L2zz47"
};

document.querySelectorAll("[data-link]").forEach((element) => {
  element.href = BUSINESS_LINKS[element.dataset.link];
});

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("visible");
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll(".reveal").forEach((item, index) => {
  item.style.transitionDelay = `${Math.min(index % 4, 3) * 70}ms`;
  observer.observe(item);
});

const countObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    const target = entry.target;
    const end = Number(target.dataset.count);
    const decimal = !Number.isInteger(end);
    const started = performance.now();
    const tick = (now) => {
      const progress = Math.min((now - started) / 1100, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      target.textContent = decimal ? (end * eased).toFixed(1) : Math.round(end * eased);
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    countObserver.unobserve(target);
  });
}, { threshold: 0.5 });
document.querySelectorAll("[data-count]").forEach((item) => countObserver.observe(item));

const toast = document.querySelector(".toast");
document.getElementById("quoteForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const message = `Hi Showy Interiors! I'm ${data.get("name")}. I'd like a quotation for ${data.get("project")} in ${data.get("city") || "my city"}. My phone number is ${data.get("phone")}.`;
  const url = `${BUSINESS_LINKS.whatsapp}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank", "noopener");
  toast.textContent = "Opening WhatsApp with your request…";
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2800);
});

document.getElementById("year").textContent = new Date().getFullYear();

const menuToggle = document.querySelector(".menu-toggle");
const mainNav = document.getElementById("mainNav");
const closeMenu = mainNav.querySelector(".mobile-nav-head button");

function setMenu(open) {
  mainNav.classList.toggle("open", open);
  document.body.classList.toggle("menu-open", open);
  menuToggle.setAttribute("aria-expanded", String(open));
  menuToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
}

menuToggle.addEventListener("click", () => setMenu(!mainNav.classList.contains("open")));
closeMenu.addEventListener("click", () => setMenu(false));
mainNav.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => setMenu(false)));
