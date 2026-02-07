// ================= CONFIG =================
const BG_API = "https://bg-remover-backend-3dz2.onrender.com/remove-background";

const A4_W = 2480;
const A4_H = 3508;
const DPI = 300;
const CM = DPI / 2.54;

const MARGIN = 120;
const GAP = 30;

const SIZES = {
  "2x2": { w: 2 * DPI, h: 2 * DPI },
  "3.5x4.5": { w: 3.5 * CM, h: 4.5 * CM },
  "5x5": { w: 5 * CM, h: 5 * CM }
};

// ================= ELEMENTS =================
const fileInput = document.getElementById("fileInput");
const removeBgToggle = document.getElementById("removeBgToggle");
const removeBgBtn = document.getElementById("removeBgBtn");
const bgColorSelect = document.getElementById("bgColor");
const brightnessSlider = document.getElementById("brightness");

const sizeSelect = document.getElementById("sizeSelect");
const countSlider = document.getElementById("countSlider");
const countLabel = document.getElementById("countLabel");

const cropCanvas = document.getElementById("cropCanvas");
const cropCtx = cropCanvas.getContext("2d");

const previewCanvas = document.getElementById("previewCanvas");
const previewCtx = previewCanvas.getContext("2d");

const pdfBtn = document.getElementById("pdfBtn");
const jpgBtn = document.getElementById("jpgBtn");
const pngBtn = document.getElementById("pngBtn");

const imageOptions = document.getElementById("imageOptions");
const cropBox = document.getElementById("cropBox");
const controls = document.getElementById("controls");
const previewBox = document.getElementById("previewBox");
const downloadBox = document.getElementById("downloadBox");

// ================= STATE =================
let originalImage = null;
let bgRemovedImage = null;
let workingImage = null;
let croppedImage = null;
let copyCount = 8;

let crop = { x: 0, y: 0, w: 200, h: 200 };
let dragging = false;
let resizing = false;
let startX = 0;
let startY = 0;

// ================= HELPERS =================
function getCropAspect() {
  return SIZES[sizeSelect.value].w / SIZES[sizeSelect.value].h;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function getCanvasPoint(e) {
  const r = cropCanvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * (cropCanvas.width / r.width),
    y: (e.clientY - r.top) * (cropCanvas.height / r.height)
  };
}

// ================= UPLOAD =================
fileInput.onchange = e => {
  const file = e.target.files[0];
  if (!file) return;

  const img = new Image();
  img.onload = () => {
    originalImage = img;
    bgRemovedImage = null;

    imageOptions.hidden = false;
    cropBox.hidden = false;
    controls.hidden = false;
    previewBox.hidden = false;
    downloadBox.hidden = false;

    rebuildWorkingImage();
  };

  img.src = URL.createObjectURL(file);
};

// ================= BACKGROUND REMOVAL =================
async function removeBackground() {
  const blob = await fetch(originalImage.src).then(r => r.blob());
  const fd = new FormData();
  fd.append("file", blob, "image.png");

  const res = await fetch(BG_API, { method: "POST", body: fd });
  if (!res.ok) throw new Error("Background removal failed");

  const outBlob = await res.blob();
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = URL.createObjectURL(outBlob);
  });
}

// ================= IMAGE PIPELINE =================
function rebuildWorkingImage() {
  // 🔥 SINGLE SOURCE OF TRUTH
  const base =
    removeBgToggle.checked && bgRemovedImage
      ? bgRemovedImage
      : originalImage;

  const c = document.createElement("canvas");
  c.width = base.width;
  c.height = base.height;
  const ctx = c.getContext("2d");

  ctx.clearRect(0, 0, c.width, c.height);
  ctx.fillStyle = bgColorSelect.value;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(base, 0, 0);

  const delta = Number(brightnessSlider.value) * 2.55;
  if (delta !== 0) {
    const imgData = ctx.getImageData(0, 0, c.width, c.height);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = clamp(d[i] + delta, 0, 255);
      d[i + 1] = clamp(d[i + 1] + delta, 0, 255);
      d[i + 2] = clamp(d[i + 2] + delta, 0, 255);
    }
    ctx.putImageData(imgData, 0, 0);
  }

  workingImage = c;
  initCrop();
}

// ================= BG TOGGLE (FIXED) =================
removeBgToggle.onchange = () => {
  removeBgBtn.disabled = !removeBgToggle.checked;

  // 🔥 FORCE REBUILD ON TOGGLE
  rebuildWorkingImage();
};

removeBgBtn.onclick = async () => {
  removeBgBtn.textContent = "Removing...";
  removeBgBtn.disabled = true;

  if (!bgRemovedImage) {
    bgRemovedImage = await removeBackground();
  }

  rebuildWorkingImage();
  removeBgBtn.textContent = "Background Removed";
};

// ================= CROP =================
function initCrop() {
  cropCanvas.width = workingImage.width;
  cropCanvas.height = workingImage.height;

  const aspect = getCropAspect();
  const w = workingImage.width * 0.6;
  const h = w / aspect;

  crop = {
    x: (workingImage.width - w) / 2,
    y: (workingImage.height - h) / 2,
    w,
    h
  };

  drawCrop();
}

