// ---- 状態 ----
let frames = [];
let textLayers = [];
let selectedFrameId = null;
let outputSettings = {
  width: 320,
  height: 240,
  fit: 'contain',
  bgColor: '#ffffff',
  transparent: false,
};

let isPlaying = false;
let playIndex = 0;
let playTimer = null;

// ---- DOM参照 ----
const fileInput = document.getElementById('fileInput');
const sampleBtn = document.getElementById('sampleBtn');
const frameListEl = document.getElementById('frameList');
const bulkDurationInput = document.getElementById('bulkDuration');
const applyBulkDurationBtn = document.getElementById('applyBulkDuration');

const previewCanvas = document.getElementById('previewCanvas');
const playBtn = document.getElementById('playBtn');
const prevFrameBtn = document.getElementById('prevFrameBtn');
const nextFrameBtn = document.getElementById('nextFrameBtn');
const frameCounterEl = document.getElementById('frameCounter');

const exportBtn = document.getElementById('exportBtn');
const exportProgress = document.getElementById('exportProgress');
const resultWrap = document.getElementById('resultWrap');
const resultImg = document.getElementById('resultImg');
const downloadLink = document.getElementById('downloadLink');

const flipHBtn = document.getElementById('flipHBtn');
const flipVBtn = document.getElementById('flipVBtn');
const rotateBtn = document.getElementById('rotateBtn');
const grayscaleChk = document.getElementById('grayscaleChk');
const sepiaChk = document.getElementById('sepiaChk');
const invertChk = document.getElementById('invertChk');
const brightnessRange = document.getElementById('brightnessRange');
const contrastRange = document.getElementById('contrastRange');
const applyAllBtn = document.getElementById('applyAllBtn');

const textContent = document.getElementById('textContent');
const textX = document.getElementById('textX');
const textY = document.getElementById('textY');
const textSize = document.getElementById('textSize');
const textColor = document.getElementById('textColor');
const textOutlineChk = document.getElementById('textOutlineChk');
const addTextBtn = document.getElementById('addTextBtn');
const textListEl = document.getElementById('textList');

const outWidthInput = document.getElementById('outWidth');
const outHeightInput = document.getElementById('outHeight');
const matchSizeBtn = document.getElementById('matchSizeBtn');
const fitModeSelect = document.getElementById('fitMode');
const bgColorInput = document.getElementById('bgColor');
const transparentChk = document.getElementById('transparentChk');
const loopSelect = document.getElementById('loopSelect');
const qualityRange = document.getElementById('qualityRange');

const tabBtns = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');

// ---- ユーティリティ ----
function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function makeFrame(image, duration) {
  return {
    id: uid(),
    image,
    duration: duration ?? Number(bulkDurationInput.value) ?? 200,
    flipH: false,
    flipV: false,
    rotate: 0,
    grayscale: false,
    sepia: false,
    invert: false,
    brightness: 0,
    contrast: 0,
  };
}

