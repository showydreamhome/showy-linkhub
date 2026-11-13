import { GALLERY_CATEGORIES } from "./gallery-categories.js";

const login = document.querySelector("#login");
const editor = document.querySelector("#editor");
const links = document.querySelector("#links");
const contact = document.querySelector("#contact");
const inbox = document.querySelector("#enquiries");
const inboxStatus = document.querySelector("#enquiries-status");
const inboxList = document.querySelector("#enquiries-list");
const refreshInbox = document.querySelector("#refresh-enquiries");
const statKeys = ["years", "interiors", "constructions", "rating"];
const contactKeys = ["officeAddress", "experienceDetails"];
const contactLinks = ["phone", "whatsapp", "office", "experience"];
let inboxRequest = 0;

const photos = document.querySelector("#photos");
const categoryPicker = document.querySelector("#category-picker");
const fileInput = document.querySelector("#photo-files");
const dropZone = document.querySelector("#drop-zone");
const uploadStatus = document.querySelector("#upload-status");
const publish = editor.querySelector('button[type="submit"]');
const signOut = document.querySelector("#sign-out");
let activeCategory = "living";
let busy = false;
const status = document.querySelector("#admin-status");
const saveStatus = document.querySelector("#save-status");
const copyKeys = ["headline", "highlight", "intro"];
const linkLabels = {
  instagram: "Instagram", facebook: "Facebook", youtube: "YouTube",
  reviews: "Google Reviews", website: "Company website", whatsapp: "WhatsApp",
  phone: "Phone link (tel:+919740925180)", office: "Office map link",
  experience: "Experience Centre map link"
};

let credential = "";
let revision;

async function request(method, data, path = "/api/admin") {
  const upload = method === "POST";
  const response = await fetch(upload ? "/api/admin/upload" : path, {
    method,
    headers: { Authorization: `Bearer ${credential}`, "Content-Type": upload ? data.type : "application/json" },
    body: upload ? data : data && JSON.stringify(data)
  });
  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new Error("Open the admin panel through the link hub server.");
  }
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result;
}

function inputField(labelText, name, value, maxLength, type = "text") {
  const label = document.createElement("label");
  label.textContent = labelText;
  const input = document.createElement("input");
  Object.assign(input, { name, value, maxLength, type, required: true });
  label.append(input);
  return label;
}

function refreshPhotos() {
  let index = 0;
  for (const row of photos.children) {
    row.hidden = row.dataset.category !== activeCategory;
    if (row.hidden) continue;
    row.querySelector("legend").textContent = `Photo ${++index}`;
    row.querySelector("[data-up]").disabled = index === 1;
  }
  for (const button of categoryPicker.children) {
    const count = Array.from(photos.children).filter((row) => row.dataset.category === button.dataset.category).length;
    button.textContent = `${GALLERY_CATEGORIES[button.dataset.category]} (${count})`;
    button.setAttribute("aria-pressed", String(button.dataset.category === activeCategory));
  }
  fileInput.disabled = busy || photos.children.length >= 30;
  dropZone.setAttribute("aria-disabled", String(fileInput.disabled));
}

function photoButton(text, action) {
  const button = document.createElement("button");
  Object.assign(button, { textContent: text, type: "button", className: "secondary" });
  button.addEventListener("click", action);
  return button;
}

for (const key of Object.keys(GALLERY_CATEGORIES)) {
  const button = photoButton(GALLERY_CATEGORIES[key], () => {
    activeCategory = key;
    refreshPhotos();
  });
  button.dataset.category = key;
  categoryPicker.append(button);
}