function drawCrop() {
  cropCtx.clearRect(0, 0, cropCanvas.width, cropCanvas.height);
  cropCtx.drawImage(workingImage, 0, 0);

  cropCtx.fillStyle = "rgba(0,0,0,0.45)";
  cropCtx.fillRect(0, 0, cropCanvas.width, cropCanvas.height);

  cropCtx.save();
  cropCtx.beginPath();
  cropCtx.rect(crop.x, crop.y, crop.w, crop.h);
  cropCtx.clip();
  cropCtx.drawImage(workingImage, 0, 0);
  cropCtx.restore();

  cropCtx.strokeStyle = "#00aaff";
  cropCtx.lineWidth = 3;
  cropCtx.strokeRect(crop.x, crop.y, crop.w, crop.h);

  updateCropped();
}

function updateCropped() {
  const t = document.createElement("canvas");
  t.width = crop.w;
  t.height = crop.h;
  t.getContext("2d").drawImage(
    workingImage,
    crop.x, crop.y, crop.w, crop.h,
    0, 0, crop.w, crop.h
  );
  croppedImage = t;
  renderPreview();
}

// ================= POINTER =================
cropCanvas.onpointerdown = e => {
  const p = getCanvasPoint(e);
  startX = p.x;
  startY = p.y;

  if (
    Math.abs(startX - (crop.x + crop.w)) < 30 &&
    Math.abs(startY - (crop.y + crop.h)) < 30
  ) {
    resizing = true;
  } else if (
    startX > crop.x &&
    startX < crop.x + crop.w &&
    startY > crop.y &&
    startY < crop.y + crop.h
  ) {
    dragging = true;
  }

  cropCanvas.setPointerCapture(e.pointerId);
};

cropCanvas.onpointermove = e => {
  if (!dragging && !resizing) return;

  const p = getCanvasPoint(e);
  const dx = p.x - startX;
  const dy = p.y - startY;

  if (dragging) {
    crop.x = clamp(crop.x + dx, 0, cropCanvas.width - crop.w);
    crop.y = clamp(crop.y + dy, 0, cropCanvas.height - crop.h);
  }

  if (resizing) {
    crop.w = clamp(crop.w + dx, 50, cropCanvas.width - crop.x);
    crop.h = crop.w / getCropAspect();
  }

  startX = p.x;
  startY = p.y;
  drawCrop();
};

cropCanvas.onpointerup = () => {
  dragging = false;
  resizing = false;
};

// ================= CONTROLS =================
bgColorSelect.onchange = rebuildWorkingImage;
brightnessSlider.oninput = rebuildWorkingImage;

countSlider.oninput = () => {
  copyCount = +countSlider.value;
  countLabel.textContent = `${copyCount} copies`;
  renderPreview();
};

sizeSelect.onchange = () => {
  crop.h = crop.w / getCropAspect();
  drawCrop();
};

// ================= PREVIEW =================
function renderPreview() {
  if (!croppedImage) return;

  const scale = 0.25;
  previewCanvas.width = A4_W * scale;
  previewCanvas.height = A4_H * scale;

  previewCtx.fillStyle = "#fff";
  previewCtx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);

  const s = SIZES[sizeSelect.value];
  const pw = s.w * scale;
  const ph = s.h * scale;
  const usableW = previewCanvas.width - MARGIN * scale * 2;
  const cols = Math.floor((usableW + GAP * scale) / (pw + GAP * scale));

  for (let i = 0; i < copyCount; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    previewCtx.drawImage(
      croppedImage,
      MARGIN * scale + c * (pw + GAP * scale),
      MARGIN * scale + r * (ph + GAP * scale),
      pw,
      ph
    );
  }
}

// ================= DOWNLOAD =================
[pdfBtn, jpgBtn, pngBtn].forEach(btn =>
  btn.onclick = () =>
    download(
      btn.id.includes("pdf")
        ? "pdf"
        : btn.id.includes("jpg")
        ? "jpg"
        : "png"
    )
);

function download(type) {
  const canvas = document.createElement("canvas");
  canvas.width = A4_W;
  canvas.height = A4_H;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, A4_W, A4_H);

  const s = SIZES[sizeSelect.value];
  const cols = Math.floor((A4_W - MARGIN * 2 + GAP) / (s.w + GAP));

  for (let i = 0; i < copyCount; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    ctx.drawImage(
      croppedImage,
      MARGIN + c * (s.w + GAP),
      MARGIN + r * (s.h + GAP),
      s.w,
      s.h
    );
  }

  if (type === "pdf") {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: "px", format: [A4_W, A4_H] });
    pdf.addImage(canvas, "PNG", 0, 0);
    pdf.save("passport_photos.pdf");
  } else {
    const a = document.createElement("a");
    a.download = `passport_photos.${type}`;
    a.href = canvas.toDataURL(`image/${type}`, 1);
    a.click();
  }
}