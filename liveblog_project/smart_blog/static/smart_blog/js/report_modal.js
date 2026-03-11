(function () {
  'use strict';

  const modalEl = document.getElementById('reportModal');
  if (!modalEl) return;

  const reportUrl = modalEl.dataset.reportUrl;
  const reasonList = document.getElementById('reportReasonList');
  const details = document.getElementById('reportDetails');
  const submitBtn = document.getElementById('reportSubmitBtn');
  const feedback = document.getElementById('reportFeedback');

  const MIN_OTHER_CHARS = 2;
  const MAX_OTHER_CHARS = 300;

  function validateOtherDetails() {
    const text = (details?.value || '').trim();
    if (text.length < MIN_OTHER_CHARS) return { valid: false, msg: 'Minimum 2 characters' };
    if (text.length > MAX_OTHER_CHARS) return { valid: false, msg: 'Maximum 300 characters' };
    return { valid: true };
  }

  function toggleDetailsEnabled() {
    const isOther = selectedReasons.includes('other');
    if (details) {
      details.disabled = !isOther;
      if (!isOther) details.value = '';
    }
    if (!isOther) setFeedback('');
  }

  let targetType = null;
  let targetId = null;
  let selectedReasons = [];

  function setFeedback(text, isError = false, isSuccess = false) {
    if (!feedback) return;
    feedback.textContent = text || '';
    feedback.classList.toggle('text-danger', !!isError);
    feedback.classList.toggle('text-muted', !isError && !isSuccess);
    feedback.classList.toggle('report-feedback-success', !!isSuccess);
  }

  function resetForm() {
    selectedReasons = [];
    if (details) details.value = '';
    setFeedback('');
    reasonList?.querySelectorAll('.report-reason-btn')
      .forEach(btn => btn.classList.remove('is-selected'));
    toggleDetailsEnabled();
  }

  function openReportModal(type, id) {
    targetType = type;
    targetId = id;
    resetForm();
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  }

  function markTargetReported(type, id) {
    if (type === 'item') {
      const el = document.getElementById('item-reported-label');
      if (el) el.classList.remove('d-none');
    }
  }

  reasonList?.addEventListener('click', (e) => {
    const btn = e.target.closest('.report-reason-btn');
    if (!btn) return;
    const reason = btn.dataset.reason;
    if (!reason) return;
    if (reason === 'other') {
      if (selectedReasons.includes('other')) {
        selectedReasons = [];
        btn.classList.remove('is-selected');
      } else {
        selectedReasons = ['other'];
        reasonList.querySelectorAll('.report-reason-btn').forEach(b => b.classList.remove('is-selected'));
        btn.classList.add('is-selected');
      }
    } else {
      if (selectedReasons.includes('other')) {
        selectedReasons = selectedReasons.filter(r => r !== 'other');
        reasonList.querySelector('.report-reason-btn[data-reason="other"]')?.classList.remove('is-selected');
      }
      if (selectedReasons.includes(reason)) {
        selectedReasons = selectedReasons.filter(r => r !== reason);
        btn.classList.remove('is-selected');
      } else {
        selectedReasons.push(reason);
        btn.classList.add('is-selected');
      }
    }
    toggleDetailsEnabled();
    if (!selectedReasons.includes('other')) setFeedback('');
  });

  submitBtn?.addEventListener('click', async () => {
    if (!selectedReasons.length) {
      setFeedback('Please select a reason.', true);
      return;
    }
    if (selectedReasons.includes('other')) {
      const result = validateOtherDetails();
      if (!result.valid) {
        setFeedback(result.msg, true);
        return;
      }
    }
    if (!reportUrl || !targetType || !targetId) {
      setFeedback('Report target error.', true);
      return;
    }
    setFeedback('Sending...');
    submitBtn.disabled = true;

    try {
      const resp = await fetch(reportUrl, {
        method: 'POST',
        headers: {
          'X-CSRFToken': (document.cookie.split('; ').find(c => c.startsWith('csrftoken=')) || '').split('=')[1] || '',
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          target_type: targetType,
          target_id: targetId,
          reasons: selectedReasons,
          details: details.value || ''
        })
      });

      const data = await resp.json().catch(() => null);
      if (!resp.ok || !data?.success) {
        setFeedback(data?.error || 'Report failed.', true);
        return;
      }
      setFeedback('Report sent. Thank you', false, true);
      markTargetReported(targetType, targetId);
      setTimeout(() => {
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.hide();
      }, 500);
    } catch (err) {
      setFeedback('Network error.', true);
    } finally {
      submitBtn.disabled = false;
    }
  });

  document.addEventListener('click', (e) => {
    const itemBtn = e.target.closest('.item_report_btn');
    if (itemBtn) {
      e.preventDefault();
      const itemId = document.body.dataset.itemSlug || itemBtn.dataset.itemId;
      if (itemId && itemBtn.dataset.itemId) {
        openReportModal('item', itemBtn.dataset.itemId);
      } else if (itemBtn.dataset.itemId) {
        openReportModal('item', itemBtn.dataset.itemId);
      } else if (itemBtn.dataset.itemPk) {
        openReportModal('item', itemBtn.dataset.itemPk);
      } else if (itemBtn.dataset.targetId) {
        openReportModal('item', itemBtn.dataset.targetId);
      } else if (itemBtn.dataset.item) {
        openReportModal('item', itemBtn.dataset.item);
      } else {
        const el = document.getElementById('itemIdForReport');
        if (el) openReportModal('item', el.value);
      }
      return;
    }
  });

  window.addEventListener('comment-report', (e) => {
    const commentId = e?.detail?.commentId;
    if (!commentId) return;
    openReportModal('comment', commentId);
  });
})();
