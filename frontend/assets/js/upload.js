/* ============================================
   EduNaija — upload.js
   Image upload, preview, delete before send
   Converts to base64 for Worker API
   ============================================ */

// ── STATE ──
let _pending = []; // [{dataUrl, base64, mimeType, name}]

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE_MB   = 5;
const MAX_IMAGES    = 4;

// ── HANDLE FILE INPUT CHANGE ──
function handleImageUpload(input) {
  const files = Array.from(input.files || []);

  const remaining = MAX_IMAGES - _pending.length;
  if (remaining <= 0) {
    window.UI?.showToast(`Max ${MAX_IMAGES} images per message`);
    input.value = '';
    return;
  }

  files.slice(0, remaining).forEach(file => {
    // Validate type
    if (!ALLOWED_TYPES.includes(file.type)) {
      window.UI?.showToast(`${file.name}: unsupported format`);
      return;
    }
    // Validate size
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      window.UI?.showToast(`${file.name}: max size is ${MAX_SIZE_MB}MB`);
      return;
    }

    const reader = new FileReader();
    reader.onload = e => {
      const dataUrl = e.target.result;
      const base64  = dataUrl.split(',')[1];
      _pending.push({
        dataUrl,
        base64,
        mimeType: file.type,
        name:     file.name
      });
      render();
    };
    reader.readAsDataURL(file);
  });

  input.value = ''; // Reset so same file can be re-selected
}
window.handleImageUpload = handleImageUpload;

// ── REMOVE ONE IMAGE ──
function removeImage(index) {
  _pending.splice(index, 1);
  render();
}
window.removeImage = removeImage;

// ── CLEAR ALL ──
function clear() {
  _pending = [];
  render();
}

// ── RENDER PREVIEW ROW ──
function render() {
  const row = document.getElementById('imgPreviewRow');
  if (!row) return;

  if (_pending.length === 0) {
    row.style.display = 'none';
    row.innerHTML     = '';
    return;
  }

  row.style.display = 'flex';
  row.innerHTML = _pending.map((img, i) => `
    <div class="img-preview-item">
      <img src="${img.dataUrl}" alt="${img.name}" title="${img.name}"/>
      <button class="del-img" onclick="removeImage(${i})" title="Remove">✕</button>
    </div>
  `).join('');
}

// ── GET PENDING (called by chat.js) ──
function getPending() {
  return [..._pending];
}

export const Upload = {
  handleImageUpload,
  removeImage,
  clear,
  getPending,
  render,
};

window.Upload = Upload;
