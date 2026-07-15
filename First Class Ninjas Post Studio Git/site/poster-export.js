// FCN poster → PNG exporter.
// Renders a 1080×1350 poster node to a real canvas (no SVG/foreignObject, so no
// size cap) by reading the live DOM: background photo from the <image-slot>,
// element backgrounds / gradients / borders, <img> logos, and every text node
// drawn glyph-by-glyph at its measured position (matches wrapping, alignment,
// letter-spacing exactly). Exposed as window.fcnExportPoster(posterId, name).
(function () {
  function parseColor(c) {
    if (!c) return null;
    if (c === 'transparent' || c === 'rgba(0, 0, 0, 0)') return null;
    return c;
  }

  function effOpacity(el, stop) {
    var o = 1, e = el;
    while (e && e !== stop) {
      var v = parseFloat(getComputedStyle(e).opacity);
      if (!isNaN(v)) o *= v;
      e = e.parentElement;
    }
    return o;
  }

  function parseLinearGradient(str, x, y, w, h, ctx) {
    var m = str.match(/linear-gradient\((.*)\)$/i);
    if (!m) return null;
    var body = m[1];
    // split top-level by commas (color stops have commas inside rgba()).
    var parts = [], depth = 0, cur = '';
    for (var i = 0; i < body.length; i++) {
      var ch = body[i];
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; }
      else cur += ch;
    }
    if (cur) parts.push(cur);
    var angle = 180;
    if (/deg/.test(parts[0])) { angle = parseFloat(parts[0]); parts.shift(); }
    else if (/to\s/.test(parts[0])) {
      var d = parts[0];
      if (/top/.test(d)) angle = 0;
      else if (/bottom/.test(d)) angle = 180;
      else if (/left/.test(d)) angle = 270;
      else if (/right/.test(d)) angle = 90;
      parts.shift();
    }
    var rad = angle * Math.PI / 180;
    var dx = Math.sin(rad), dy = -Math.cos(rad);
    var halfLen = (Math.abs(w * dx) + Math.abs(h * dy)) / 2;
    var cx = x + w / 2, cy = y + h / 2;
    var grad = ctx.createLinearGradient(cx - dx * halfLen, cy - dy * halfLen, cx + dx * halfLen, cy + dy * halfLen);
    var stops = [];
    for (var j = 0; j < parts.length; j++) {
      var sm = parts[j].trim().match(/(rgba?\([^)]+\)|#[0-9a-fA-F]+|[a-z]+)\s*([0-9.]+)%?/i);
      if (!sm) continue;
      var pct = sm[2] !== undefined ? parseFloat(sm[2]) / 100 : (j / (parts.length - 1));
      stops.push([Math.max(0, Math.min(1, pct)), sm[1]]);
    }
    if (!stops.length) return null;
    stops.forEach(function (s) { try { grad.addColorStop(s[0], s[1]); } catch (e) {} });
    return grad;
  }

  function drawBorders(ctx, cs, x, y, w, h, op) {
    var sides = [
      ['borderTopWidth', 'borderTopColor', 'borderTopStyle', x, y, w, null],
      ['borderBottomWidth', 'borderBottomColor', 'borderBottomStyle', x, null, w, null],
      ['borderLeftWidth', 'borderLeftColor', 'borderLeftStyle', x, y, null, h],
      ['borderRightWidth', 'borderRightColor', 'borderRightStyle', null, y, null, h]
    ];
    ['Top', 'Bottom', 'Left', 'Right'].forEach(function (side) {
      var bw = parseFloat(cs['border' + side + 'Width']);
      var col = parseColor(cs['border' + side + 'Color']);
      if (!(bw > 0) || !col || cs['border' + side + 'Style'] === 'none') return;
      ctx.globalAlpha = op; ctx.fillStyle = col;
      if (side === 'Top') ctx.fillRect(x, y, w, bw);
      else if (side === 'Bottom') ctx.fillRect(x, y + h - bw, w, bw);
      else if (side === 'Left') ctx.fillRect(x, y, bw, h);
      else ctx.fillRect(x + w - bw, y, bw, h);
      ctx.globalAlpha = 1;
    });
  }

  async function render(posterId) {
    var node = document.getElementById(posterId);
    if (!node) return null;
    var prev = node.style.transform;
    node.style.transform = 'none';
    try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch (e) {}
    await new Promise(function (r) { setTimeout(r, 30); });

    var rect = node.getBoundingClientRect();
    var ox = rect.left, oy = rect.top, W = 1080, H = 1350;
    var canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0C1F35'; ctx.fillRect(0, 0, W, H);

    // 1) background photo from the image-slot's shadow <img>
    var slot = node.querySelector('image-slot');
    if (slot && slot.shadowRoot) {
      var fimg = slot.shadowRoot.querySelector('.frame img');
      if (fimg && fimg.getAttribute('src') && getComputedStyle(fimg).display !== 'none') {
        var ir = fimg.getBoundingClientRect();
        ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
        try { ctx.drawImage(fimg, ir.left - ox, ir.top - oy, ir.width, ir.height); } catch (e) {}
        ctx.restore();
      }
    }

    // 2) element backgrounds, gradients, borders, images (skip image-slot subtree)
    (function walk(el) {
      for (var k = 0; k < el.children.length; k++) {
        var child = el.children[k];
        var tag = child.tagName.toLowerCase();
        if (tag === 'image-slot') continue;
        var cs = getComputedStyle(child);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        var r = child.getBoundingClientRect();
        var x = r.left - ox, y = r.top - oy, w = r.width, h = r.height;
        var op = effOpacity(child, node.parentElement);
        var bg = parseColor(cs.backgroundColor);
        if (bg) { ctx.globalAlpha = op; ctx.fillStyle = bg; ctx.fillRect(x, y, w, h); ctx.globalAlpha = 1; }
        if (cs.backgroundImage && cs.backgroundImage.indexOf('linear-gradient') === 0) {
          var g = parseLinearGradient(cs.backgroundImage, x, y, w, h, ctx);
          if (g) { ctx.globalAlpha = op; ctx.fillStyle = g; ctx.fillRect(x, y, w, h); ctx.globalAlpha = 1; }
        }
        drawBorders(ctx, cs, x, y, w, h, op);
        if (tag === 'img' && child.getAttribute('src')) {
          var fit = cs.objectFit;
          var iw = child.naturalWidth, ih = child.naturalHeight;
          ctx.globalAlpha = op;
          try {
            if ((fit === 'cover' || fit === 'contain') && iw && ih) {
              var sc = fit === 'cover' ? Math.max(w / iw, h / ih) : Math.min(w / iw, h / ih);
              var dw = iw * sc, dh = ih * sc, dx = x + (w - dw) / 2, dy = y + (h - dh) / 2;
              ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
              ctx.drawImage(child, dx, dy, dw, dh);
              ctx.restore();
            } else {
              ctx.drawImage(child, x, y, w, h);
            }
          } catch (e) {}
          ctx.globalAlpha = 1;
        }
        walk(child);
      }
    })(node);

    // 3) text — glyph by glyph at measured positions
    ctx.textBaseline = 'top';
    var walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null);
    var tn;
    var range = document.createRange();
    while ((tn = walker.nextNode())) {
      var txt = tn.nodeValue;
      if (!txt || !txt.trim()) continue;
      var parent = tn.parentElement;
      if (!parent) continue;
      var cs2 = getComputedStyle(parent);
      var fs = parseFloat(cs2.fontSize);
      ctx.font = (cs2.fontStyle === 'italic' ? 'italic ' : '') + cs2.fontWeight + ' ' + cs2.fontSize + ' ' + cs2.fontFamily;
      ctx.fillStyle = cs2.color;
      var op2 = effOpacity(parent, node.parentElement);
      var upper = cs2.textTransform === 'uppercase';
      for (var i = 0; i < txt.length; i++) {
        var c = txt[i];
        if (!c.trim()) continue;
        range.setStart(tn, i); range.setEnd(tn, i + 1);
        var rs = range.getClientRects();
        if (!rs.length) continue;
        var rr = rs[0];
        ctx.globalAlpha = op2;
        ctx.fillText(upper ? c.toUpperCase() : c, rr.left - ox, rr.top - oy + (rr.height - fs) / 2);
        ctx.globalAlpha = 1;
      }
    }

    node.style.transform = prev;
    return canvas;
  }

  window.fcnExportPoster = async function (posterId, name) {
    try {
      var canvas = await render(posterId);
      if (!canvas) return;
      // Auto-save a copy to the FCN ops-board "recent posters" gallery
      // (fire-and-forget; never blocks or fails the download).
      try {
        var dataUrl = canvas.toDataURL('image/png');
        fetch('/api/save-poster', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ image: dataUrl, caption: name || '', type: 'Poster' })
        }).catch(function () {});
      } catch (e) {}
      canvas.toBlob(function (blob) {
        if (!blob) return;
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = (name || 'fcn-post') + '.png';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      }, 'image/png');
    } catch (e) {
      console.warn('fcnExportPoster failed', e);
      alert('PNG export failed — see console.');
    }
  };
})();
