// ================= CONFIG =================
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
const sizeSelect = document.getElementById("sizeSelect");
const countSlider = document.getElementById("countSlider");
const countLabel = document.getElementById("countLabel");

const cropBox = document.getElementById("cropBox");
const cropCanvas = document.getElementById("cropCanvas");
const cropCtx = cropCanvas.getContext("2d");

const previewCanvas = document.getElementById("previewCanvas");
const previewCtx = previewCanvas.getContext("2d");

const controls = document.getElementById("controls");
const previewBox = document.getElementById("previewBox");
const downloadBox = document.getElementById("downloadBox");

const pdfBtn = document.getElementById("pdfBtn");
const jpgBtn = document.getElementById("jpgBtn");
const pngBtn = document.getElementById("pngBtn");

// ================= STATE =================
let image = null;
let croppedImage = null;
let copyCount = 8;

let crop = { x: 0, y: 0, w: 200, h: 200 };
let dragging = false;
let resizing = false;
let startX = 0;
let startY = 0;

// ================= HELPERS =================
function getCropAspect() {
  const s = SIZES[sizeSelect.value];
  return s.w / s.h;
}

function getCanvasPoint(e) {
  const rect = cropCanvas.getBoundingClientRect();
  const scaleX = cropCanvas.width / rect.width;
  const scaleY = cropCanvas.height / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY
  };
}

// ================= UPLOAD =================
fileInput.onchange = e => {
  const img = new Image();
  img.onload = () => {
    image = img;

    cropCanvas.width = img.width;
    cropCanvas.height = img.height;

    const aspect = getCropAspect();
    const w = img.width * 0.6;
    const h = w / aspect;

    crop = {
      x: (img.width - w) / 2,
      y: (img.height - h) / 2,
      w,
      h
    };

    cropBox.hidden = false;
    controls.hidden = false;
    previewBox.hidden = false;
    downloadBox.hidden = false;

    drawCrop();
  };
  img.src = URL.createObjectURL(e.target.files[0]);
};

// ================= DRAW CROP (FIXED) =================
function drawCrop() {
  cropCtx.clearRect(0, 0, cropCanvas.width, cropCanvas.height);

  // Draw full image
  cropCtx.drawImage(image, 0, 0);

  // Dark overlay
  cropCtx.fillStyle = "rgba(0,0,0,0.45)";
  cropCtx.fillRect(0, 0, cropCanvas.width, cropCanvas.height);

  // Draw image again inside crop (VISIBLE AREA)
  cropCtx.save();
  cropCtx.beginPath();
  cropCtx.rect(crop.x, crop.y, crop.w, crop.h);
  cropCtx.clip();
  cropCtx.drawImage(image, 0, 0);
  cropCtx.restore();

  // Crop border
  cropCtx.strokeStyle = "#00aaff";
  cropCtx.lineWidth = 3;
  cropCtx.strokeRect(crop.x, crop.y, crop.w, crop.h);

  updateCroppedImage();
}

function updateCroppedImage() {
  const temp = document.createElement("canvas");
  temp.width = crop.w;
  temp.height = crop.h;

  temp.getContext("2d").drawImage(
    image,
    crop.x, crop.y, crop.w, crop.h,
    0, 0, crop.w, crop.h
  );

  croppedImage = temp;
  renderPreview();
}

// ================= POINTER EVENTS =================
cropCanvas.addEventListener("pointerdown", e => {
  const p = getCanvasPoint(e);
  startX = p.x;
  startY = p.y;

  if (
    Math.abs(startX - (crop.x + crop.w)) < 30 &&
    Math.abs(startY - (crop.y + crop.h)) < 30
  ) {
    resizing = true;
  } else if (
    startX > crop.x && startX < crop.x + crop.w &&
    startY > crop.y && startY < crop.y + crop.h
  ) {
    dragging = true;
  }

  cropCanvas.setPointerCapture(e.pointerId);
});

cropCanvas.addEventListener("pointermove", e => {
  if (!dragging && !resizing) return;

  const p = getCanvasPoint(e);
  const dx = p.x - startX;
  const dy = p.y - startY;

  if (dragging) {
    crop.x += dx;
    crop.y += dy;
  }

  if (resizing) {
    const aspect = getCropAspect();
    crop.w += dx;
    crop.h = crop.w / aspect;
  }

  startX = p.x;
  startY = p.y;

  drawCrop();
});

cropCanvas.addEventListener("pointerup", () => {
  dragging = false;
  resizing = false;
});

// ================= CONTROLS =================
countSlider.oninput = () => {
  copyCount = +countSlider.value;
  countLabel.textContent = `${copyCount} copies`;
  renderPreview();
};

sizeSelect.onchange = () => {
  if (!image) return;
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

  const size = SIZES[sizeSelect.value];
  const pw = size.w * scale;
  const ph = size.h * scale;

  const usableW = previewCanvas.width - MARGIN * scale * 2;
  const cols = Math.floor((usableW + GAP * scale) / (pw + GAP * scale));

  for (let i = 0; i < copyCount; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;

    previewCtx.drawImage(
      croppedImage,
      MARGIN * scale + c * (pw + GAP * scale),
      MARGIN * scale + r * (ph + GAP * scale),
      pw, ph
    );
  }
}

// ================= DOWNLOAD =================
pdfBtn.onclick = () => download("pdf");
jpgBtn.onclick = () => download("jpg");
pngBtn.onclick = () => download("png");

function download(type) {
  if (!croppedImage) return;

  const canvas = document.createElement("canvas");
  canvas.width = A4_W;
  canvas.height = A4_H;

  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, A4_W, A4_H);

  const size = SIZES[sizeSelect.value];
  const usableW = A4_W - MARGIN * 2;
  const cols = Math.floor((usableW + GAP) / (size.w + GAP));

  for (let i = 0; i < copyCount; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;

    ctx.drawImage(
      croppedImage,
      MARGIN + c * (size.w + GAP),
      MARGIN + r * (size.h + GAP),
      size.w, size.h
    );
  }

  if (type === "pdf") {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: "px", format: [A4_W, A4_H] });
    pdf.addImage(canvas, "PNG", 0, 0, A4_W, A4_H);
    pdf.save("passport_photos.pdf");
  } else {
    const link = document.createElement("a");
    link.download = `passport_photos.${type}`;
    link.href = canvas.toDataURL(`image/${type}`, 1.0);
    link.click();
  }
}