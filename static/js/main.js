/**
 * Interfaz para compartir portapapeles, imágenes y archivos en red local.
 * Polling para actualización automática del contenido compartido.
 */

const API = {
  clipboard: "/api/clipboard",
  clipboardDelete: (index) => `/api/clipboard/${index}`,
  images: "/api/images",
  imageUrl: (id) => `/api/images/${id}`,
  imageDownload: (id) => `/api/images/${id}/download`,
  imageDelete: (id) => `/api/images/${id}`,
  files: "/api/files",
  fileDownload: (id) => `/api/files/${encodeURIComponent(id)}/download`,
  fileView: (id) => `/api/files/${encodeURIComponent(id)}/view`,
  fileDelete: (id) => `/api/files/${encodeURIComponent(id)}`,
  clear: "/api/clear",
};

/** Copia texto al portapapeles; en móvil usa fallback con textarea para que funcione. */
function copyTextToClipboard(text) {
  if (!text) return Promise.resolve(false);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).then(() => true).catch(() => copyTextFallback(text));
  }
  return Promise.resolve(copyTextFallback(text));
}

function copyTextFallback(text) {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    ta.style.top = "0";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch (e) {
    return false;
  }
}

const POLL_INTERVAL = 2000; // solo para lo que aún use polling

// --- Pestañas (al abrir una pestaña se carga su lista una vez; no hay escucha constante) ---
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    const name = tab.dataset.tab;
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".panel").forEach((p) => {
      p.classList.remove("active");
      p.hidden = true;
    });
    tab.classList.add("active");
    const panel = document.getElementById(`section-${name}`);
    if (panel) {
      panel.classList.add("active");
      panel.hidden = false;
      if (name === "clipboard") typeof pollClipboard === "function" && pollClipboard();
      if (name === "images") typeof loadImages === "function" && loadImages();
      if (name === "files") typeof loadFiles === "function" && loadFiles();
    }
  });
});

// --- Copiar URL ---
document.querySelector("[data-copy-url]")?.addEventListener("click", () => {
  const url = document.querySelector(".url")?.textContent?.trim() || "";
  if (url && navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(url).then(() => {
      const btn = document.querySelector("[data-copy-url]");
      const prev = btn.textContent;
      btn.textContent = "¡Copiado!";
      setTimeout(() => { btn.textContent = prev; }, 1500);
    });
  }
});

// --- Liberar todo ---
document.getElementById("clear-all")?.addEventListener("click", () => {
  fetch(API.clear, { method: "POST" })
    .then((r) => r.json())
    .then(() => {
      pollClipboard();
      loadImages();
      loadFiles();
    })
    .catch(() => {});
});

document.getElementById("refresh-all")?.addEventListener("click", function () {
  var btn = this;
  var textoOriginal = btn.textContent;
  btn.textContent = "Actualizando…";
  btn.disabled = true;
  pollClipboard();
  if (typeof loadImages === "function") loadImages();
  if (typeof loadFiles === "function") loadFiles();
  setTimeout(function () {
    btn.textContent = textoOriginal;
    btn.disabled = false;
  }, 600);
});

// --- Portapapeles (historial) ---
const clipboardInput = document.getElementById("clipboard-input");
const clipboardHistoryEl = document.getElementById("clipboard-history");
const clipboardSendBtn = document.getElementById("clipboard-send");

function formatHistoryTime(updated) {
  if (!updated) return "";
  const d = new Date(updated * 1000);
  return d.toLocaleString("es", { dateStyle: "short", timeStyle: "short" });
}

