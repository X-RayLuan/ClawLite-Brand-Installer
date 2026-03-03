/* ── SPA Router for Easy* Product Portal ── */
;(function () {
  var currentProduct = null
  var _versionCache = {}
  var _dom = {}

  function detectProduct() {
    var path = window.location.pathname
    for (var key in PRODUCTS) {
      if (PRODUCTS[key].path === path || PRODUCTS[key].path + '/' === path) return key
    }
    return 'claw'
  }

  function getT(key, fallbackKey) {
    var lang = getCurrentLang()
    var t = translations[lang] || translations.ko
    if (t[key] != null) return t[key]
    if (fallbackKey && t[fallbackKey] != null) return t[fallbackKey]
    return key
  }

  function getDownloadBase(p) {
    return 'https://github.com/' + p.github + '/releases/latest/download/'
  }

  /* ── Feature icon SVGs ── */
  var FEATURE_ICONS = {
    check:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    mic:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a4 4 0 014 4v2a4 4 0 01-8 0V6a4 4 0 014-4z"/><path d="M16 12a4 4 0 01-8 0"/><path d="M12 16v4"/><path d="M8 22h8"/></svg>',
    chat:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>',
    search:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    globe:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>'
  }

  /* ── Hero icon templates ── */
  function getHeroIcon(product) {
    var tpl = document.getElementById(PRODUCTS[product].iconTemplate)
    if (tpl) return tpl.innerHTML
    return ''
  }

  /* ── Update CSS custom properties for accent ── */
  function applyAccent(p) {
    var root = document.documentElement.style
    root.setProperty('--primary', p.accent)
    root.setProperty('--primary-hover', p.accentHover)
    root.setProperty('--primary-light', p.accentLight)
    root.setProperty('--primary-glow', p.accentGlow)
  }

  /* ── Nav tabs ── */
  function updateNavTabs(product) {
    _dom.navTabs.forEach(function (tab) {
      tab.classList.toggle('nav-tab--active', tab.getAttribute('data-product') === product)
    })
  }

  /* ── Brand suffix ── */
  function updateBrandText(p) {
    _dom.brandParts.forEach(function (el) {
      el.textContent = p.brandSuffix
    })
  }

  /* ── Hero section ── */
  function updateHero(product) {
    var p = PRODUCTS[product]
    var prefix = p.i18nPrefix
    var base = getDownloadBase(p)

    // Icon
    if (_dom.iconWrap) _dom.iconWrap.innerHTML = getHeroIcon(product)

    // Tagline
    if (_dom.tagline) _dom.tagline.innerHTML = safeHtml(getT(prefix + 'hero.tagline', 'hero.tagline'))

    // Download links
    _dom.macLinks.forEach(function (a) { a.href = base + p.dmg })
    _dom.winLinks.forEach(function (a) { a.href = base + p.exe })
    _dom.ghLinks.forEach(function (a) { a.href = 'https://github.com/' + p.github })
    _dom.chatLinks.forEach(function (a) { a.href = p.openChat })

    // Labels
    _dom.macLabels.forEach(function (el) { el.textContent = getT(prefix + 'hero.downloadMac', 'hero.downloadMac') })
    _dom.winLabels.forEach(function (el) { el.textContent = getT(prefix + 'hero.downloadWin', 'hero.downloadWin') })
    _dom.ghLabels.forEach(function (el) { el.textContent = getT(prefix + 'hero.starGithub', 'hero.starGithub') })
    _dom.chatLabels.forEach(function (el) { el.textContent = getT(prefix + 'hero.openChat', 'hero.openChat') })

    // Demo GIF
    if (_dom.heroDemo) {
      _dom.heroDemo.style.display = p.demoGif ? '' : 'none'
      if (p.demoGif) {
        var img = _dom.heroDemo.querySelector('img')
        if (img) img.src = p.demoGif
      }
    }

    // Product Hunt badge
    if (_dom.heroPH) {
      _dom.heroPH.style.display = p.productHunt ? '' : 'none'
      if (p.productHunt) {
        var a = _dom.heroPH.querySelector('a')
        var img = _dom.heroPH.querySelector('img')
        if (a) a.href = p.productHunt
        if (img) img.src = p.productHuntImg
      }
    }
  }

  /* ── Features section ── */
  function updateFeatures(product) {
    var p = PRODUCTS[product]
    var prefix = p.i18nPrefix

    if (_dom.featuresTitle) _dom.featuresTitle.textContent = getT(prefix + 'features.title', 'features.title')
    if (_dom.featuresSub) _dom.featuresSub.textContent = getT(prefix + 'features.sub', 'features.sub')

    var cards = _dom.featureCards
    p.features.forEach(function (feat, i) {
      if (!cards[i]) return
      var iconEl = cards[i].querySelector('.feature-icon')
      if (iconEl && FEATURE_ICONS[feat.icon]) iconEl.innerHTML = FEATURE_ICONS[feat.icon]

      var h3 = cards[i].querySelector('h3')
      var pEl = cards[i].querySelector('p')
      if (h3) h3.textContent = getT(feat.i18n + '.title')
      if (pEl) pEl.textContent = getT(feat.i18n + '.desc')
    })
  }

  /* ── Steps section ── */
  function updateSteps(product) {
    var p = PRODUCTS[product]
    var prefix = p.i18nPrefix

    if (_dom.stepsTitle) _dom.stepsTitle.textContent = getT(prefix + 'steps.title', 'steps.title')
    if (_dom.stepsSub) _dom.stepsSub.textContent = getT(prefix + 'steps.sub', 'steps.sub')

    _dom.stepCards.forEach(function (card, i) {
      if (!p.steps[i]) return
      var h3 = card.querySelector('h3')
      var pEl = card.querySelector('p')
      if (h3) h3.textContent = getT(p.steps[i] + '.title')
      if (pEl) pEl.innerHTML = safeHtml(getT(p.steps[i] + '.desc'))
    })
  }

  /* ── CTA section ── */
  function updateCTA(product) {
    var p = PRODUCTS[product]
    var prefix = p.i18nPrefix
    var base = getDownloadBase(p)

    if (_dom.ctaTitle) _dom.ctaTitle.textContent = getT(prefix + 'cta.title', 'cta.title')
    if (_dom.ctaDesc) _dom.ctaDesc.textContent = getT(prefix + 'cta.desc', 'cta.desc')

    if (_dom.ctaMac) {
      _dom.ctaMac.href = base + p.dmg
      var span = _dom.ctaMac.querySelector('span')
      if (span) span.textContent = getT(prefix + 'cta.downloadMac', 'cta.downloadMac')
    }
    if (_dom.ctaWin) {
      _dom.ctaWin.href = base + p.exe
      var span = _dom.ctaWin.querySelector('span')
      if (span) span.textContent = getT(prefix + 'cta.downloadWin', 'cta.downloadWin')
    }
  }

  /* ── Cross banner ── */
  function updateCrossBanner(product) {
    var other = product === 'claw' ? 'code' : 'claw'
    var otherP = PRODUCTS[other]
    var bannerKey = 'crossBanner.' + other

    if (_dom.crossTitle) _dom.crossTitle.textContent = getT(bannerKey + '.title')
    if (_dom.crossDesc) _dom.crossDesc.textContent = getT(bannerKey + '.desc')
    if (_dom.crossBtn) {
      _dom.crossBtnText.textContent = getT(bannerKey + '.btn')
      _dom.crossBtn.setAttribute('data-product', other)
    }

    var card = _dom.crossCard
    if (card) card.style.borderColor = otherP.accentGlow.replace('0.35)', '0.15)')
  }

  /* ── Meta tags ── */
  function updateMeta(product) {
    var p = PRODUCTS[product]
    var prefix = p.i18nPrefix

    document.title = getT(prefix + 'meta.title', 'meta.title')
    var metaDesc = document.querySelector('meta[name="description"]')
    if (metaDesc) metaDesc.setAttribute('content', getT(prefix + 'meta.description', 'meta.description'))
  }

  /* ── Version badge (cached) ── */
  function fetchVersion(product) {
    var p = PRODUCTS[product]
    if (!_dom.badge) return

    // Use cache if available
    if (_versionCache[product]) {
      _dom.badge.textContent =
        _versionCache[product] + ' ' + getT('hero.versionRelease')
      return
    }

    _dom.badge.textContent = getT('hero.versionLoading')

    fetch('https://api.github.com/repos/' + p.github + '/releases/latest')
      .then(function (r) { return r.json() })
      .then(function (d) {
        if (d.tag_name) {
          _versionCache[product] = d.tag_name
          if (currentProduct === product) {
            _dom.badge.textContent = d.tag_name + ' ' + getT('hero.versionRelease')
          }
        }
      })
      .catch(function () {
        if (currentProduct === product) {
          _dom.badge.textContent = getT('hero.versionFallback')
        }
      })
  }

  /* ── Nav download button ── */
  function updateNavDownload(product) {
    var p = PRODUCTS[product]
    if (_dom.navDl) _dom.navDl.href = getDownloadBase(p) + p.dmg
  }

  /* ── Main switch ── */
  function switchProduct(product, pushState) {
    if (!PRODUCTS[product]) product = 'claw'
    currentProduct = product
    var p = PRODUCTS[product]

    applyAccent(p)
    updateNavTabs(product)
    updateBrandText(p)
    updateNavDownload(product)
    updateHero(product)
    updateFeatures(product)
    updateSteps(product)
    updateCTA(product)
    updateCrossBanner(product)
    updateMeta(product)
    fetchVersion(product)

    if (pushState) {
      history.pushState({ product: product }, '', p.path)
    }
  }

  /* ── Refresh (called after language change) ── */
  window.refreshProduct = function () {
    if (currentProduct) switchProduct(currentProduct, false)
  }

  /* ── Navigation click handler ── */
  function handleNavClick(e) {
    var tab = e.target.closest('[data-product]')
    if (!tab) return
    e.preventDefault()
    var product = tab.getAttribute('data-product')
    if (product !== currentProduct) {
      switchProduct(product, true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  /* ── popstate ── */
  window.addEventListener('popstate', function (e) {
    var product = (e.state && e.state.product) || detectProduct()
    if (product !== currentProduct) switchProduct(product, false)
  })

  /* ── Cache DOM references ── */
  function cacheDOM() {
    _dom.badge = document.getElementById('version-badge')
    _dom.navTabs = document.querySelectorAll('.nav-tab')
    _dom.navDl = document.querySelector('.nav-download')
    _dom.brandParts = document.querySelectorAll('.brand-part')
    _dom.iconWrap = document.querySelector('.lobster-wrap')
    _dom.tagline = document.querySelector('.tagline')
    _dom.macLinks = document.querySelectorAll('[data-link="mac"]')
    _dom.winLinks = document.querySelectorAll('[data-link="win"]')
    _dom.ghLinks = document.querySelectorAll('[data-link="github"]')
    _dom.chatLinks = document.querySelectorAll('[data-link="chat"]')
    _dom.macLabels = document.querySelectorAll('[data-label="downloadMac"]')
    _dom.winLabels = document.querySelectorAll('[data-label="downloadWin"]')
    _dom.ghLabels = document.querySelectorAll('[data-label="starGithub"]')
    _dom.chatLabels = document.querySelectorAll('[data-label="openChat"]')
    _dom.heroDemo = document.getElementById('hero-demo')
    _dom.heroPH = document.getElementById('hero-producthunt')
    _dom.featuresTitle = document.getElementById('features-title')
    _dom.featuresSub = document.getElementById('features-sub')
    _dom.featureCards = document.querySelectorAll('.feature-card')
    _dom.stepsTitle = document.getElementById('steps-title')
    _dom.stepsSub = document.getElementById('steps-sub')
    _dom.stepCards = document.querySelectorAll('.step-card')
    _dom.ctaTitle = document.getElementById('cta-title')
    _dom.ctaDesc = document.getElementById('cta-desc')
    _dom.ctaMac = document.getElementById('cta-mac')
    _dom.ctaWin = document.getElementById('cta-win')
    _dom.crossTitle = document.getElementById('cross-banner-title')
    _dom.crossDesc = document.getElementById('cross-banner-desc')
    _dom.crossBtn = document.getElementById('cross-banner-btn')
    _dom.crossBtnText = document.getElementById('cross-banner-btn-text')
    _dom.crossCard = document.querySelector('.cross-banner-card')
  }

  /* ── Init ── */
  function init() {
    cacheDOM()

    var navTabsWrap = document.querySelector('.nav-tabs')
    if (navTabsWrap) navTabsWrap.addEventListener('click', handleNavClick)

    if (_dom.crossBtn) {
      _dom.crossBtn.addEventListener('click', function (e) {
        e.preventDefault()
        var product = this.getAttribute('data-product')
        switchProduct(product, true)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      })
    }

    var product = detectProduct()
    history.replaceState({ product: product }, '', PRODUCTS[product].path)
    switchProduct(product, false)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