function getSelectedFrame() {
  return frames.find((f) => f.id === selectedFrameId) || null;
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

async function importHandoffFrames() {
  const raw = sessionStorage.getItem('lipsyncHandoffFrames');
  if (!raw) return;
  sessionStorage.removeItem('lipsyncHandoffFrames');
  try {
    const payload = JSON.parse(raw);
    for (const item of payload) {
      const img = await loadImageFromDataUrl(item.dataUrl);
      const frame = makeFrame(img, item.duration);
      frames.push(frame);
      if (!selectedFrameId) selectedFrameId = frame.id;
    }
    renderFrameList();
    renderPreview();
  } catch (err) {
    console.error('口パクアニメの引き継ぎに失敗しました', err);
  }
}

// ---- サンプルフレーム生成（バウンドするボール） ----
function generateSampleFrames() {
  const steps = 8;
  const w = 200;
  const h = 150;
  const colors = ['#ff6b6b', '#ffd166', '#06d6a0', '#4ecdc4', '#5b8def'];
  for (let i = 0; i < steps; i++) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1c1e21';
    ctx.fillRect(0, 0, w, h);

    const t = i / steps;
    const bounce = Math.abs(Math.sin(t * Math.PI));
    const x = 30 + t * (w - 60);
    const y = h - 30 - bounce * (h - 60);

    ctx.fillStyle = colors[i % colors.length];
    ctx.beginPath();
    ctx.arc(x, y, 18, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(0, h - 12, w, 12);

    frames.push(makeFrame(canvas, 120));
  }
  if (!selectedFrameId && frames.length) selectedFrameId = frames[0].id;
  renderFrameList();
  renderPreview();
}

// ---- フレームリストUI ----
function renderFrameList() {
  frameListEl.innerHTML = '';
  frames.forEach((frame, index) => {
    const li = document.createElement('li');
    li.className = 'frame-item' + (frame.id === selectedFrameId ? ' selected' : '');
    li.draggable = true;
    li.dataset.id = frame.id;

    const indexEl = document.createElement('span');
    indexEl.className = 'frame-index';
    indexEl.textContent = index + 1;

    const thumb = document.createElement('img');
    thumb.src = frame.image.toDataURL ? frame.image.toDataURL() : frame.image.src;

    const durationInput = document.createElement('input');
    durationInput.type = 'number';
    durationInput.className = 'frame-duration';
    durationInput.min = '20';
    durationInput.max = '5000';
    durationInput.step = '10';
    durationInput.value = frame.duration;
    durationInput.addEventListener('change', () => {
      frame.duration = Math.max(20, Number(durationInput.value) || 200);
    });

    const actions = document.createElement('div');
    actions.className = 'frame-actions';

    const dupBtn = document.createElement('button');
    dupBtn.type = 'button';
    dupBtn.title = '複製';
    dupBtn.textContent = '⧉';
    dupBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const copy = { ...frame, id: uid() };
      frames.splice(index + 1, 0, copy);
      renderFrameList();
      renderPreview();
    });

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.title = '削除';
    delBtn.textContent = '🗑';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      frames.splice(index, 1);
      if (selectedFrameId === frame.id) {
        selectedFrameId = frames.length ? frames[0].id : null;
      }
      renderFrameList();
      renderPreview();
    });

    actions.append(dupBtn, delBtn);
    li.append(indexEl, thumb, durationInput, actions);

    li.addEventListener('click', () => {
      selectedFrameId = frame.id;
      syncTransformPanelFromSelection();
      renderFrameList();
    });

    li.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', frame.id);
      e.dataTransfer.effectAllowed = 'move';
    });
    li.addEventListener('dragover', (e) => {
      e.preventDefault();
      li.classList.add('drag-over');
    });
    li.addEventListener('dragleave', () => li.classList.remove('drag-over'));
    li.addEventListener('drop', (e) => {
      e.preventDefault();
      li.classList.remove('drag-over');
      const draggedId = e.dataTransfer.getData('text/plain');
      const fromIndex = frames.findIndex((f) => f.id === draggedId);
      const toIndex = frames.findIndex((f) => f.id === frame.id);
      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;
      const [moved] = frames.splice(fromIndex, 1);
      frames.splice(toIndex, 0, moved);
      renderFrameList();
      renderPreview();
    });

    frameListEl.appendChild(li);
  });

  frameCounterEl.textContent = `${frames.length ? playIndex + 1 : 0} / ${frames.length}`;
}

function syncTransformPanelFromSelection() {
  const frame = getSelectedFrame();
  if (!frame) return;
  grayscaleChk.checked = frame.grayscale;
  sepiaChk.checked = frame.sepia;
  invertChk.checked = frame.invert;
  brightnessRange.value = frame.brightness;
  contrastRange.value = frame.contrast;
}

