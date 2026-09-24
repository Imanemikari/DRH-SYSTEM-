document.addEventListener('DOMContentLoaded', function() {

    // Navbar scroll effect
    const navbar = document.getElementById('navbar');
    window.addEventListener('scroll', function() {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // Hamburger menu
    const hamburger = document.getElementById('hamburger');
    const navLinks = document.getElementById('navLinks');
    hamburger.addEventListener('click', function() {
        navLinks.classList.toggle('active');
    });

    // Close menu on link click
    document.querySelectorAll('.nav-links a').forEach(function(link) {
        link.addEventListener('click', function() {
            navLinks.classList.remove('active');
        });
    });

    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            var target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });

    // Intersection Observer for animations
    var observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observe cards
    document.querySelectorAll('.problem-card, .solution-card, .feature-highlight-card, .pricing-card, .testimonial-card, .compare-card').forEach(function(el, i) {
        el.style.animationDelay = (i % 4) * 0.1 + 's';
        observer.observe(el);
    });

    // Form submission
    var contactForm = document.getElementById('contactForm');
    contactForm.addEventListener('submit', function(e) {
        e.preventDefault();

        var btn = this.querySelector('button[type="submit"]');
        var originalText = btn.textContent;
        btn.textContent = 'جاري الإرسال...';
        btn.disabled = true;

        setTimeout(function() {
            btn.textContent = 'تم الإرسال بنجاح!';
            btn.style.background = 'linear-gradient(135deg, #10b981, #059669)';

            setTimeout(function() {
                btn.textContent = originalText;
                btn.style.background = '';
                btn.disabled = false;
                contactForm.reset();
            }, 3000);
        }, 1500);
    });

    // Counter animation for hero stats
    function animateValue(element, start, end, duration) {
        var startTimestamp = null;
        var step = function(timestamp) {
            if (!startTimestamp) startTimestamp = timestamp;
            var progress = Math.min((timestamp - startTimestamp) / duration, 1);
            var current = Math.floor(progress * (end - start) + start);
            element.textContent = current;
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        window.requestAnimationFrame(step);
    }

    // Trigger counter when hero is visible
    var heroObserver = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (entry.isIntersecting) {
                var statNumbers = entry.target.querySelectorAll('.stat-number');
                statNumbers.forEach(function(el) {
                    if (el.textContent === '+50') {
                        animateValue(el, 0, 50, 2000);
                        el.textContent = '+50';
                    }
                });
                heroObserver.unobserve(entry.target);
            }
        });
    });

    var heroStats = document.querySelector('.hero-stats');
    if (heroStats) {
        heroObserver.observe(heroStats);
    }

    // Parallax effect on hero background
    window.addEventListener('scroll', function() {
        var scrolled = window.scrollY;
        var heroBg = document.querySelector('.hero-bg');
        if (heroBg && scrolled < 800) {
            heroBg.style.transform = 'translateY(' + (scrolled * 0.3) + 'px)';
        }
    });

    // Initialize currency
    setCurrency('DZD');
});

// Currency switching
var currentCurrency = 'DZD';

function setCurrency(code) {
    currentCurrency = code;
    var symbol = currencySymbols[code] || code;
    var rate = currencyRates[code] || 1;

    // Update active button
    document.querySelectorAll('.curr-btn').forEach(function(btn) {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');

    // Update prices
    document.querySelectorAll('.price[data-dzd]').forEach(function(el) {
        var dzd = parseFloat(el.getAttribute('data-dzd'));
        var converted = Math.round(dzd * rate);
        if (code === 'USDT') {
            el.innerHTML = converted.toLocaleString() + ' <span class="curr-symbol">USDT</span>';
        } else if (code === 'USD') {
            el.innerHTML = '$' + converted.toLocaleString() + ' <span class="curr-symbol"></span>';
        } else {
            el.innerHTML = converted.toLocaleString() + ' <span class="curr-symbol">' + symbol + '</span>';
        }
    });

    // Update currency symbol in comparison cards
    document.querySelectorAll('.curr-symbol-hero').forEach(function(el) {
        if (code === 'USD') {
            el.textContent = '$19';
        } else if (code === 'USDT') {
            el.textContent = '2,570 USDT';
        } else {
            el.textContent = '25,000 ' + symbol;
        }
    });
}

// Country change
function changeCountry(countryCode) {
    // Auto-set currency based on country
    var countryCurrencyMap = {
        'DZ': 'DZD', 'TN': 'TND', 'MA': 'MAD', 'LY': 'LYD', 'EG': 'EGP',
        'IQ': 'IQD', 'JO': 'JOD', 'LB': 'LBP', 'SY': 'SYP', 'PS': 'ILS',
        'SA': 'SAR', 'AE': 'AED', 'QA': 'QAR', 'KW': 'KWD', 'BH': 'BHD',
        'OM': 'OMR', 'YE': 'YER', 'SD': 'SDG', 'MR': 'MRU', 'DJ': 'DJF', 'KM': 'KMF'
    };

    var currency = countryCurrencyMap[countryCode] || 'USD';

    // For countries without direct rate, default to USD
    if (!currencyRates[currency]) {
        currency = 'USD';
    }

    // Update currency buttons
    document.querySelectorAll('.curr-btn').forEach(function(btn) {
        btn.classList.remove('active');
        if (btn.textContent.includes(currency)) {
            btn.classList.add('active');
        }
    });

    setCurrency(currency);
}