function updateClipboardHistoryUI(history) {
  if (!clipboardHistoryEl) return;
  if (!history || history.length === 0) {
    clipboardHistoryEl.innerHTML = "<p class=\"clipboard-empty\">Nada compartido aún. El contenido se actualizará automáticamente.</p>";
    return;
  }
  clipboardHistoryEl.innerHTML = history.map((entry, i) => {
    const text = entry.text || "";
    const safe = escapeHtml(text);
    const timeStr = formatHistoryTime(entry.updated);
    return `<div class="clipboard-entry" data-index="${i}">
      <div class="clipboard-entry-meta">
        <span class="clipboard-time">${escapeHtml(timeStr)}</span>
        <button type="button" class="btn btn-small btn-copy-entry">Copiar</button>
        <button type="button" class="btn btn-small btn-delete-entry">Borrar</button>
      </div>
      <pre class="clipboard-text">${safe}</pre>
    </div>`;
  }).join("");

  clipboardHistoryEl.querySelectorAll(".btn-copy-entry").forEach((btn) => {
    btn.addEventListener("click", function () {
      const entry = this.closest(".clipboard-entry");
      const pre = entry?.querySelector(".clipboard-text");
      const text = pre ? pre.textContent : "";
      if (!text) return;
      copyTextToClipboard(text).then((ok) => {
        const prev = this.textContent;
        this.textContent = ok ? "¡Copiado!" : "No se pudo";
        setTimeout(() => { this.textContent = prev; }, 1500);
      });
    });
  });

  clipboardHistoryEl.querySelectorAll(".btn-delete-entry").forEach((btn) => {
    btn.addEventListener("click", function () {
      const entry = this.closest(".clipboard-entry");
      const index = entry ? parseInt(entry.getAttribute("data-index"), 10) : -1;
      if (index < 0) return;
      fetch(API.clipboardDelete(index), { method: "DELETE" })
        .then(() => pollClipboard())
        .catch(() => {});
    });
  });
}

function pollClipboard() {
  fetch(API.clipboard + "?_=" + Date.now(), { cache: "no-store" })
    .then((r) => r.json())
    .then((data) => updateClipboardHistoryUI(data.history || []))
    .catch(() => {});
}

function updateClipboardSendButton() {
  const text = (clipboardInput?.value ?? "").trim();
  if (clipboardSendBtn) clipboardSendBtn.disabled = !text;
}

clipboardSendBtn?.addEventListener("click", () => {
  const text = clipboardInput?.value ?? "";
  if (!text.trim()) return;
  fetch(API.clipboard, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  })
    .then((r) => r.json())
    .then(() => {
      clipboardInput.value = "";
      updateClipboardSendButton();
      pollClipboard();
    })
    .catch(() => {});
});

clipboardInput?.addEventListener("input", updateClipboardSendButton);
clipboardInput?.addEventListener("paste", () => setTimeout(updateClipboardSendButton, 0));
updateClipboardSendButton();

document.getElementById("clipboard-refresh")?.addEventListener("click", () => pollClipboard());

// Una sola carga al abrir la página; luego solo al enviar, borrar, actualizar o al cambiar de pestaña
pollClipboard();

// --- Imágenes (solo se suben al pulsar Enviar) ---
const imagesDropZone = document.getElementById("images-drop-zone");
const imagesInput = document.getElementById("images-input");
const imagesGallery = document.getElementById("images-gallery");
const imagesProgress = document.getElementById("images-progress");
const imagesPendingWrap = document.getElementById("images-pending-wrap");
const imagesPending = document.getElementById("images-pending");
const imagesSendBtn = document.getElementById("images-send-btn");
const progressFill = imagesProgress?.querySelector(".progress-fill");
const progressText = imagesProgress?.querySelector(".progress-text");

let pendingImages = [];

function showProgress(show, percent = 0, text = "Subiendo...") {
  if (!imagesProgress) return;
  imagesProgress.hidden = !show;
  if (progressFill) progressFill.style.width = percent + "%";
  if (progressText) progressText.textContent = text;
}

function addPendingImages(files) {
  const newOnes = Array.from(files || []).filter((f) => f && f.type && f.type.startsWith("image/"));
  if (!newOnes.length) return;
  pendingImages = pendingImages.concat(newOnes);
  renderPendingImages();
  if (imagesPendingWrap) imagesPendingWrap.hidden = false;
}

function removePendingImage(index) {
  pendingImages = pendingImages.filter((_, i) => i !== index);
  renderPendingImages();
  if (pendingImages.length === 0 && imagesPendingWrap) imagesPendingWrap.hidden = true;
}

let pendingImageUrls = [];

function renderPendingImages() {
  if (!imagesPending) return;
  pendingImageUrls.forEach((u) => URL.revokeObjectURL(u));
  pendingImageUrls = [];
  imagesPending.innerHTML = pendingImages.map((file, i) => {
    const name = escapeHtml(file.name || "imagen");
    const url = URL.createObjectURL(file);
    pendingImageUrls.push(url);
    return `<div class="pending-preview-item">
      <img src="${url}" alt="">
      <span class="pending-preview-name">${name}</span>
      <button type="button" class="btn btn-small btn-remove-pending" data-index="${i}" title="Quitar">×</button>
    </div>`;
  }).join("");
  imagesPending.querySelectorAll(".btn-remove-pending").forEach((btn) => {
    btn.addEventListener("click", function () {
      removePendingImage(Number(this.getAttribute("data-index")));
    });
  });
}