function appendPhoto({ src, title, alt, category = "living" }) {
  const row = document.createElement("fieldset");
  row.className = "photo-row";
  Object.assign(row.dataset, { src, category });
  const image = document.createElement("img");
  image.src = src;
  image.alt = alt;
  image.loading = "lazy";
  const details = document.createElement("div");
  const categoryLabel = document.createElement("label");
  categoryLabel.textContent = "Category";
  const select = document.createElement("select");
  for (const [key, name] of Object.entries(GALLERY_CATEGORIES)) {
    select.add(new Option(name, key));
  }
  select.value = category;
  select.addEventListener("change", () => {
    row.dataset.category = select.value;
    activeCategory = select.value;
    refreshPhotos();
  });
  categoryLabel.append(select);

  const up = photoButton("Move up", () => {
    let previous = row.previousElementSibling;
    while (previous && previous.dataset.category !== row.dataset.category) previous = previous.previousElementSibling;
    if (previous) photos.insertBefore(row, previous);
    refreshPhotos();
    (up.disabled ? row.querySelector("input") : up).focus();
  });
  up.dataset.up = "";
  const remove = photoButton("Remove", () => {
    row.remove();
    refreshPhotos();
    categoryPicker.querySelector('[aria-pressed="true"]').focus();
  });
  details.append(
    inputField("Title", "title", title, 100),
    inputField("Image description", "alt", alt, 180),
    categoryLabel, up, " ", remove
  );
  row.append(document.createElement("legend"), image, details);
  photos.append(row);
}

async function uploadPhotos(files) {
  if (!files.length || busy) return;
  const category = activeCategory;
  busy = true;
  publish.disabled = signOut.disabled = true;
  refreshPhotos();
  const errors = [];
  let uploaded = 0;
  for (const file of files) {
    if (photos.children.length >= 30) {
      errors.push("The gallery supports up to 30 photos.");
      break;
    }
    uploadStatus.textContent = `Uploading ${file.name}…`;
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error("Maximum file size is 10 MB.");
      const { src } = await request("POST", file);
      const title = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim().slice(0, 100) || GALLERY_CATEGORIES[category];
      appendPhoto({ src, title, alt: title, category });
      uploaded += 1;
      refreshPhotos();
    } catch (error) {
      errors.push(`${file.name}. ${error.message}`);
    }
  }
  busy = false;
  publish.disabled = signOut.disabled = false;
  refreshPhotos();
  uploadStatus.textContent = [
    uploaded ? `Added ${uploaded} to ${GALLERY_CATEGORIES[category]}. Select Publish changes to show the photos on the hub.` : "",
    ...errors
  ].filter(Boolean).join(" ");
  if (uploaded) saveStatus.textContent = "";
}

fileInput.addEventListener("change", () => {
  const files = Array.from(fileInput.files);
  fileInput.value = "";
  uploadPhotos(files);
});
dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  if (!fileInput.disabled) dropZone.classList.add("dragging");
});
dropZone.addEventListener("dragleave", (event) => {
  if (!dropZone.contains(event.relatedTarget)) dropZone.classList.remove("dragging");
});
dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropZone.classList.remove("dragging");
  if (!fileInput.disabled) uploadPhotos(Array.from(event.dataTransfer.files));
});

editor.addEventListener("invalid", (event) => {
  const settings = event.target.closest(".site-settings");
  if (settings) settings.open = true;
  const row = event.target.closest(".photo-row");
  if (row?.hidden) {
    activeCategory = row.dataset.category;
    refreshPhotos();
  }
}, true);

