// ---- 状態 ----
let baseImage = null;
let baseW = 320;
let baseH = 320;
let shapes = []; // { id, label, image }
let mouthPos = { x: 50, y: 70, width: 25 };
let generatedFrames = []; // { shapeIndex, duration }
let audioEnergies = null; // Float array from analyzed audio
let audioFrameMs = 80;

let isPlaying = false;
let playIndex = 0;
let playTimer = null;

// ---- DOM ----
const baseImageInput = document.getElementById('baseImageInput');
const baseImageStatus = document.getElementById('baseImageStatus');
const addShapeBtn = document.getElementById('addShapeBtn');
const shapeListEl = document.getElementById('shapeList');

const previewCanvas = document.getElementById('previewCanvas');
const posXInput = document.getElementById('posX');
const posYInput = document.getElementById('posY');
const posWidthInput = document.getElementById('posWidth');
const playBtn = document.getElementById('playBtn');
const frameCounterEl = document.getElementById('frameCounter');

const tabBtns = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');

const patternMode = document.getElementById('patternMode');
const frameMsInput = document.getElementById('frameMsInput');
const durationInput = document.getElementById('durationInput');
const generateAutoBtn = document.getElementById('generateAutoBtn');

const audioInput = document.getElementById('audioInput');
const audioStatus = document.getElementById('audioStatus');
const audioFrameMsInput = document.getElementById('audioFrameMsInput');
const sensitivityRange = document.getElementById('sensitivityRange');
const generateAudioBtn = document.getElementById('generateAudioBtn');

const exportBtn = document.getElementById('exportBtn');
const handoffBtn = document.getElementById('handoffBtn');
const exportProgress = document.getElementById('exportProgress');
const resultWrap = document.getElementById('resultWrap');
const resultImg = document.getElementById('resultImg');
const downloadLink = document.getElementById('downloadLink');

// ---- ユーティリティ ----
function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
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

function updateActionButtonsState() {
  const ready = !!baseImage && shapes.filter((s) => s.image).length >= 2;
  generateAutoBtn.disabled = !ready;
  generateAudioBtn.disabled = !ready || !audioEnergies;
  const hasFrames = generatedFrames.length > 0;
  exportBtn.disabled = !hasFrames;
  handoffBtn.disabled = !hasFrames;
  playBtn.disabled = !hasFrames;
}

// ---- ベース画像 ----
baseImageInput.addEventListener('change', async () => {
  const file = baseImageInput.files[0];
  if (!file) return;
  const img = await loadImageFromFile(file);
  baseImage = img;
  baseW = img.naturalWidth;
  baseH = img.naturalHeight;
  baseImageStatus.textContent = `${file.name}（${baseW}×${baseH}）`;
  renderCurrentPreview();
  updateActionButtonsState();
});

// ---- 口の形リスト ----
function addShape(label) {
  shapes.push({ id: uid(), label: label ?? (shapes.length === 0 ? '閉じ' : shapes.length === 1 ? '開き' : `形${shapes.length + 1}`), image: null });
  renderShapeList();
  updateActionButtonsState();
}

function renderShapeList() {
  shapeListEl.innerHTML = '';
  shapes.forEach((shape, index) => {
    const li = document.createElement('li');
    li.className = 'shape-item';
    li.draggable = true;
    li.dataset.id = shape.id;

    const thumb = document.createElement('img');
    thumb.className = 'shape-thumb';
    if (shape.image) thumb.src = shape.image.src;

    const labelInput = document.createElement('input');
    labelInput.type = 'text';
    labelInput.value = shape.label;
    labelInput.maxLength = 12;
    labelInput.addEventListener('change', () => {
      shape.label = labelInput.value || shape.label;
    });

    const fileBtn = document.createElement('label');
    fileBtn.className = 'file-btn shape-file-btn';
    fileBtn.textContent = shape.image ? '変更' : '画像選択';
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.hidden = true;
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files[0];
      if (!file) return;
      shape.image = await loadImageFromFile(file);
      renderShapeList();
      renderCurrentPreview();
      updateActionButtonsState();
    });
    fileBtn.appendChild(fileInput);

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'shape-del';
    delBtn.textContent = '🗑';
    delBtn.title = '削除';
    delBtn.addEventListener('click', () => {
      shapes.splice(index, 1);
      renderShapeList();
      updateActionButtonsState();
    });

    li.append(thumb, labelInput, fileBtn, delBtn);

    li.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', shape.id);
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
      const fromIndex = shapes.findIndex((s) => s.id === draggedId);
      const toIndex = shapes.findIndex((s) => s.id === shape.id);
      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;
      const [moved] = shapes.splice(fromIndex, 1);
      shapes.splice(toIndex, 0, moved);
      renderShapeList();
    });

    shapeListEl.appendChild(li);
  });
}

addShapeBtn.addEventListener('click', () => addShape());

