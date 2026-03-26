(function () {
  document.addEventListener('DOMContentLoaded', function () {
    var input = document.querySelector('[data-topics-filter-input]');
    var grid = document.getElementById('topicsAllGrid');
    var featuredRow = document.querySelector('.topics-featured-row');
    var featuredSec = document.getElementById('topicsFeaturedSection');
    var allSec = document.getElementById('topicsAllSection');
    var emptyMsg = document.getElementById('topicsFilterEmpty');
    if (!input) return;
    if (!featuredRow && !grid) return;

    function countFeaturedMatches(q) {
      if (!featuredRow) return { visible: 0 };
      var cols = featuredRow.querySelectorAll(':scope > div');
      var visible = 0;
      cols.forEach(function (col) {
        var card = col.querySelector('.topic-tile');
        var hay = card ? (card.getAttribute('data-search-text') || '') : '';
        var show = !q || hay.indexOf(q) !== -1;
        col.classList.toggle('d-none', !show);
        if (show) visible += 1;
      });
      return { visible: visible };
    }

    function countAllMatches(q) {
      if (!grid) return { visible: 0 };
      var cols = grid.querySelectorAll('.topics-grid-col');
      var visible = 0;
      cols.forEach(function (col) {
        var card = col.querySelector('.topic-tile');
        var hay = card ? (card.getAttribute('data-search-text') || '') : '';
        var show = !q || hay.indexOf(q) !== -1;
        col.classList.toggle('d-none', !show);
        if (show) visible += 1;
      });
      return { visible: visible };
    }

    function run() {
      var q = (input.value || '').trim().toLowerCase();
      var feat = countFeaturedMatches(q);
      var all = countAllMatches(q);
      var total = feat.visible + all.visible;

      if (!q) {
        if (emptyMsg) emptyMsg.classList.add('d-none');
        if (featuredSec) featuredSec.classList.remove('d-none');
        if (allSec) allSec.classList.remove('d-none');
        var fh = document.getElementById('topicsFeaturedHeading');
        var ah = document.getElementById('topicsAllHeading');
        if (fh) fh.classList.remove('d-none');
        if (ah) ah.classList.remove('d-none');
        return;
      }

      if (total === 0) {
        if (featuredSec) featuredSec.classList.add('d-none');
        if (allSec) allSec.classList.add('d-none');
        if (emptyMsg) emptyMsg.classList.remove('d-none');
        return;
      }

      if (emptyMsg) emptyMsg.classList.add('d-none');

      if (featuredSec) {
        if (feat.visible === 0) featuredSec.classList.add('d-none');
        else featuredSec.classList.remove('d-none');
      }

      if (allSec) {
        if (all.visible === 0) allSec.classList.add('d-none');
        else allSec.classList.remove('d-none');
      }
    }

    input.addEventListener('input', run);
    input.addEventListener('change', run);
  });
})();
