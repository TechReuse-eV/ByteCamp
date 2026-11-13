/* ==========================================================================
   byteCamp – Main JavaScript
   Vanilla ES6+, no dependencies
   ========================================================================== */

(() => {
    'use strict';

    /* ----------------------------------------------------------------------
       Utility Functions
       ---------------------------------------------------------------------- */
    const $ = (selector, context = document) => context.querySelector(selector);
    const $$ = (selector, context = document) => [...context.querySelectorAll(selector)];

    const createElement = (tag, attrs = {}, ...children) => {
        const el = document.createElement(tag);
        Object.entries(attrs).forEach(([key, value]) => {
            if (key.startsWith('on') && typeof value === 'function') {
                el.addEventListener(key.slice(2).toLowerCase(), value);
            } else if (key === 'dataset') {
                Object.entries(value).forEach(([k, v]) => el.dataset[k] = v);
            } else if (key === 'classList') {
                value.forEach(c => el.classList.add(c));
            } else {
                el.setAttribute(key, value);
            }
        });
        children.flat().forEach(child => {
            if (typeof child === 'string') {
                el.appendChild(document.createTextNode(child));
            } else if (child instanceof Node) {
                el.appendChild(child);
            }
        });
        return el;
    };

    const debounce = (fn, delay) => {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => fn.apply(this, args), delay);
        };
    };

    const throttle = (fn, limit) => {
        let inThrottle;
        return (...args) => {
            if (!inThrottle) {
                fn.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    };

    const getScrollOffset = () => {
        const header = $('.header');
        return header ? header.offsetHeight : 0;
    };

    /* ----------------------------------------------------------------------
       State Management
       ---------------------------------------------------------------------- */
    const state = {
        navOpen: false,
        lightboxOpen: false,
        lightboxIndex: 0,
        galleryImages: [],
        videoPlaying: false,
    };

    /* ----------------------------------------------------------------------
       DOM Elements Cache
       ---------------------------------------------------------------------- */
    const elements = {
        navToggle: null,
        navList: null,
        navLinks: [],
        heroVideo: null,
        heroPlayBtn: null,
        galleryItems: [],
        teamCards: [],
        lightbox: null,
        lightboxImg: null,
        lightboxCaption: null,
        lightboxPrev: null,
        lightboxNext: null,
        lightboxClose: null,
        lightboxOverlay: null,
        sections: [],
    };

    const cacheElements = () => {
        elements.navToggle = $('.nav__toggle');
        elements.navList = $('#nav-menu');
        elements.navLinks = $$('.nav__link[data-section]');
        elements.heroVideo = $('.hero__video');
        elements.heroPlayBtn = $('.hero__play-btn');
        elements.galleryItems = $$('.galerie__item[data-image]');
        elements.teamCards = $$('.team-card');
        elements.lightbox = $('#lightbox');
        elements.lightboxImg = $('#lightbox-img');
        elements.lightboxCaption = $('#lightbox-caption');
        elements.lightboxPrev = $('.lightbox__nav--prev');
        elements.lightboxNext = $('.lightbox__nav--next');
        elements.lightboxClose = $('#lightbox .modal__close');
        elements.lightboxOverlay = $('#lightbox .modal__overlay');
        elements.sections = $$('section[id]');
    };

    /* ----------------------------------------------------------------------
       Navigation / Burger Menu
       ---------------------------------------------------------------------- */
    const nav = {
        init() {
            if (!elements.navToggle || !elements.navList) return;

            elements.navToggle.addEventListener('click', this.toggle.bind(this));

            // Close on nav link click
            elements.navLinks.forEach(link => {
                link.addEventListener('click', (e) => this.handleNavClick(e, link));
            });

            // Close on Escape
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && state.navOpen) this.close();
            });

            // Close on resize > tablet
            window.addEventListener('resize', debounce(() => {
                if (window.innerWidth >= 1024 && state.navOpen) this.close();
            }, 250));

            // Update active link on scroll
            window.addEventListener('scroll', throttle(this.updateActiveLink.bind(this), 100));
        },

        toggle() {
            state.navOpen ? this.close() : this.open();
        },

        open() {
            state.navOpen = true;
            elements.navToggle.setAttribute('aria-expanded', 'true');
            elements.navList.classList.add('active');
            document.body.style.overflow = 'hidden';
            // Focus first link
            setTimeout(() => elements.navLinks[0]?.focus(), 100);
        },

        close() {
            state.navOpen = false;
            elements.navToggle.setAttribute('aria-expanded', 'false');
            elements.navList.classList.remove('active');
            document.body.style.overflow = '';
        },

        handleNavClick(e, link) {
            const href = link.getAttribute('href');
            if (href && href.startsWith('#')) {
                e.preventDefault();
                const targetId = href.slice(1);
                this.scrollToSection(targetId);
                this.close();
            }
        },

        scrollToSection(id) {
            const target = document.getElementById(id);
            if (!target) return;

            const offset = getScrollOffset();
            const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - offset;

            window.scrollTo({ top: targetPosition, behavior: 'smooth' });

            // Update URL without scroll jump
            history.pushState(null, '', `#${id}`);

            // Focus for accessibility
            target.setAttribute('tabindex', '-1');
            target.focus({ preventScroll: true });
            target.removeAttribute('tabindex');
        },

        updateActiveLink() {
            const scrollPos = window.scrollY + getScrollOffset() + 100;

            elements.sections.forEach(section => {
                const top = section.offsetTop;
                const height = section.offsetHeight;
                const id = section.getAttribute('id');

                if (scrollPos >= top && scrollPos < top + height) {
                    elements.navLinks.forEach(link => {
                        const isActive = link.getAttribute('href') === `#${id}`;
                        link.toggleAttribute('aria-current', isActive);
                    });
                }
            });
        }
    };

    /* ----------------------------------------------------------------------
       Hero Video Controls
       ---------------------------------------------------------------------- */
    const heroVideo = {
        init() {
            if (!elements.heroVideo) return;

            this.setupVideoEvents();
            this.setupIntersectionObserver();
            this.checkReducedMotion();
        },

        setupVideoEvents() {
            const video = elements.heroVideo;
            const playBtn = elements.heroPlayBtn;
            const loading = $('.hero__video-loading');

            // Show video when it can play
            video.addEventListener('canplay', () => {
                video.classList.add('hero__video--loaded');
                loading?.classList.add('hidden');
                playBtn?.classList.add('hero__play-btn--visible');
            });

            // Handle loading
            video.addEventListener('waiting', () => {
                loading?.classList.remove('hidden');
            });

            video.addEventListener('playing', () => {
                loading?.classList.add('hidden');
            });

            // Error handling - show fallback
            video.addEventListener('error', () => {
                video.classList.add('error');
                loading?.classList.add('hidden');
                playBtn?.classList.remove('hero__play-btn--visible');
            });

            // Play button click (if exists)
            playBtn?.addEventListener('click', this.toggle.bind(this));

            // Autoplay attempt (muted)
            video.play().catch(() => {
                // Autoplay blocked - show play button if exists
                playBtn?.classList.add('hero__play-btn--visible');
            });
        },

        setupIntersectionObserver() {
            if (!('IntersectionObserver' in window)) return;

            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        if (state.videoPlaying && !elements.heroVideo.paused) {
                            elements.heroVideo.play().catch(() => {});
                        }
                    } else {
                        // Pause when not visible (performance)
                        elements.heroVideo.pause();
                    }
                });
            }, { threshold: 0.3, rootMargin: '50px' });

            observer.observe(elements.heroVideo.parentElement);
        },

        setupKeyboardSupport() {
            elements.heroPlayBtn.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.toggle();
                }
            });
        },

        checkReducedMotion() {
            const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            if (prefersReduced) {
                elements.heroVideo.pause();
                elements.heroPlayBtn.classList.add('hero__play-btn--visible');
                state.videoPlaying = false;
            }
        },

        toggle() {
            const video = elements.heroVideo;
            const playBtn = elements.heroPlayBtn;

            if (video.paused) {
                video.play().then(() => {
                    state.videoPlaying = true;
                    playBtn?.setAttribute('aria-label', 'Video pausieren');
                    playBtn?.classList.add('hero__play-btn--playing');
                    playBtn?.classList.remove('hero__play-btn--visible');
                }).catch(() => {
                    // Play failed
                    playBtn?.classList.add('hero__play-btn--visible');
                });
            } else {
                video.pause();
                state.videoPlaying = false;
                playBtn?.setAttribute('aria-label', 'Video abspielen');
                playBtn?.classList.remove('hero__play-btn--playing');
                playBtn?.classList.add('hero__play-btn--visible');
            }
        }
    };

    /* ----------------------------------------------------------------------
       Gallery Lightbox
       ---------------------------------------------------------------------- */
   /* const lightbox = {
        init() {
            if (!elements.lightbox || elements.galleryItems.length === 0) return;

            // Build gallery images array
            state.galleryImages = elements.galleryItems.map((item, index) => ({
                src: item.dataset.image,
                caption: item.querySelector('.galerie__caption')?.textContent || '',
                element: item
            }));

            // Click handlers for gallery items
            elements.galleryItems.forEach((item, index) => {
                item.addEventListener('click', () => this.open(index));
                item.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        this.open(index);
                    }
                });
                // Make focusable
                item.setAttribute('tabindex', '0');
                item.setAttribute('role', 'button');
                item.setAttribute('aria-label', `Bild anzeigen: ${item.querySelector('.galerie__caption')?.textContent || 'Galerie-Bild'}`);
            });

            // Lightbox controls
            elements.lightboxClose?.addEventListener('click', () => this.close());
            elements.lightboxOverlay?.addEventListener('click', () => this.close());
            elements.lightboxPrev?.addEventListener('click', () => this.navigate(-1));
            elements.lightboxNext?.addEventListener('click', () => this.navigate(1));

            // Keyboard navigation
            document.addEventListener('keydown', (e) => {
                if (!state.lightboxOpen) return;
                switch (e.key) {
                    case 'Escape': this.close(); break;
                    case 'ArrowLeft': this.navigate(-1); break;
                    case 'ArrowRight': this.navigate(1); break;
                    case 'Tab': this.trapFocus(e); break;
                }
            });

            // Swipe support for mobile
            let touchStartX = 0;
            elements.lightbox?.addEventListener('touchstart', (e) => {
                touchStartX = e.touches[0].clientX;
            }, { passive: true });

            elements.lightbox?.addEventListener('touchend', (e) => {
                const touchEndX = e.changedTouches[0].clientX;
                const diff = touchStartX - touchEndX;
                if (Math.abs(diff) > 50) {
                    this.navigate(diff > 0 ? 1 : -1);
                }
            }, { passive: true });
        },

        open(index) {
            if (index < 0 || index >= state.galleryImages.length) return;

            state.lightboxOpen = true;
            state.lightboxIndex = index;
            document.body.style.overflow = 'hidden';

            this.updateContent();
            elements.lightbox.classList.add('is-open');

            // Force reflow for animation
            elements.lightbox.offsetHeight;

            // Focus close button
            setTimeout(() => elements.lightboxClose?.focus(), 100);
        },

        close() {
            if (!state.lightboxOpen) return;

            state.lightboxOpen = false;
            elements.lightbox.classList.remove('is-open');
            document.body.style.overflow = '';
            elements.lightboxImg.src = '';
            elements.lightboxImg.alt = '';
        },

        navigate(direction) {
            const newIndex = (state.lightboxIndex + direction + state.galleryImages.length) % state.galleryImages.length;
            state.lightboxIndex = newIndex;
            this.updateContent();
        },

        updateContent() {
            const current = state.galleryImages[state.lightboxIndex];
            if (!current) return;

            // Reset image state
            elements.lightboxImg.removeAttribute('src');
            elements.lightboxImg.alt = current.caption;
            elements.lightboxCaption.textContent = current.caption;
            elements.lightboxImg.classList.remove('loaded', 'error');

            // Load new image with error handling
            const img = new Image();
            img.onload = () => {
                elements.lightboxImg.src = current.src;
                elements.lightboxImg.classList.add('loaded');
            };
            img.onerror = () => {
                elements.lightboxImg.classList.add('error');
                elements.lightboxImg.alt = current.caption + ' (Fehler beim Laden)';
                console.warn(`Failed to load lightbox image: ${current.src}`);
            };
            img.src = current.src;

            // Update nav button states
            elements.lightboxPrev.disabled = state.galleryImages.length <= 1;
            elements.lightboxNext.disabled = state.galleryImages.length <= 1;
        },

        trapFocus(e) {
            const focusableElements = elements.lightbox.querySelectorAll(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            if (e.shiftKey && document.activeElement === firstElement) {
                e.preventDefault();
                lastElement.focus();
            } else if (!e.shiftKey && document.activeElement === lastElement) {
                e.preventDefault();
                firstElement.focus();
            }
        }
    };*/

    /* ----------------------------------------------------------------------
       Scroll Animations (IntersectionObserver)
       ---------------------------------------------------------------------- */
    const scrollAnimations = {
        init() {
            if (!('IntersectionObserver' in window)) return;

            const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            if (prefersReducedMotion) return;

            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('is-visible');
                        observer.unobserve(entry.target);
                    }
                });
            }, {
                rootMargin: '0px 0px -10% 0px',
                threshold: 0.1
            });

            // Elements to animate
            $$('.info-block, .team-card, .galerie__item, .section__header').forEach(el => {
                el.classList.add('animate-on-scroll');
                observer.observe(el);
            });
        }
    };

    /* ----------------------------------------------------------------------
       Header Scroll Effect
       ---------------------------------------------------------------------- */
    const headerScroll = {
        init() {
            const header = $('.header');
            if (!header) return;

            const toggleHeader = throttle(() => {
                if (window.scrollY > 50) {
                    header.classList.add('header--scrolled');
                } else {
                    header.classList.remove('header--scrolled');
                }
            }, 50);

            window.addEventListener('scroll', toggleHeader, { passive: true });
        }
    };

    /* ----------------------------------------------------------------------
       Smooth Scroll for Anchor Links (including external links with hash)
       ---------------------------------------------------------------------- */
    const smoothScroll = {
        init() {
            document.addEventListener('click', (e) => {
                const link = e.target.closest('a[href^="#"]');
                if (!link) return;

                const href = link.getAttribute('href');
                if (href === '#') return;

                const target = document.querySelector(href);
                if (!target) return;

                e.preventDefault();
                const offset = getScrollOffset();
                const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - offset;

                window.scrollTo({ top: targetPosition, behavior: 'smooth' });
                history.pushState(null, '', href);

                target.setAttribute('tabindex', '-1');
                target.focus({ preventScroll: true });
                target.removeAttribute('tabindex');
            });
        }
    };

    /* ----------------------------------------------------------------------
       Image Loading / Placeholder Handling
       ---------------------------------------------------------------------- */
    const imageLoader = {
        init() {
            // Handle gallery images when they're added
            this.setupGalleryObserver();

            // Handle team avatars
            $$('.team-card__avatar[data-image]').forEach(avatar => {
                this.loadImage(avatar);
            });
        },

        setupGalleryObserver() {
            if (!('IntersectionObserver' in window)) return;

            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const item = entry.target;
                        if (item.dataset.image && !item.classList.contains('loaded') && !item.classList.contains('error')) {
                            this.loadGalleryImage(item);
                        }
                        observer.unobserve(item);
                    }
                });
            }, { rootMargin: '100px' });

            elements.galleryItems.forEach(item => observer.observe(item));
        },

        loadGalleryItem(item) {
            const imgEl = item.querySelector('img');
            if (!imgEl) return;

            imgEl.loading = 'lazy';
            imgEl.src = item.dataset.image;

            imgEl.onload = () => {
                item.classList.add('loaded');
            };

            imgEl.onerror = () => {
                item.classList.add('error');
                console.warn(`Failed to load gallery image: ${item.dataset.image}`);
            };
        },

        loadGalleryImage(item) {
            this.loadGalleryItem(item);
        },

        loadImage(el) {
            if (!el.dataset.image) return;

            const img = new Image();
            img.src = el.dataset.image;
            img.alt = el.getAttribute('aria-label') || '';

            img.onload = () => {
                el.style.backgroundImage = `url(${el.dataset.image})`;
                el.classList.add('loaded');
            };

            img.onerror = () => {
                el.classList.add('error');
                console.warn(`Failed to load image: ${el.dataset.image}`);
            };
        }
    };

    /* ----------------------------------------------------------------------
       Initialize All Modules
       ---------------------------------------------------------------------- */
    const init = () => {
        cacheElements();
        nav.init();
        heroVideo.init();
        lightbox.init();
        scrollAnimations.init();
        headerScroll.init();
        smoothScroll.init();
        imageLoader.init();

        // Handle initial hash
        if (window.location.hash) {
            const id = window.location.hash.slice(1);
            setTimeout(() => nav.scrollToSection(id), 100);
        }

        console.log('byteCamp initialized');
    };

    /* ----------------------------------------------------------------------
       DOM Ready
       ---------------------------------------------------------------------- */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    /* ----------------------------------------------------------------------
       Public API (for external use)
       ---------------------------------------------------------------------- */
    window.byteCamp = {
        nav: {
            open: nav.open.bind(nav),
            close: nav.close.bind(nav),
            scrollTo: nav.scrollToSection.bind(nav),
        },
        lightbox: {
            open: lightbox.open.bind(lightbox),
            close: lightbox.close.bind(lightbox),
        },
        heroVideo: {
            play: () => heroVideo.toggle(),
            pause: () => elements.heroVideo?.pause(),
        },
        utils: {
            $,
            $$,
            createElement,
            debounce,
            throttle,
        }
    };
})();