// ---- 位置調整 ----
function renderCurrentPreview() {
  const shape = generatedFrames.length
    ? shapes[generatedFrames[playIndex]?.shapeIndex]
    : shapes.find((s) => s.image);
  renderComposite(shape ? shape.image : null, previewCanvas);
  frameCounterEl.textContent = `${generatedFrames.length ? playIndex + 1 : 0} / ${generatedFrames.length}`;
}

function renderComposite(mouthImage, canvas) {
  canvas.width = baseW;
  canvas.height = baseH;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (baseImage) {
    ctx.drawImage(baseImage, 0, 0, canvas.width, canvas.height);
  } else {
    ctx.fillStyle = '#eee';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  if (mouthImage) {
    const mw = (mouthPos.width / 100) * canvas.width;
    const mh = mw * (mouthImage.naturalHeight / mouthImage.naturalWidth);
    const mx = (mouthPos.x / 100) * canvas.width - mw / 2;
    const my = (mouthPos.y / 100) * canvas.height - mh / 2;
    ctx.drawImage(mouthImage, mx, my, mw, mh);
  }
}

function syncPosInputs() {
  posXInput.value = Math.round(mouthPos.x);
  posYInput.value = Math.round(mouthPos.y);
  posWidthInput.value = Math.round(mouthPos.width);
}

[posXInput, posYInput, posWidthInput].forEach((el) => {
  el.addEventListener('input', () => {
    mouthPos.x = clamp(Number(posXInput.value) || 0, 0, 100);
    mouthPos.y = clamp(Number(posYInput.value) || 0, 0, 100);
    mouthPos.width = clamp(Number(posWidthInput.value) || 1, 2, 100);
    renderCurrentPreview();
  });
});

let dragging = false;
function updatePosFromEvent(e) {
  const rect = previewCanvas.getBoundingClientRect();
  mouthPos.x = clamp(((e.clientX - rect.left) / rect.width) * 100, 0, 100);
  mouthPos.y = clamp(((e.clientY - rect.top) / rect.height) * 100, 0, 100);
  syncPosInputs();
  renderCurrentPreview();
}

previewCanvas.addEventListener('pointerdown', (e) => {
  dragging = true;
  updatePosFromEvent(e);
});
window.addEventListener('pointermove', (e) => {
  if (dragging) updatePosFromEvent(e);
});
window.addEventListener('pointerup', () => {
  dragging = false;
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

// ---- パターン生成（オート） ----
function generateAlternateFrames(shapeCount, frameMs, totalSeconds) {
  const totalFrames = Math.max(2, Math.round((totalSeconds * 1000) / frameMs));
  const frames = [];
  const cycle = Math.max(1, (shapeCount - 1) * 2);
  for (let i = 0; i < totalFrames; i++) {
    let idx;
    if (shapeCount <= 2) {
      idx = i % 2 === 0 ? 0 : shapeCount - 1;
    } else {
      const pos = i % cycle;
      idx = pos < shapeCount ? pos : cycle - pos;
    }
    frames.push({ shapeIndex: idx, duration: frameMs });
  }
  return frames;
}

function generateRandomFrames(shapeCount, frameMs, totalSeconds) {
  const totalFrames = Math.max(2, Math.round((totalSeconds * 1000) / frameMs));
  const frames = [];
  let pauseRemaining = 0;
  for (let i = 0; i < totalFrames; i++) {
    if (pauseRemaining > 0) {
      frames.push({ shapeIndex: 0, duration: frameMs });
      pauseRemaining--;
      continue;
    }
    if (Math.random() < 0.08) {
      pauseRemaining = 2 + Math.floor(Math.random() * 3);
      frames.push({ shapeIndex: 0, duration: frameMs });
      continue;
    }
    const idx = shapeCount > 1 ? 1 + Math.floor(Math.random() * (shapeCount - 1)) : 0;
    frames.push({ shapeIndex: idx, duration: frameMs });
  }
  return frames;
}

generateAutoBtn.addEventListener('click', () => {
  const validShapes = shapes.filter((s) => s.image);
  if (!baseImage || validShapes.length < 2) return;
  const frameMs = Math.max(40, Number(frameMsInput.value) || 150);
  const totalSeconds = Math.max(0.5, Number(durationInput.value) || 3);
  generatedFrames =
    patternMode.value === 'random'
      ? generateRandomFrames(shapes.length, frameMs, totalSeconds)
      : generateAlternateFrames(shapes.length, frameMs, totalSeconds);
  playIndex = 0;
  renderCurrentPreview();
  updateActionButtonsState();
});

// ---- パターン生成（音声） ----
async function analyzeAudioFile(file, frameMs) {
  const arrayBuffer = await file.arrayBuffer();
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const audioCtx = new AudioCtx();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  const samplesPerFrame = Math.max(1, Math.floor((sampleRate * frameMs) / 1000));
  const energies = [];
  for (let i = 0; i < channelData.length; i += samplesPerFrame) {
    const end = Math.min(i + samplesPerFrame, channelData.length);
    let sum = 0;
    for (let j = i; j < end; j++) sum += channelData[j] * channelData[j];
    energies.push(Math.sqrt(sum / (end - i)));
  }
  audioCtx.close();
  return energies;
}

audioInput.addEventListener('change', async () => {
  const file = audioInput.files[0];
  if (!file) return;
  audioStatus.textContent = '解析中...';
  audioFrameMs = Math.max(40, Number(audioFrameMsInput.value) || 80);
  try {
    audioEnergies = await analyzeAudioFile(file, audioFrameMs);
    audioStatus.textContent = `${file.name}（${audioEnergies.length}コマ分を検出）`;
  } catch (err) {
    console.error(err);
    audioEnergies = null;
    audioStatus.textContent = '音声の解析に失敗しました。別のファイルをお試しください。';
  }
  updateActionButtonsState();
});

function generateFramesFromAudio(energies, frameMs, shapeCount, sensitivity) {
  const max = Math.max(...energies, 1e-6);
  const silenceThreshold = 0.35 * (1 - sensitivity) + 0.03;
  return energies.map((e) => {
    const norm = Math.min(1, e / max);
    if (norm < silenceThreshold) return { shapeIndex: 0, duration: frameMs };
    const bucket = Math.min(shapeCount - 1, 1 + Math.floor(norm * (shapeCount - 1)));
    return { shapeIndex: bucket, duration: frameMs };
  });
}

generateAudioBtn.addEventListener('click', () => {
  const validShapes = shapes.filter((s) => s.image);
  if (!baseImage || validShapes.length < 2 || !audioEnergies) return;
  const sensitivity = Number(sensitivityRange.value);
  generatedFrames = generateFramesFromAudio(audioEnergies, audioFrameMs, shapes.length, sensitivity);
  playIndex = 0;
  renderCurrentPreview();
  updateActionButtonsState();
});

// ---- 再生 ----
function stopPlayback() {
  isPlaying = false;
  playBtn.textContent = '▶ 再生';
  if (playTimer) clearTimeout(playTimer);
  playTimer = null;
}

function startPlayback() {
  if (!generatedFrames.length) return;
  isPlaying = true;
  playBtn.textContent = '⏸ 一時停止';
  const step = () => {
    if (!isPlaying) return;
    renderCurrentPreview();
    const delay = generatedFrames[playIndex].duration;
    playIndex = (playIndex + 1) % generatedFrames.length;
    playTimer = setTimeout(step, delay);
  };
  step();
}

playBtn.addEventListener('click', () => {
  if (isPlaying) stopPlayback();
  else startPlayback();
});

// ---- GIF書き出し ----
exportBtn.addEventListener('click', () => {
  if (!generatedFrames.length || typeof GIF === 'undefined') return;
  stopPlayback();
  exportBtn.disabled = true;
  exportProgress.hidden = false;
  exportProgress.value = 0;
  resultWrap.hidden = true;

  try {
    const gif = new GIF({
      workers: 2,
      quality: 10,
      width: baseW,
      height: baseH,
      workerScript: '../vendor/gif.worker.js',
      repeat: 0,
      background: '#ffffff',
    });

    const offscreen = document.createElement('canvas');
    generatedFrames.forEach((f) => {
      renderComposite(shapes[f.shapeIndex]?.image, offscreen);
      gif.addFrame(offscreen, { delay: f.duration, copy: true });
    });

    gif.on('progress', (p) => {
      exportProgress.value = Math.round(p * 100);
    });

    gif.on('finished', (blob) => {
      const url = URL.createObjectURL(blob);
      resultImg.src = url;
      downloadLink.href = url;
      downloadLink.download = `lipsync-${Date.now()}.gif`;
      resultWrap.hidden = false;
      exportProgress.hidden = true;
      updateActionButtonsState();
    });

    gif.render();
  } catch (err) {
    console.error(err);
    alert('GIFの生成に失敗しました: ' + err.message);
    exportProgress.hidden = true;
    updateActionButtonsState();
  }
});

// ---- GIFエディタへの引き継ぎ ----
handoffBtn.addEventListener('click', () => {
  if (!generatedFrames.length) return;
  const offscreen = document.createElement('canvas');
  const payload = generatedFrames.map((f) => {
    renderComposite(shapes[f.shapeIndex]?.image, offscreen);
    return { dataUrl: offscreen.toDataURL('image/png'), duration: f.duration };
  });
  sessionStorage.setItem('lipsyncHandoffFrames', JSON.stringify(payload));
  location.href = '../index.html';
});

// ---- 初期化 ----
addShape('閉じ');
addShape('開き');
renderCurrentPreview();
updateActionButtonsState();