function formatImageTime(updated) {
  if (!updated) return "";
  const d = new Date(updated * 1000);
  return d.toLocaleString("es", { dateStyle: "short", timeStyle: "short" });
}

function renderImages(list) {
  if (!imagesGallery) return;
  if (!list || !list.length) {
    imagesGallery.innerHTML = "<p class=\"images-empty\">No hay imágenes compartidas.</p>";
    return;
  }
  var seen = {};
  list = list.filter(function (img) {
    if (seen[img.id]) return false;
    seen[img.id] = true;
    return true;
  });
  imagesGallery.innerHTML = list.map((img) => {
    const timeStr = formatImageTime(img.updated);
    return `
    <div class="gallery-item image-history-item" data-id="${escapeHtml(img.id)}">
      <div class="gallery-item-preview" tabindex="0" role="button">
        <img src="${API.imageUrl(img.id)}" alt="${escapeHtml(img.name)}" loading="lazy" data-full-url="${escapeHtml(API.imageUrl(img.id))}">
      </div>
      <div class="gallery-item-meta">
        <span class="gallery-item-time">${escapeHtml(timeStr)}</span>
        <div class="gallery-item-actions">
          <a href="${API.imageDownload(img.id)}" class="btn btn-small btn-secondary" download>Descargar</a>
          <button type="button" class="btn btn-small btn-delete-image" data-id="${escapeHtml(img.id)}">Borrar</button>
        </div>
      </div>
    </div>`;
  }).join("");

  imagesGallery.querySelectorAll(".gallery-item-preview, .gallery-item-preview img").forEach((el) => {
    el.addEventListener("click", function (e) {
      e.preventDefault();
      const img = this.closest(".image-history-item")?.querySelector("img");
      const url = img?.getAttribute("data-full-url") || img?.src;
      if (url) openImageLightbox(url);
    });
  });

  imagesGallery.querySelectorAll(".btn-delete-image").forEach((btn) => {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      const id = this.getAttribute("data-id");
      if (!id) return;
      fetch(API.imageDelete(id), { method: "DELETE" })
        .then((r) => { if (r.ok) loadImages(); })
        .catch(() => {});
    });
  });
}

// --- Visor de imagen (lightbox): ver grande, zoom, X para cerrar ---
const lightbox = document.getElementById("image-lightbox");
const lightboxImg = document.getElementById("lightbox-img");
const lightboxClose = document.querySelector(".lightbox-close");
const lightboxZoomIn = document.getElementById("lightbox-zoom-in");
const lightboxZoomOut = document.getElementById("lightbox-zoom-out");
const lightboxZoomValue = document.getElementById("lightbox-zoom-value");

let lightboxScale = 1;
const LIGHTBOX_SCALE_STEP = 0.25;
const LIGHTBOX_SCALE_MIN = 0.5;
const LIGHTBOX_SCALE_MAX = 4;