// ---- 描画（プレビュー・書き出し共通） ----
function renderFrameToCanvas(frame, canvas) {
  canvas.width = outputSettings.width;
  canvas.height = outputSettings.height;
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = outputSettings.transparent ? '#00ff00' : outputSettings.bgColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const filters = [];
  if (frame.grayscale) filters.push('grayscale(1)');
  if (frame.sepia) filters.push('sepia(1)');
  if (frame.invert) filters.push('invert(1)');
  filters.push(`brightness(${1 + frame.brightness / 100})`);
  filters.push(`contrast(${1 + frame.contrast / 100})`);
  ctx.filter = filters.join(' ');

  const img = frame.image;
  const sw = img.naturalWidth || img.width;
  const sh = img.naturalHeight || img.height;
  const rotated = frame.rotate % 180 !== 0;
  const availW = rotated ? canvas.height : canvas.width;
  const availH = rotated ? canvas.width : canvas.height;

  let drawW, drawH;
  if (outputSettings.fit === 'stretch') {
    drawW = availW;
    drawH = availH;
  } else {
    const scale =
      outputSettings.fit === 'cover'
        ? Math.max(availW / sw, availH / sh)
        : Math.min(availW / sw, availH / sh);
    drawW = sw * scale;
    drawH = sh * scale;
  }

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((frame.rotate * Math.PI) / 180);
  ctx.scale(frame.flipH ? -1 : 1, frame.flipV ? -1 : 1);
  ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.restore();

  textLayers.forEach((t) => {
    ctx.font = `bold ${t.size}px "Hiragino Sans", "Yu Gothic", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const x = (t.x / 100) * canvas.width;
    const y = (t.y / 100) * canvas.height;
    if (t.outline) {
      ctx.lineWidth = Math.max(2, t.size / 8);
      ctx.strokeStyle = '#000000';
      ctx.strokeText(t.text, x, y);
    }
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, x, y);
  });
}

function renderPreview() {
  if (!frames.length) {
    const ctx = previewCanvas.getContext('2d');
    previewCanvas.width = outputSettings.width;
    previewCanvas.height = outputSettings.height;
    ctx.fillStyle = '#eee';
    ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
    frameCounterEl.textContent = '0 / 0';
    return;
  }
  if (playIndex >= frames.length) playIndex = 0;
  renderFrameToCanvas(frames[playIndex], previewCanvas);
  frameCounterEl.textContent = `${playIndex + 1} / ${frames.length}`;
}

// ---- 再生 ----
function stopPlayback() {
  isPlaying = false;
  playBtn.textContent = '▶ 再生';
  if (playTimer) clearTimeout(playTimer);
  playTimer = null;
}

function startPlayback() {
  if (!frames.length) return;
  isPlaying = true;
  playBtn.textContent = '⏸ 一時停止';
  const step = () => {
    if (!isPlaying) return;
    renderPreview();
    const delay = frames[playIndex].duration;
    playIndex = (playIndex + 1) % frames.length;
    playTimer = setTimeout(step, delay);
  };
  step();
}

playBtn.addEventListener('click', () => {
  if (isPlaying) stopPlayback();
  else startPlayback();
});

prevFrameBtn.addEventListener('click', () => {
  stopPlayback();
  if (!frames.length) return;
  playIndex = (playIndex - 1 + frames.length) % frames.length;
  renderPreview();
});

nextFrameBtn.addEventListener('click', () => {
  stopPlayback();
  if (!frames.length) return;
  playIndex = (playIndex + 1) % frames.length;
  renderPreview();
});

// ---- フレーム追加 ----
fileInput.addEventListener('change', async () => {
  const files = Array.from(fileInput.files || []);
  for (const file of files) {
    try {
      const img = await loadImageFromFile(file);
      const frame = makeFrame(img);
      frames.push(frame);
      if (!selectedFrameId) selectedFrameId = frame.id;
    } catch (err) {
      console.error('画像の読み込みに失敗しました', err);
    }
  }
  fileInput.value = '';
  renderFrameList();
  renderPreview();
});

sampleBtn.addEventListener('click', generateSampleFrames);

applyBulkDurationBtn.addEventListener('click', () => {
  const value = Math.max(20, Number(bulkDurationInput.value) || 200);
  frames.forEach((f) => (f.duration = value));
  renderFrameList();
});

// ---- 変形・フィルター ----
flipHBtn.addEventListener('click', () => {
  const frame = getSelectedFrame();
  if (!frame) return;
  frame.flipH = !frame.flipH;
  renderPreview();
  renderFrameList();
});

flipVBtn.addEventListener('click', () => {
  const frame = getSelectedFrame();
  if (!frame) return;
  frame.flipV = !frame.flipV;
  renderPreview();
  renderFrameList();
});

rotateBtn.addEventListener('click', () => {
  const frame = getSelectedFrame();
  if (!frame) return;
  frame.rotate = (frame.rotate + 90) % 360;
  renderPreview();
  renderFrameList();
});

[grayscaleChk, sepiaChk, invertChk, brightnessRange, contrastRange].forEach((el) => {
  el.addEventListener('input', () => {
    const frame = getSelectedFrame();
    if (!frame) return;
    frame.grayscale = grayscaleChk.checked;
    frame.sepia = sepiaChk.checked;
    frame.invert = invertChk.checked;
    frame.brightness = Number(brightnessRange.value);
    frame.contrast = Number(contrastRange.value);
    renderPreview();
  });
});

applyAllBtn.addEventListener('click', () => {
  const frame = getSelectedFrame();
  if (!frame) return;
  frames.forEach((f) => {
    f.grayscale = frame.grayscale;
    f.sepia = frame.sepia;
    f.invert = frame.invert;
    f.brightness = frame.brightness;
    f.contrast = frame.contrast;
    f.flipH = frame.flipH;
    f.flipV = frame.flipV;
    f.rotate = frame.rotate;
  });
  renderPreview();
});

// ---- テキストレイヤー ----
function renderTextList() {
  textListEl.innerHTML = '';
  textLayers.forEach((t, i) => {
    const li = document.createElement('li');
    const label = document.createElement('span');
    label.textContent = `"${t.text}" (${t.x}%, ${t.y}%)`;
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.textContent = '削除';
    delBtn.addEventListener('click', () => {
      textLayers.splice(i, 1);
      renderTextList();
      renderPreview();
    });
    li.append(label, delBtn);
    textListEl.appendChild(li);
  });
}

addTextBtn.addEventListener('click', () => {
  const text = textContent.value.trim();
  if (!text) return;
  textLayers.push({
    text,
    x: Number(textX.value) || 50,
    y: Number(textY.value) || 85,
    size: Number(textSize.value) || 28,
    color: textColor.value,
    outline: textOutlineChk.checked,
  });
  textContent.value = '';
  renderTextList();
  renderPreview();
});

// ---- 出力設定 ----
function applyOutputSettingsFromForm() {
  outputSettings.width = Math.max(16, Number(outWidthInput.value) || 320);
  outputSettings.height = Math.max(16, Number(outHeightInput.value) || 240);
  outputSettings.fit = fitModeSelect.value;
  outputSettings.bgColor = bgColorInput.value;
  outputSettings.transparent = transparentChk.checked;
  renderPreview();
}

[outWidthInput, outHeightInput, fitModeSelect, bgColorInput, transparentChk].forEach((el) => {
  el.addEventListener('change', applyOutputSettingsFromForm);
  el.addEventListener('input', applyOutputSettingsFromForm);
});

matchSizeBtn.addEventListener('click', () => {
  const frame = frames[0];
  if (!frame) return;
  outWidthInput.value = frame.image.naturalWidth || frame.image.width;
  outHeightInput.value = frame.image.naturalHeight || frame.image.height;
  applyOutputSettingsFromForm();
});

// ---- タブ切り替え ----
tabBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    tabBtns.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const target = btn.dataset.tab;
    tabPanels.forEach((panel) => {
      panel.classList.toggle('hidden', panel.dataset.tabPanel !== target);
    });
  });
});

// ---- GIF書き出し ----
exportBtn.addEventListener('click', async () => {
  if (!frames.length) {
    alert('フレームがありません。画像を追加するかサンプルフレームを生成してください。');
    return;
  }
  if (typeof GIF === 'undefined') {
    alert('GIF生成ライブラリの読み込みに失敗しました。通信環境を確認してください。');
    return;
  }

  stopPlayback();
  exportBtn.disabled = true;
  exportProgress.hidden = false;
  exportProgress.value = 0;
  resultWrap.hidden = true;

  try {
    const gif = new GIF({
      workers: 2,
      quality: Number(qualityRange.value),
      width: outputSettings.width,
      height: outputSettings.height,
      workerScript: 'vendor/gif.worker.js',
      repeat: Number(loopSelect.value),
      transparent: outputSettings.transparent ? 0x00ff00 : null,
      background: outputSettings.bgColor,
    });

    const offscreen = document.createElement('canvas');
    frames.forEach((frame) => {
      renderFrameToCanvas(frame, offscreen);
      gif.addFrame(offscreen, { delay: frame.duration, copy: true });
    });

    gif.on('progress', (p) => {
      exportProgress.value = Math.round(p * 100);
    });

    gif.on('finished', (blob) => {
      const url = URL.createObjectURL(blob);
      resultImg.src = url;
      downloadLink.href = url;
      downloadLink.download = `anigif-${Date.now()}.gif`;
      resultWrap.hidden = false;
      exportProgress.hidden = true;
      exportBtn.disabled = false;
    });

    gif.render();
  } catch (err) {
    console.error(err);
    alert('GIFの生成に失敗しました: ' + err.message);
    exportProgress.hidden = true;
    exportBtn.disabled = false;
  }
});

// ---- 初期化 ----
renderFrameList();
renderTextList();
renderPreview();
importHandoffFrames();
