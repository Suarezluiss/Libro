/* =========================================================
   UNIVERSOS DE LETRAS · lógica del libro 3D
   - Lee las 16 <section class="page"> del HTML y las acomoda
     en 8 hojas (cada hoja = frente + reverso).
   - Estado único: `page` (1..16). De ahí salen la hoja que gira,
     el desplazamiento del libro y qué páginas son visibles.
   ========================================================= */
;(() => {
  'use strict'

  const root = document.documentElement
  const stage = document.querySelector('.stage')
  const book = document.getElementById('book')
  const sky = document.getElementById('sky')
  const bar = document.getElementById('bar')
  const countEl = document.getElementById('count')
  const btnHome = document.getElementById('home')
  const btnPrev = document.getElementById('prev')
  const btnNext = document.getElementById('next')
  const btnFs = document.getElementById('fs')

  const mqSingle = window.matchMedia(
    '(max-width: 860px), (max-aspect-ratio: 1/1)'
  )
  const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)')

  const FLIP_MS = 1000 // igual que --dur-flip en el CSS
  const STAGGER_MS = 80 // retraso entre hojas cuando se salta varias páginas

  const clamp = (n, a, b) => Math.min(b, Math.max(a, n))
  const rand = (a, b) => a + Math.random() * (b - a)

  /* ---------- 1. Construir las hojas ---------- */
  const sources = [...book.querySelectorAll(':scope > section.page')]
  if (sources.length % 2) {
    const blank = document.createElement('section')
    blank.className = 'page'
    blank.setAttribute('aria-hidden', 'true')
    book.append(blank)
    sources.push(blank)
  }

  const TOTAL = sources.length
  const LEAVES = TOTAL / 2
  const leaves = []

  sources.forEach((sec, i) => {
    const n = i + 1
    sec.dataset.page = n

    // contenido dentro de .sheet (permite desplazar si algo no cabe)
    const sheet = document.createElement('div')
    sheet.className = 'sheet'
    while (sec.firstChild) sheet.append(sec.firstChild)
    sec.append(sheet)

    if (!sec.classList.contains('cover')) {
      const folio = document.createElement('span')
      folio.className = 'folio'
      folio.textContent = n
      folio.setAttribute('aria-hidden', 'true')
      sec.append(folio)
    }
  })

  for (let i = 0; i < LEAVES; i++) {
    const leaf = document.createElement('div')
    leaf.className = 'leaf'
    // profundidad: sin turnar, la hoja 1 queda arriba; ya turnadas, la última queda arriba
    leaf.style.setProperty('--zf', `${(LEAVES - i) * 2}px`)
    leaf.style.setProperty('--zb', `${i * 2}px`)

    const front = sources[2 * i]
    const back = sources[2 * i + 1]
    front.classList.add('front')
    back.classList.add('back')

    leaf.append(front, back)
    book.append(leaf)
    leaves.push(leaf)
  }

  /* ---------- 2. Estado y render ---------- */
  let page = 1 // 1 = portada, TOTAL = contraportada

  const isSingle = () => mqSingle.matches

  function visiblePages (k, single) {
    if (single) return [page]
    if (k === 0) return [1]
    if (k === LEAVES) return [TOTAL]
    return [2 * k, 2 * k + 1]
  }

  function render () {
    const single = isSingle()
    const k = Math.floor(page / 2) // hojas ya volteadas
    const reduce = mqReduce.matches

    // Hojas que cambian de lado, en el orden en que deben girar
    const changed = []
    leaves.forEach((leaf, i) => {
      if (leaf.classList.contains('turned') !== i < k) changed.push(i)
    })
    const forward = changed.length && changed[0] < k
    if (!forward) changed.reverse()

    leaves.forEach((leaf, i) => {
      const order = changed.indexOf(i)
      const delay = order > -1 && !reduce ? order * STAGGER_MS : 0
      leaf.style.transitionDelay = `${delay}ms`
      leaf.style.setProperty('--d', `${delay}ms`)
      leaf.classList.toggle('turned', i < k)

      if (order > -1 && !reduce) {
        leaf.classList.remove('flipping')
        void leaf.offsetWidth // reinicia la animación de sombra
        leaf.classList.add('flipping')
        clearTimeout(leaf._t)
        leaf._t = setTimeout(
          () => leaf.classList.remove('flipping'),
          FLIP_MS + delay + 60
        )
      }
    })

    // Desplazamiento / inclinación del libro
    let tx, sx
    if (single) {
      tx = page % 2 ? -0.5 : 0.5 // páginas impares a la derecha, pares a la izquierda
      sx = 0.5
    } else {
      tx = k === 0 ? -0.5 : k === LEAVES ? 0.5 : 0
      sx = tx === 0 ? 1 : 0.5
    }
    const ry = k === 0 ? -7 : k === LEAVES ? 7 : 0

    stage.style.setProperty('--tx', tx)
    stage.style.setProperty('--sx', sx)
    stage.style.setProperty('--ry', ry)
    stage.dataset.state = k === 0 ? 'front' : k === LEAVES ? 'back' : 'open'
    stage.dataset.mode = single ? 'single' : 'spread'

    // Sólo las páginas visibles son accesibles
    const vis = visiblePages(k, single)
    sources.forEach((sec, i) => {
      const on = vis.includes(i + 1)
      sec.inert = !on
      sec.setAttribute('aria-hidden', on ? 'false' : 'true')
    })

    // Texto del contador, progreso y botones
    let label
    if (vis.length === 2) label = `Páginas ${vis[0]}–${vis[1]} / ${TOTAL}`
    else if (vis[0] === 1) label = `Portada · 1 / ${TOTAL}`
    else if (vis[0] === TOTAL) label = `Contraportada · ${TOTAL} / ${TOTAL}`
    else label = `Página ${vis[0]} / ${TOTAL}`
    countEl.textContent = label

    bar.parentElement.style.setProperty(
      '--p',
      (Math.max(...vis) - 1) / (TOTAL - 1)
    )
    bar.style.setProperty('--p', (Math.max(...vis) - 1) / (TOTAL - 1))

    btnPrev.disabled = page <= 1
    btnHome.disabled = page <= 1
    btnNext.disabled = page >= TOTAL
  }

  /* ---------- 3. Navegación ---------- */
  function next () {
    if (page >= TOTAL) return
    page = isSingle() ? page + 1 : 2 * (Math.floor(page / 2) + 1)
    render()
  }

  function prev () {
    if (page <= 1) return
    if (isSingle()) {
      page -= 1
    } else {
      const k = Math.floor(page / 2) - 1
      page = k === 0 ? 1 : 2 * k
    }
    render()
  }

  function goTo (p) {
    page = clamp(p, 1, TOTAL)
    render()
  }

  btnNext.addEventListener('click', next)
  btnPrev.addEventListener('click', prev)
  btnHome.addEventListener('click', () => goTo(1))

  /* ---------- 4. Clic sobre el libro (y enlaces del índice) ---------- */
  let swallowClick = false

  book.addEventListener('click', e => {
    if (swallowClick) return

    const jump = e.target.closest('[data-goto]')
    if (jump) {
      goTo(Number(jump.dataset.goto))
      return
    }

    if (e.target.closest('a, button')) return
    if (String(window.getSelection()).length) return // el usuario está seleccionando texto

    const sec = e.target.closest('.page')
    if (!sec) return
    const n = Number(sec.dataset.page)

    if (n === 1) return next()
    if (n === TOTAL) return prev()

    if (isSingle()) {
      const r = sec.getBoundingClientRect()
      ;(e.clientX - r.left < r.width * 0.3 ? prev : next)()
    } else {
      ;(n % 2 === 0 ? prev : next)()
    }
  })

  /* ---------- 5. Gestos táctiles ---------- */
  let start = null

  book.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse') return
    start = { x: e.clientX, y: e.clientY, t: performance.now() }
  })

  window.addEventListener('pointerup', e => {
    if (!start) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    const dt = Math.max(1, performance.now() - start.t)
    start = null

    const horizontal = Math.abs(dx) > Math.abs(dy) * 1.4
    const enough =
      Math.abs(dx) > 42 || (Math.abs(dx) > 18 && Math.abs(dx) / dt > 0.35)
    if (!horizontal || !enough) return

    swallowClick = true
    setTimeout(() => {
      swallowClick = false
    }, 350)
    ;(dx < 0 ? next : prev)()
  })

  window.addEventListener('pointercancel', () => {
    start = null
  })

  /* ---------- 6. Teclado ---------- */
  document.addEventListener('keydown', e => {
    if (e.altKey || e.ctrlKey || e.metaKey) return
    if (e.target.closest('input, textarea, select')) return

    switch (e.key) {
      case 'ArrowRight':
      case 'PageDown':
        e.preventDefault()
        next()
        break
      case 'ArrowLeft':
      case 'PageUp':
        e.preventDefault()
        prev()
        break
      case 'Home':
        e.preventDefault()
        goTo(1)
        break
      case 'End':
        e.preventDefault()
        goTo(TOTAL)
        break
      case 'f':
      case 'F':
        toggleFullscreen()
        break
    }
  })

  /* ---------- 7. Pantalla completa ---------- */
  function toggleFullscreen () {
    if (!document.fullscreenEnabled) return
    if (document.fullscreenElement) document.exitFullscreen()
    else root.requestFullscreen().catch(() => {})
  }

  if (!document.fullscreenEnabled) btnFs.hidden = true
  btnFs.addEventListener('click', toggleFullscreen)
  document.addEventListener('fullscreenchange', () => {
    btnFs.setAttribute(
      'aria-pressed',
      String(Boolean(document.fullscreenElement))
    )
  })

  /* ---------- 8. Ajustar el tamaño del texto para que quepa ---------- */
  function fit () {
    sources.forEach(sec => {
      if (sec.classList.contains('cover')) return
      const sheet = sec.firstElementChild
      let f = 1
      sec.style.setProperty('--fit', f)
      while (sheet.scrollHeight - sheet.clientHeight > 1 && f > 0.78) {
        f = Math.round((f - 0.03) * 100) / 100
        sec.style.setProperty('--fit', f)
      }
    })
  }

  let fitTimer
  window.addEventListener('resize', () => {
    clearTimeout(fitTimer)
    fitTimer = setTimeout(fit, 120)
  })

  mqSingle.addEventListener('change', () => {
    render()
    fit()
  })
  mqReduce.addEventListener('change', render)

  /* ---------- 9. Letras que flotan en el cielo ---------- */
  ;(function paintSky () {
    const glyphs = 'AÁBCDEÉFGHIÍJLMNÑOÓPQRSTUÚVYZ«»¿?'.split('')
    for (let i = 0; i < 14; i++) {
      const s = document.createElement('span')
      s.className = 'ltr'
      s.textContent = glyphs[Math.floor(Math.random() * glyphs.length)]
      s.style.left = `${rand(2, 96)}%`
      s.style.top = `${rand(4, 90)}%`
      s.style.fontSize = `${rand(30, 100)}px`
      s.style.opacity = rand(0.5, 1).toFixed(2)
      s.style.setProperty('--t', `${rand(40, 85).toFixed(0)}s`)
      s.style.setProperty('--dx', `${rand(-70, 70).toFixed(0)}px`)
      s.style.setProperty('--r0', `${rand(-25, 25).toFixed(0)}deg`)
      s.style.setProperty('--r1', `${rand(-25, 25).toFixed(0)}deg`)
      s.style.animationDelay = `-${rand(0, 40).toFixed(1)}s`
      sky.append(s)
    }
  })()

  /* ---------- 10. Arranque: siempre se ve la portada ---------- */
  render()

  const fontsReady =
    document.fonts && document.fonts.ready
      ? Promise.race([
          document.fonts.ready,
          new Promise(r => setTimeout(r, 1500))
        ])
      : Promise.resolve()

  fontsReady.then(() => {
    fit()
    root.classList.add('ready')
  })
})()
