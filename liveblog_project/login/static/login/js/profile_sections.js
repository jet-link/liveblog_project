(function () {
    'use strict';

    function isMobile() {
        return window.matchMedia('(max-width: 768px)').matches;
    }

    function setupHorizontalScroll(section) {
        const container = section.querySelector('[data-scroll-container]');
        const prevBtn = section.querySelector('[data-scroll-prev]');
        const nextBtn = section.querySelector('[data-scroll-next]');
        const viewAll = section.querySelector('[data-scroll-viewall]');
        if (!container || !prevBtn || !nextBtn) return;

        const row = container.querySelector('.row');
        const totalCount = parseInt(section.dataset.count || '0', 10);

        const getGap = () => {
            if (!row) return 0;
            const styles = window.getComputedStyle(row);
            const gap = parseFloat(styles.columnGap || styles.gap || '0');
            return Number.isNaN(gap) ? 0 : gap;
        };

        const getCardWidth = () => {
            const card = container.querySelector('.item-card');
            return card ? card.getBoundingClientRect().width : 0;
        };

        const getStep = () => {
            const w = getCardWidth();
            if (!w) return container.clientWidth;
            const perView = isMobile() ? 1 : 2;
            return (w + getGap()) * perView;
        };

        const getIndex = () => {
            const step = getStep();
            if (!step) return 0;
            return Math.round(container.scrollLeft / step);
        };

        const getMaxIndex = () => {
            const step = getStep();
            if (!step) return 0;
            const maxScroll = Math.max(0, container.scrollWidth - container.clientWidth);
            return Math.max(0, Math.round(maxScroll / step));
        };

        const scrollToIndex = (nextIndex) => {
            const step = getStep();
            if (!step) return;
            const maxIndex = getMaxIndex();
            const clamped = Math.max(0, Math.min(maxIndex, nextIndex));
            container.scrollTo({ left: clamped * step, behavior: 'smooth' });
        };

        const updateControls = () => {
            const step = getStep();
            const maxScroll = Math.max(0, container.scrollWidth - container.clientWidth);
            const atStart = container.scrollLeft <= 1;
            const atEnd = container.scrollLeft >= (maxScroll - 1);
            const index = getIndex();
            const perView = isMobile() ? 1 : 2;
            const maxPreviewIndex = Math.max(0, 10 - perView);

            prevBtn.disabled = atStart;

            if (!Number.isNaN(totalCount) && totalCount > 10 && index >= maxPreviewIndex) {
                nextBtn.classList.add('d-none');
                if (viewAll) viewAll.classList.remove('d-none');
            } else {
                nextBtn.classList.remove('d-none');
                if (viewAll) viewAll.classList.add('d-none');
                nextBtn.disabled = atEnd;
            }

            if (Number.isNaN(totalCount) || totalCount <= 10) {
                if (viewAll) viewAll.classList.add('d-none');
            }
        };

        prevBtn.addEventListener('click', () => {
            scrollToIndex(getIndex() - 1);
        });

        nextBtn.addEventListener('click', () => {
            scrollToIndex(getIndex() + 1);
        });

        container.addEventListener('scroll', () => {
            window.requestAnimationFrame(updateControls);
        });

        window.addEventListener('resize', () => {
            scrollToIndex(getIndex());
            updateControls();
        });
        setTimeout(() => {
            scrollToIndex(getIndex());
            updateControls();
        }, 60);

        section.__updateControls = updateControls;
        section.__scrollToIndex = scrollToIndex;
    }

    function setListingState(anchorId) {
        try {
            sessionStorage.setItem('listing_url', location.pathname + location.search);
            sessionStorage.setItem('listing_scroll', String(window.scrollY || 0));
            if (anchorId) {
                sessionStorage.setItem('listing_anchor', anchorId);
            }
        } catch { }
    }

    function setupSectionTabs() {
        const tabs = Array.from(document.querySelectorAll('.profile-section-tab'));
        if (!tabs.length) return;

        const sections = tabs.map(btn => {
            const id = btn.dataset.sectionTarget;
            return { btn, section: id ? document.getElementById(id) : null };
        }).filter(x => x.section);

        const track = document.querySelector('.profile-sections-track');
        if (!track) return;

        function setActive(btn) {
            tabs.forEach(b => b.classList.remove('success_'));
            if (btn) btn.classList.add('success_');
        }

        function showSection(target, resetIndex = false) {
            const index = sections.findIndex(s => s.section === target);
            if (index < 0) return;
            const ctx = sections[index].section;
            sections.forEach(({ section }) => {
                section.classList.toggle('is-active', section === ctx);
            });
            if (ctx && ctx.__updateControls) {
                setTimeout(() => {
                    try {
                        const savedIndex = sessionStorage.getItem('section_scroll_index_' + ctx.id);
                        if (savedIndex !== null) {
                            const parsed = parseInt(savedIndex, 10);
                            ctx.__lastIndex = Number.isNaN(parsed) ? 0 : parsed;
                        }
                    } catch { }
                    if (resetIndex) {
                        ctx.__lastIndex = 0;
                        try { sessionStorage.removeItem('section_scroll_index_' + ctx.id); } catch { }
                    }
                    ctx.__scrollToIndex?.(ctx.__lastIndex || 0);
                    ctx.__updateControls?.();
                }, 80);
            }
        }

        function activateById(sectionId) {
            const found = sections.find(s => s.section?.id === sectionId);
            if (!found) return;
            setActive(found.btn);
            showSection(found.section);
        }

        window.profileSectionsActivate = activateById;

        tabs.forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.sectionTarget;
                const target = id ? document.getElementById(id) : null;
                if (!target) return;
                setActive(btn);
                showSection(target, true);
                try { sessionStorage.setItem('profile_active_tab', id); } catch { }
            });
        });

        const savedTab = (function () {
            try { return sessionStorage.getItem('profile_active_tab'); } catch { return null; }
        })();

        if (savedTab) {
            activateById(savedTab);
            return;
        }

        if (sections[0]) {
            setActive(sections[0].btn);
            showSection(sections[0].section);
        }
    }

    document.addEventListener('click', (e) => {
        const link = e.target.closest?.('.profile-section-link');
        if (!link) return;
        const anchor = link.dataset.anchor;
        setListingState(anchor);
        try {
            sessionStorage.setItem('profile_back_url', location.pathname + location.search);
            if (anchor) {
                sessionStorage.setItem('profile_back_anchor', anchor);
                sessionStorage.setItem('listing_section_anchor', anchor);
            }
            const activeTab = document.querySelector('.profile-section-tab.success_');
            if (activeTab?.dataset?.sectionTarget) {
                sessionStorage.setItem('profile_active_tab', activeTab.dataset.sectionTarget);
                sessionStorage.setItem('profile_from_detail', '1');
            }
        } catch { }
    });

    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('.profile-section').forEach(setupHorizontalScroll);
        setupSectionTabs();
        try {
            const fromDetail = sessionStorage.getItem('profile_from_detail') === '1';
            const sectionAnchor = sessionStorage.getItem('listing_section_anchor');
            if (sectionAnchor && window.profileSectionsActivate && fromDetail) {
                window.profileSectionsActivate(sectionAnchor);
            } else {
                const cardAnchor = sessionStorage.getItem('listing_anchor');
                if (cardAnchor && fromDetail) {
                    const el = document.getElementById(cardAnchor);
                    const section = el?.closest?.('.profile-section');
                    if (section?.id && window.profileSectionsActivate) {
                        window.profileSectionsActivate(section.id);
                    }
                }
            }
            if (!fromDetail) {
                sessionStorage.setItem('profile_active_tab', 'profile-section-created');
                if (window.profileSectionsActivate) {
                    window.profileSectionsActivate('profile-section-created');
                }
            }
            sessionStorage.removeItem('profile_from_detail');
        } catch { }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        const activeBtn = document.querySelector('.profile-section-tab.success_');
        const targetId = activeBtn?.dataset.sectionTarget;
        const active = targetId ? document.getElementById(targetId) : null;
        if (!active) return;

        const container = active.querySelector('[data-scroll-container]');
        if (!container) return;
        const row = container.querySelector('.row');
        const card = container.querySelector('.item-card');
        if (!card) return;

        const styles = row ? window.getComputedStyle(row) : null;
        const gap = styles ? parseFloat(styles.columnGap || styles.gap || '0') : 0;
        const perView = isMobile() ? 1 : 2;
        const step = (card.getBoundingClientRect().width + (Number.isNaN(gap) ? 0 : gap)) * perView;
        const maxScroll = Math.max(0, container.scrollWidth - container.clientWidth);
        const index = step ? Math.round(container.scrollLeft / step) : 0;
        active.__lastIndex = index;
        const maxIndex = step ? Math.max(0, Math.round(maxScroll / step)) : 0;
        const nextIndex = e.key === 'ArrowRight' ? index + 1 : index - 1;
        const clamped = Math.max(0, Math.min(maxIndex, nextIndex));
        container.scrollTo({ left: clamped * step, behavior: 'smooth' });
    });
})();
