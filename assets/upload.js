(function () {
  'use strict';

  var config = window.JOY_HOMEWORK_CONFIG || {};
  var form = document.getElementById('pdf-upload-form');
  var input = document.getElementById('pdf-files');
  var picker = document.getElementById('file-picker');
  var list = document.getElementById('file-list');
  var note = document.getElementById('upload-note');
  var button = document.getElementById('upload-button');
  var status = document.getElementById('upload-status');
  var MAX_FILES = 3;
  var MAX_TOTAL_BYTES = 10 * 1024 * 1024;

  if (!form || !input) return;

  input.addEventListener('change', renderFiles);
  picker.addEventListener('dragover', function (event) {
    event.preventDefault();
    picker.classList.add('is-dragging');
  });
  picker.addEventListener('dragleave', function () { picker.classList.remove('is-dragging'); });
  picker.addEventListener('drop', function () { picker.classList.remove('is-dragging'); });
  form.addEventListener('submit', submitFiles);

  function selectedFiles() { return Array.from(input.files || []); }

  function renderFiles() {
    var files = selectedFiles();
    list.innerHTML = '';
    files.forEach(function (file) {
      var row = document.createElement('div');
      row.className = 'file-item';
      row.innerHTML = '<span>' + escapeHtml(file.name) + '</span><span>' + formatBytes(file.size) + '</span>';
      list.appendChild(row);
    });
    if (!files.length) {
      setStatus('No files selected yet.', '');
      return;
    }
    var validation = validate(files);
    setStatus(validation || files.length + ' PDF file' + (files.length === 1 ? '' : 's') + ' ready to upload.', validation ? 'error' : '');
  }

  async function submitFiles(event) {
    event.preventDefault();
    var files = selectedFiles();
    var validation = validate(files);
    if (validation) {
      setStatus(validation, 'error');
      return;
    }
    if (!config.submissionEndpoint) {
      setStatus('The private upload connection is not active yet. Your files have not been sent.', 'error');
      return;
    }

    button.disabled = true;
    button.textContent = 'Preparing PDFs…';
    setStatus('Preparing your files for private upload. Keep this page open.', '');

    try {
      var encodedFiles = [];
      for (var i = 0; i < files.length; i += 1) {
        encodedFiles.push({
          name: files[i].name,
          type: 'application/pdf',
          size: files[i].size,
          data: await readBase64(files[i])
        });
      }

      var payload = {
        action: 'uploadPdf',
        uploadId: createId(),
        studentName: 'Joy',
        classDate: '2026-07-15',
        classLabel: 'Class 12 — Command of Evidence',
        note: note.value.trim(),
        files: encodedFiles
      };

      button.textContent = 'Uploading…';
      var response = await fetch(config.submissionEndpoint, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
      if (response.type !== 'opaque' && !response.ok) throw new Error('Upload failed');

      form.reset();
      list.innerHTML = '';
      button.textContent = 'PDFs uploaded';
      setStatus('Upload request sent successfully. Tina can now review your PDFs.', 'success');
    } catch (error) {
      button.disabled = false;
      button.textContent = 'Try uploading again';
      setStatus('The files could not be sent. Please keep them on this device and try again.', 'error');
    }
  }

  function validate(files) {
    if (!files.length) return 'Choose at least one PDF before uploading.';
    if (files.length > MAX_FILES) return 'Choose no more than three PDF files at one time.';
    if (files.some(function (file) { return file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name); })) return 'Only PDF files can be uploaded here.';
    var total = files.reduce(function (sum, file) { return sum + file.size; }, 0);
    if (total > MAX_TOTAL_BYTES) return 'The selected PDFs are larger than 10 MB in total. Upload fewer or smaller files.';
    return '';
  }

  function readBase64(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result).split(',')[1]); };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return 'upload-' + Date.now() + '-' + Math.random().toString(16).slice(2);
  }

  function formatBytes(bytes) {
    if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function setStatus(message, type) {
    status.textContent = message;
    status.classList.toggle('is-error', type === 'error');
    status.classList.toggle('is-success', type === 'success');
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character];
    });
  }
}());