async function loadEnquiries() {
  const requestId = ++inboxRequest;
  refreshInbox.disabled = true;
  inboxStatus.textContent = "Loading enquiries…";
  try {
    const enquiries = await request("GET", undefined, "/api/admin/enquiries");
    if (requestId !== inboxRequest) return;
    inboxList.replaceChildren();
    for (const enquiry of enquiries) {
      const row = document.createElement("li");
      const name = document.createElement("strong");
      name.textContent = enquiry.name;
      const date = document.createElement("time");
      date.dateTime = enquiry.receivedAt;
      date.textContent = new Date(enquiry.receivedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
      const phone = document.createElement("a");
      phone.href = `tel:${enquiry.phone.replace(/[^+0-9]/g, "")}`;
      phone.textContent = enquiry.phone;
      const project = document.createElement("span");
      project.textContent = [enquiry.project, enquiry.city].filter(Boolean).join(" · ");
      row.append(name, date, phone, project);
      inboxList.append(row);
    }
    inboxStatus.textContent = enquiries.length ? "" : "No enquiries yet.";
  } catch (error) {
    if (requestId === inboxRequest) inboxStatus.textContent = error.message;
  } finally {
    if (requestId === inboxRequest) refreshInbox.disabled = false;
  }
}

refreshInbox.addEventListener("click", loadEnquiries);

function render(content) {
  revision = content.revision;
  for (const key of copyKeys) editor.elements[key].value = content[key];
  editor.querySelectorAll("[data-business-link]").forEach((label) => label.remove());
  for (const [key, label] of Object.entries(linkLabels)) {
    const field = inputField(label, key, content.links[key], key === "phone" ? 60 : 2048, key === "phone" ? "text" : "url");
    field.dataset.businessLink = "";
    (contactLinks.includes(key) ? contact : links).append(field);
  }
  for (const key of statKeys) editor.elements[key].value = content.stats[key];
  for (const key of contactKeys) editor.elements[key].value = content.contact[key];
  photos.replaceChildren();
  content.gallery.forEach(appendPhoto);
  refreshPhotos();
}

const passwordInput = login.elements.password;
const passwordToggle = document.querySelector("#toggle-password");

function showPassword(visible) {
  passwordInput.type = visible ? "text" : "password";
  passwordToggle.setAttribute("aria-label", visible ? "Hide password" : "Show password");
  passwordToggle.classList.toggle("password-visible", visible);
}

passwordToggle.addEventListener("click", () => showPassword(passwordInput.type === "password"));

login.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = login.querySelector('button[type="submit"]');
  button.disabled = true;
  status.textContent = "";
  credential = login.elements.password.value;
  try {
    render(await request("GET"));
    login.reset();
    showPassword(false);
    login.hidden = true;
    editor.hidden = false;
    inbox.hidden = false;
    loadEnquiries();
    categoryPicker.querySelector('[aria-pressed="true"]').focus();
  } catch (error) {
    credential = "";
    status.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

editor.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy) return;
  busy = true;
  const fieldsets = editor.querySelectorAll(":scope > fieldset, .site-settings > fieldset");
  const buttons = editor.querySelectorAll(".admin-actions button");
  const data = {
    revision,
    links: {},
    stats: Object.fromEntries(statKeys.map((key) => [key, editor.elements[key].valueAsNumber])),
    contact: Object.fromEntries(contactKeys.map((key) => [key, editor.elements[key].value])),
    gallery: []
  };
  for (const key of copyKeys) data[key] = editor.elements[key].value;
  for (const key of Object.keys(linkLabels)) data.links[key] = editor.elements[key].value;
  for (const row of photos.children) {
    data.gallery.push({
      src: row.dataset.src,
      category: row.dataset.category,
      title: row.querySelector('[name="title"]').value,
      alt: row.querySelector('[name="alt"]').value
    });
  }
  for (const element of [...fieldsets, ...buttons]) element.disabled = true;
  saveStatus.textContent = "Publishing…";
  try {
    revision = (await request("PUT", data)).revision;
    saveStatus.textContent = "Changes published.";
    uploadStatus.textContent = "";
  } catch (error) {
    saveStatus.textContent = error.message;
  } finally {
    busy = false;
    for (const element of [...fieldsets, ...buttons]) element.disabled = false;
    refreshPhotos();
  }
});

document.querySelector("#sign-out").addEventListener("click", () => {
  credential = "";
  revision = undefined;
  editor.hidden = true;
  inbox.hidden = true;
  inboxRequest += 1;
  inboxList.replaceChildren();
  inboxStatus.textContent = "";
  editor.reset();
  photos.replaceChildren();
  editor.querySelectorAll("[data-business-link]").forEach((label) => label.remove());
  saveStatus.textContent = "";
  uploadStatus.textContent = "";
  login.hidden = false;
  login.elements.password.focus();
});