function openImageLightbox(imageUrl) {
  if (!lightbox || !lightboxImg) return;
  lightboxScale = 1;
  lightboxImg.src = imageUrl;
  lightboxImg.style.transform = "scale(1)";
  if (lightboxZoomValue) lightboxZoomValue.textContent = "100%";
  lightbox.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeImageLightbox() {
  if (!lightbox) return;
  lightbox.hidden = true;
  document.body.style.overflow = "";
}

// --- Visor de PDF (iframe) ---
const pdfLightbox = document.getElementById("pdf-lightbox");
const pdfIframe = document.getElementById("pdf-iframe");
const pdfLightboxClose = document.getElementById("pdf-lightbox-close");
const pdfOpenExternalBtn = document.getElementById("pdf-open-external");
const resumePdfBtn = document.getElementById("resume-pdf-btn");

const PDF_LAST_URL_KEY = "last_pdf_url";
const PDF_MODAL_HASH = "#pdf-viewer";

let currentPdfUrl = "";
let filesListScrollTopBeforePdf = 0;
let pdfHistoryStateOpen = false;

function saveLastPdfState(pdfUrl) {
  if (!pdfUrl) return;
  currentPdfUrl = pdfUrl;
  try {
    localStorage.setItem(PDF_LAST_URL_KEY, pdfUrl);
  } catch (_) {}
  updateResumePdfButton();
}

function updateResumePdfButton() {
  if (!resumePdfBtn) return;
  let lastUrl = "";
  try {
    lastUrl = localStorage.getItem(PDF_LAST_URL_KEY) || "";
  } catch (_) {
    lastUrl = "";
  }
  resumePdfBtn.hidden = !lastUrl;
}

function openPdfLightbox(pdfUrl) {
  if (!pdfLightbox || !pdfIframe || !pdfUrl) return;
  saveLastPdfState(pdfUrl);
  if (filesList) filesListScrollTopBeforePdf = filesList.scrollTop;
  pdfIframe.src = pdfUrl;
  pdfLightbox.hidden = false;
  document.body.style.overflow = "hidden";
  if (pdfOpenExternalBtn) pdfOpenExternalBtn.hidden = false;
  if (window.location.hash !== PDF_MODAL_HASH) {
    history.pushState({ pdfOpen: true }, "", PDF_MODAL_HASH);
    pdfHistoryStateOpen = true;
  }
}

function closePdfLightbox(fromHistory = false) {
  if (!pdfLightbox) return;
  pdfLightbox.hidden = true;
  if (pdfIframe) pdfIframe.src = "";
  document.body.style.overflow = "";
  if (pdfOpenExternalBtn) pdfOpenExternalBtn.hidden = true;
  if (filesList) filesList.scrollTop = filesListScrollTopBeforePdf;
  if (!fromHistory && pdfHistoryStateOpen && window.location.hash === PDF_MODAL_HASH) {
    history.back();
  }
  pdfHistoryStateOpen = false;
}

pdfLightboxClose?.addEventListener("click", closePdfLightbox);
pdfLightbox?.addEventListener("click", (e) => {
  if (e.target === pdfLightbox) closePdfLightbox();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && pdfLightbox && !pdfLightbox.hidden) closePdfLightbox();
});

window.addEventListener("popstate", () => {
  if (pdfLightbox && !pdfLightbox.hidden) {
    closePdfLightbox(true);
  }
});

pdfOpenExternalBtn?.addEventListener("click", () => {
  const url = currentPdfUrl || (pdfIframe?.src || "");
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
});

resumePdfBtn?.addEventListener("click", () => {
  let lastUrl = "";
  try {
    lastUrl = localStorage.getItem(PDF_LAST_URL_KEY) || "";
  } catch (_) {
    lastUrl = "";
  }
  if (!lastUrl) return;
  openPdfLightbox(lastUrl);
});

function setLightboxZoom(scale) {
  lightboxScale = Math.max(LIGHTBOX_SCALE_MIN, Math.min(LIGHTBOX_SCALE_MAX, scale));
  if (lightboxImg) lightboxImg.style.transform = `scale(${lightboxScale})`;
  if (lightboxZoomValue) lightboxZoomValue.textContent = Math.round(lightboxScale * 100) + "%";
}

lightboxClose?.addEventListener("click", closeImageLightbox);
lightbox?.addEventListener("click", (e) => {
  if (e.target === lightbox) closeImageLightbox();
});
lightboxZoomIn?.addEventListener("click", (e) => {
  e.stopPropagation();
  setLightboxZoom(lightboxScale + LIGHTBOX_SCALE_STEP);
});
lightboxZoomOut?.addEventListener("click", (e) => {
  e.stopPropagation();
  setLightboxZoom(lightboxScale - LIGHTBOX_SCALE_STEP);
});
if (lightboxImg) {
  lightboxImg.addEventListener("click", (e) => e.stopPropagation());
  lightboxImg.addEventListener("wheel", (e) => {
    e.preventDefault();
    if (e.deltaY < 0) setLightboxZoom(lightboxScale + 0.15);
    else setLightboxZoom(lightboxScale - 0.15);
  }, { passive: false });
}
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && lightbox && !lightbox.hidden) closeImageLightbox();
});

function loadImages() {
  fetch(API.images + "?_=" + Date.now(), { cache: "no-store" })
    .then((r) => r.json())
    .then((data) => renderImages(data.images || []))
    .catch(() => {});
}

