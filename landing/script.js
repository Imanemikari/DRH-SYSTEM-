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

    // ---- Seller config (edit values in index.html head) ----
    var WA = (typeof SELLER_WHATSAPP !== 'undefined') ? SELLER_WHATSAPP : '';
    var SMAIL = (typeof SELLER_EMAIL !== 'undefined') ? SELLER_EMAIL : 'toumi.bentamra@gmail.com';
    var DL = (typeof DOWNLOAD_URL !== 'undefined') ? DOWNLOAD_URL : '#download';
    var VER = (typeof APP_VERSION !== 'undefined') ? APP_VERSION : '1.1.1';

    var PACKS = {
        START: { name: 'DRH Start (1-10 موظفين)', dzd: 25000 },
        PME: { name: 'DRH PME (11-50 موظف) ⭐', dzd: 75000 },
        PRO: { name: 'DRH Pro (51-200 موظف)', dzd: 150000 },
        ENTREPRISE: { name: 'DRH Entreprise (200+ موظف — حسب الطلب)', dzd: 0 }
    };

    // Version badges + download + whatsapp links
    var vb = document.getElementById('verBadge');
    if (vb) vb.textContent = 'v' + VER;
    var vf = document.getElementById('verFoot');
    if (vf) vf.textContent = 'v' + VER;
    var dlBtn = document.getElementById('downloadBtn');
    if (dlBtn) dlBtn.href = DL;
    var wf = document.getElementById('whatsFloat');
    if (wf && WA && WA.indexOf('000000') === -1) {
        wf.href = 'https://wa.me/' + WA + '?text=' + encodeURIComponent('مرحباً، أريد الاستفسار عن برنامج DRH');
    } else if (wf) {
        wf.style.display = 'none'; // hidden until seller sets the number
    }
    var cw = document.getElementById('contactWhats');
    if (cw) {
        if (WA && WA.indexOf('000000') === -1) {
            cw.href = 'https://wa.me/' + WA + '?text=' + encodeURIComponent('مرحباً، أريد الاستفسار عن برنامج DRH');
        } else {
            cw.href = 'mailto:' + SMAIL;
            cw.textContent = SMAIL;
        }
    }

    // Plan preselect from pricing buttons
    document.querySelectorAll('.order-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var plan = btn.getAttribute('data-plan');
            var sel = document.getElementById('fEmployees');
            if (sel && plan && PACKS[plan]) sel.value = plan;
        });
    });

    // Copy buttons (payment addresses, order text)
    document.querySelectorAll('.copy-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var txt = btn.getAttribute('data-copy') || '';
            copyText(txt, btn);
        });
    });
    function copyText(txt, btn) {
        function done() {
            if (!btn) return;
            var o = btn.textContent;
            btn.textContent = 'تم النسخ ✓';
            setTimeout(function() { btn.textContent = o; }, 2000);
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(txt).then(done).catch(function() { fallback(); });
        } else { fallback(); }
        function fallback() {
            var ta = document.createElement('textarea');
            ta.value = txt;
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); } catch (e) {}
            document.body.removeChild(ta);
            done();
        }
    }

    // ---- Real order form: builds WhatsApp / Email order ----
    var contactForm = document.getElementById('contactForm');
    contactForm.addEventListener('submit', function(e) {
        e.preventDefault();

        var name = val('fName'), email = val('fEmail'), phone = val('fPhone'),
            company = val('fCompany'), country = countryLabel(val('formCountry')),
            plan = val('fEmployees'), pay = val('fPay'), msg = val('fMsg');

        if (!name || !email || !phone || !company) {
            alert('يرجى ملء الحقول الإلزامية (*)');
            return;
        }

        var ref = 'DRH-' + Date.now().toString(36).toUpperCase();
        var pack = PACKS[plan] || PACKS.PME;
        var price = pack.dzd === 0 ? 'حسب الطلب' : pack.dzd.toLocaleString() + ' دج';

        var text = 'طلب جديد ' + ref + '\n'
            + '------------------------\n'
            + 'الاسم: ' + name + '\n'
            + 'الشركة: ' + company + '\n'
            + 'الدولة: ' + country + '\n'
            + 'الهاتف: ' + phone + '\n'
            + 'البريد: ' + email + '\n'
            + 'الباقة: ' + pack.name + '\n'
            + 'السعر: ' + price + '\n'
            + 'الدفع: ' + pay + '\n'
            + (msg ? 'ملاحظات: ' + msg + '\n' : '')
            + '------------------------\n'
            + 'أرغب في شراء برنامج DRH، المرجو إرسال تعليمات الدفع.';

        document.getElementById('orderRef').textContent = ref;
        document.getElementById('orderPack').textContent = pack.name;
        document.getElementById('orderPrice').textContent = price;
        document.getElementById('orderWhats').href =
            'https://wa.me/' + WA + '?text=' + encodeURIComponent(text);
        document.getElementById('orderMail').href =
            'mailto:' + SMAIL + '?subject=' + encodeURIComponent('طلب ' + ref + ' — ' + pack.name)
            + '&body=' + encodeURIComponent(text);
        document.getElementById('orderCopy').onclick = function() { copyText(text, this); };
        document.getElementById('orderResult').style.display = 'block';
        document.getElementById('orderResult').scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    function val(id) {
        var el = document.getElementById(id);
        return el ? (el.value || '').trim() : '';
    }
    function countryLabel(code) {
        var map = { DZ: 'الجزائر', TN: 'تونس', MA: 'المغرب', LY: 'ليبيا', EG: 'مصر', IQ: 'العراق', JO: 'الأردن', LB: 'لبنان', SY: 'سوريا', PS: 'فلسطين', SA: 'السعودية', AE: 'الإمارات', QA: 'قطر', KW: 'الكويت', BH: 'البحرين', OM: 'عُمان', YE: 'اليمن', SD: 'السودان', MR: 'موريتانيا', DJ: 'جيبوتي', KM: 'جزر القمر' };
        return map[code] || code;
    }

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

// Currency switching — btn is optional (safe for programmatic calls)
var currentCurrency = 'DZD';

function setCurrency(code, btn) {
    currentCurrency = code;
    var symbol = currencySymbols[code] || code;
    var rate = currencyRates[code] || 1;

    // Update active button
    document.querySelectorAll('.curr-btn').forEach(function(b) {
        b.classList.remove('active');
    });
    if (btn) {
        btn.classList.add('active');
    } else {
        document.querySelectorAll('.curr-btn').forEach(function(b) {
            if (b.textContent.indexOf(code) !== -1) b.classList.add('active');
        });
    }

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