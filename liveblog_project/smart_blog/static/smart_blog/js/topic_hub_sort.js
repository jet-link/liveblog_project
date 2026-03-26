(function () {
  'use strict';

  function buildPartialUrl(base, sort) {
    var u = base.indexOf('?') >= 0 ? base + '&' : base + '?';
    u += 'partial=1';
    if (sort && sort !== 'latest') {
      u += '&sort=' + encodeURIComponent(sort);
    }
    return u;
  }

  function replaceTopicFeed(html) {
    var root = document.getElementById('topicHubFeedRoot');
    var wrap = document.getElementById('filterCardsWrapper');
    if (!root || !wrap) return;
    wrap.classList.add('filter-cards-fade-out');
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        root.innerHTML = html;
        wrap.classList.remove('filter-cards-fade-out');
        wrap.classList.add('filter-cards-fade-in');
        wrap.offsetHeight;
        wrap.classList.remove('filter-cards-fade-in');
        if (window.initFilterCardsPagination) window.initFilterCardsPagination();
      });
    });
  }

  function setSelectedSort(sort) {
    document.querySelectorAll('.topic-sort-btn').forEach(function (btn) {
      btn.classList.toggle('is-selected', (btn.dataset.sort || '') === sort);
    });
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.topic-sort-btn');
    if (!btn || !document.getElementById('topicHubFeedRoot')) return;
    e.preventDefault();

    var sort = btn.dataset.sort || 'latest';
    var base = btn.dataset.topicBase || '';
    if (!base) return;

    var url = buildPartialUrl(base.replace(/\/?$/, '/'), sort);
    var reqId = (replaceTopicFeed._reqId = (replaceTopicFeed._reqId || 0) + 1);

    fetch(url, {
      credentials: 'same-origin',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      cache: 'no-store',
    })
      .then(function (r) {
        if (!r.ok) throw new Error('topic feed');
        return r.text();
      })
      .then(function (html) {
        if (reqId !== replaceTopicFeed._reqId) return;
        replaceTopicFeed(html);
        setSelectedSort(sort);
        try {
          var path = base.replace(/\/?$/, '/');
          var qs = sort === 'latest' ? '' : '?sort=' + encodeURIComponent(sort);
          window.history.replaceState({}, '', path + qs);
        } catch (err) { /* ignore */ }
      })
      .catch(function () {
        window.location.href = base + (sort === 'latest' ? '' : '?sort=' + encodeURIComponent(sort));
      });
  });
})();