function uploadImagesNow(files) {
  if (!files || files.length === 0) return;
  const form = new FormData();
  for (let i = 0; i < files.length; i++) {
    form.append("file", files[i]);
  }
  showProgress(true, 0);
  fetch(API.images, { method: "POST", body: form })
    .then((r) => r.json())
    .then(() => {
      showProgress(true, 100, "Listo");
      pendingImages = [];
      if (imagesPendingWrap) imagesPendingWrap.hidden = true;
      renderPendingImages();
      loadImages();
      setTimeout(() => showProgress(false), 500);
    })
    .catch(() => { showProgress(false); })
    .finally(() => { showProgress(false); });
}

imagesDropZone?.addEventListener("click", () => imagesInput?.click());
imagesInput?.addEventListener("change", (e) => {
  addPendingImages(e.target.files);
  e.target.value = "";
});

imagesDropZone?.addEventListener("dragover", (e) => {
  e.preventDefault();
  imagesDropZone.classList.add("dragover");
});
imagesDropZone?.addEventListener("dragleave", () => imagesDropZone.classList.remove("dragover"));
imagesDropZone?.addEventListener("drop", (e) => {
  e.preventDefault();
  imagesDropZone.classList.remove("dragover");
  addPendingImages(e.dataTransfer?.files);
});

document.addEventListener("paste", (e) => {
  if (!e.clipboardData) return;
  const target = e.target?.closest?.("#clipboard-input, .textarea, input, [contenteditable=\"true\"]");
  if (target && target.id === "clipboard-input") return;
  const items = e.clipboardData.items || [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind === "file" && item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) {
        e.preventDefault();
        e.stopPropagation();
        addPendingImages([file]);
      }
      return;
    }
  }
}, true);

imagesSendBtn?.addEventListener("click", () => {
  if (pendingImages.length === 0) return;
  uploadImagesNow(pendingImages);
});

// Sin polling: la lista solo se carga al abrir la pestaña Imágenes o después de enviar

// --- Archivos (solo se suben al pulsar Enviar) ---
const filesDropZone = document.getElementById("files-drop-zone");
const filesInput = document.getElementById("files-input");
const filesFolder = document.getElementById("files-folder");
const filesList = document.getElementById("files-list");
const filesError = document.getElementById("files-error");
const filesProgress = document.getElementById("files-progress");
const filesPendingWrap = document.getElementById("files-pending-wrap");
const filesPendingList = document.getElementById("files-pending-list");
const filesSendBtn = document.getElementById("files-send-btn");
const filesProgressFill = filesProgress?.querySelector(".progress-fill");
const filesProgressText = filesProgress?.querySelector(".progress-text");

let pendingFiles = [];

function showFilesProgress(show, percent = 0, text = "Subiendo...") {
  if (!filesProgress) return;
  filesProgress.hidden = !show;
  if (filesProgressFill) filesProgressFill.style.width = percent + "%";
  if (filesProgressText) filesProgressText.textContent = text;
}

function addPendingFiles(fileList) {
  const newOnes = Array.from(fileList || []);
  if (!newOnes.length) return;
  pendingFiles = pendingFiles.concat(newOnes);
  renderPendingFiles();
  if (filesPendingWrap) filesPendingWrap.hidden = false;
}

function removePendingFile(index) {
  pendingFiles = pendingFiles.filter((_, i) => i !== index);
  renderPendingFiles();
  if (pendingFiles.length === 0 && filesPendingWrap) filesPendingWrap.hidden = true;
}

