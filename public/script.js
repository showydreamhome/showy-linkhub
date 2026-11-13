import { GALLERY_CATEGORIES } from "./gallery-categories.js";

let content;

async function loadContent() {
  let response;
  try {
    response = await fetch("/api/content");
  } catch {
    // Static deployments use the bundled content.
  }
  if (!response?.ok || !response.headers.get("content-type")?.includes("application/json")) {
    response = await fetch("content.json");
  }
  if (!response.ok) throw new Error("Content is unavailable.");
  content = await response.json();

  document.querySelectorAll("[data-link]").forEach((element) => {
    element.href = content.links[element.dataset.link];
  });
  for (const element of document.querySelectorAll("[data-copy]")) {
    element.textContent = content[element.dataset.copy];
  }

  for (const element of document.querySelectorAll("[data-contact]")) {
    element.textContent = content.contact[element.dataset.contact];
  }
  for (const element of document.querySelectorAll("[data-stat]")) {
    const value = content.stats[element.dataset.stat];
    element.dataset.count = value;
    element.textContent = value;
    countObserver.observe(element);
  }
  document.querySelector("#hero-rating").textContent = content.stats.rating;

  const grid = document.querySelector(".gallery-grid");
  const lightbox = document.querySelector("#gallery-viewer");
  const fullImage = lightbox.querySelector("img");
  const caption = lightbox.querySelector("#gallery-caption");

  const heading = document.querySelector("#gallery-title");
  const back = document.querySelector("#gallery-back");
  const status = document.querySelector("#gallery-status");

  function thumbnail(photo) {
    const image = document.createElement("img");
    image.src = photo.src;
    image.alt = photo.alt;
    image.loading = "lazy";
    return image;
  }

  function renderGallery(scroll = false) {
    const key = location.hash.startsWith("#gallery-") ? location.hash.slice(9) : "";
    const category = Object.hasOwn(GALLERY_CATEGORIES, key) ? key : null;
    heading.textContent = category ? GALLERY_CATEGORIES[category] : "Gallery";
    back.hidden = !category;
    grid.replaceChildren();
    const categoryPhotos = content.gallery.filter((photo) => (photo.category || "living") === category);
    status.hidden = !category || categoryPhotos.length > 0;
    status.textContent = "Photos will appear here when they’re published.";

    if (!category) {
      for (const [id, name] of Object.entries(GALLERY_CATEGORIES)) {
        const link = document.createElement("a");
        link.className = "gallery-card gallery-category";
        link.href = `#gallery-${id}`;
        const cover = content.gallery.find((photo) => (photo.category || "living") === id);
        const preview = cover ? thumbnail(cover) : document.createElement("div");
        if (cover) {
          preview.alt = "";
        } else {
          preview.className = "gallery-cover";
          preview.dataset.category = id;
          preview.setAttribute("aria-hidden", "true");
        }
        const label = document.createElement("span");
        label.textContent = name;
        const action = document.createElement("span");
        action.className = "gallery-action";
        action.textContent = cover ? "View photos" : "Category preview";
        link.append(preview, label, action);
        grid.append(link);
      }
    } else {
      for (const photo of categoryPhotos) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "gallery-card";
        const title = document.createElement("span");
        title.textContent = photo.title;
        button.append(thumbnail(photo), title);
        button.addEventListener("click", () => {
          fullImage.src = photo.src;
          fullImage.alt = photo.alt;
          caption.textContent = photo.title;
          lightbox.showModal();
        });
        grid.append(button);
      }
      if (scroll) document.querySelector("#gallery").scrollIntoView();
    }
  }

  window.addEventListener("hashchange", () => {
    renderGallery(true);
    if (location.hash.startsWith("#gallery")) heading.focus({ preventScroll: true });
  });
  heading.tabIndex = -1;
  renderGallery(true);
}

loadContent().catch(() => {
  const status = document.querySelector("#gallery-status");
  status.textContent = "The gallery is temporarily unavailable.";
  status.hidden = false;
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
const quoteForm = document.querySelector("#quoteForm");
const quoteStatus = document.querySelector("#quote-status");
const quoteWhatsApp = document.querySelector("#quote-whatsapp");
quoteForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = quoteForm.querySelector('button[type="submit"]');
  if (button.disabled) return;
  button.disabled = true;
  quoteWhatsApp.hidden = true;
  quoteStatus.textContent = "Sending enquiry…";
  const data = Object.fromEntries(new FormData(quoteForm));
  try {
    const response = await fetch("/api/enquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    const result = await response.json();
    if (!response.ok || !result.saved) {
      quoteStatus.textContent = result.error || "Could not send your enquiry. Please try again.";
      return;
    }
    quoteForm.reset();
    quoteStatus.textContent = "Enquiry sent.";
    if (content) {
      const message = `Hi Showy Interiors! I'm ${data.name}. I'd like a quotation for ${data.project} in ${data.city || "my city"}. My phone number is ${data.phone}.`;
      const url = new URL(content.links.whatsapp);
      url.searchParams.set("text", message);
      quoteWhatsApp.href = url.href;
      quoteWhatsApp.hidden = false;
    }
  } catch {
    quoteStatus.textContent = "Could not send your enquiry. Please try again.";
  } finally {
    button.disabled = false;
  }
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