function renderPendingFiles() {
  if (!filesPendingList) return;
  filesPendingList.innerHTML = pendingFiles.map((file, i) => {
    const name = escapeHtml(file.name || "archivo");
    return `<div class="file-pending-row">
      <span class="name">${name}</span>
      <button type="button" class="btn btn-small btn-remove-pending" data-index="${i}" title="Quitar">×</button>
    </div>`;
  }).join("");
  filesPendingList.querySelectorAll(".btn-remove-pending").forEach((btn) => {
    btn.addEventListener("click", function () {
      removePendingFile(Number(this.getAttribute("data-index")));
    });
  });
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function renderFiles(list) {
  if (!filesList) return;
  if (list && list.length) {
    var seen = {};
    list = list.filter(function (f) {
      if (seen[f.id]) return false;
      seen[f.id] = true;
      return true;
    });
  }

  filesList.innerHTML = (list || []).map((f) => {
    const isPdf = (f.name || "").toLowerCase().endsWith(".pdf");
    const pdfBtn = isPdf
      ? `<button type="button" class="btn btn-small btn-view-pdf" data-id="${escapeHtml(f.id)}">Ver PDF</button>`
      : "";
    return `
      <div class="file-row" data-id="${escapeHtml(f.id)}">
        <span class="name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</span>
        <span class="size">${formatSize(f.size)}</span>
        ${pdfBtn}
        <a href="${API.fileDownload(f.id)}" class="btn btn-small btn-secondary" download>Descargar</a>
        <button type="button" class="btn btn-small btn-delete-file">Borrar</button>
      </div>
    `;
  }).join("");

  filesList.querySelectorAll(".btn-delete-file").forEach((btn) => {
    btn.addEventListener("click", function () {
      const row = this.closest(".file-row");
      const id = row?.getAttribute("data-id");
      if (!id) return;
      fetch(API.fileDelete(id), { method: "DELETE" })
        .then((r) => { if (r.ok) loadFiles(); })
        .catch(() => {});
    });
  });

  filesList.querySelectorAll(".btn-view-pdf").forEach((btn) => {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      const id = this.getAttribute("data-id");
      if (!id) return;
      // Cache-busting para evitar que el iframe se quede con una versión vieja
      openPdfLightbox(API.fileView(id) + "?_=" + Date.now());
    });
  });

  if (filesError) filesError.textContent = "";
}

function loadFiles() {
  fetch(API.files + "?_=" + Date.now(), { cache: "no-store" })
    .then((r) => r.json())
    .then((data) => renderFiles(data.files || []))
    .catch(() => {
      if (filesError) filesError.textContent = "Error al cargar los archivos. Puede que la subida haya sido muy grande o la conexión se haya reiniciado.";
    });
}

function uploadFilesNow(files) {
  if (!files || files.length === 0) return;
  const form = new FormData();
  for (let i = 0; i < files.length; i++) {
    form.append("file", files[i]);
  }
  const total = files.length;
  showFilesProgress(true, 0, "Subiendo " + total + " archivo(s)...");
  fetch(API.files, { method: "POST", body: form })
    .then((r) => r.json())
    .then(() => {
      showFilesProgress(true, 100, "Listo. " + total + " archivo(s) subidos.");
      pendingFiles = [];
      if (filesPendingWrap) filesPendingWrap.hidden = true;
      renderPendingFiles();
      loadFiles();
      setTimeout(() => showFilesProgress(false), 500);
    })
    .catch(() => {
      showFilesProgress(false);
      if (filesError) filesError.textContent = "Error al subir los archivos o carpeta. Prueba con menos archivos o más pequeños.";
    });
}

function triggerFileInput(useFolder) {
  if (useFolder && filesFolder) filesFolder.click();
  else if (filesInput) filesInput.click();
}

filesDropZone?.addEventListener("click", (e) => {
  if (e.target.tagName === "INPUT") return;
  filesInput?.click();
});

document.getElementById("files-select")?.addEventListener("click", () => triggerFileInput(false));
document.getElementById("files-select-folder")?.addEventListener("click", () => triggerFileInput(true));

filesInput?.addEventListener("change", (e) => {
  addPendingFiles(e.target.files ? Array.from(e.target.files) : []);
  e.target.value = "";
});
filesFolder?.addEventListener("change", (e) => {
  addPendingFiles(e.target.files ? Array.from(e.target.files) : []);
  e.target.value = "";
});

filesDropZone?.addEventListener("dragover", (e) => {
  e.preventDefault();
  filesDropZone.classList.add("dragover");
});
filesDropZone?.addEventListener("dragleave", () => filesDropZone.classList.remove("dragover"));
filesDropZone?.addEventListener("drop", (e) => {
  e.preventDefault();
  filesDropZone.classList.remove("dragover");
  addPendingFiles(Array.from(e.dataTransfer?.files || []));
});

filesSendBtn?.addEventListener("click", () => {
  if (pendingFiles.length === 0) return;
  uploadFilesNow(pendingFiles);
});

// Sin polling: la lista solo se carga al abrir la pestaña Archivos o después de enviar

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

updateResumePdfButton();
if (pdfOpenExternalBtn) pdfOpenExternalBtn.hidden = true;
