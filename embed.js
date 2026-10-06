/* ===================================================================
   Embed loader for the Maine High School Sports page.

   On the host page (e.g. a WordPress Custom HTML block):

     <div data-bdn-sports-embed></div>
     <script src="https://dsmacleod.github.io/bdn-sports-page/embed.js" async></script>

   Optional on the div: data-stories="1" to keep Latest Stories (dropped by
   default, since the host page is already the story list).

   Puts an iframe of index.html?embed=1 (from the same directory as this
   script) in each placeholder, then sizes it to its content and handles
   scroll requests from it. Plain ES5, no dependencies: it runs on the host
   page, so it must not touch anything outside its own placeholders.
   =================================================================== */
(function () {
  var script = document.currentScript;
  var base = script ? script.src.replace(/[^/]*$/, '') : '';
  var frames = [];

  function mount(el) {
    if (el.getAttribute('data-bdn-sports-mounted')) return;
    el.setAttribute('data-bdn-sports-mounted', '1');
    var src = base + 'index.html?embed=1' + (el.getAttribute('data-stories') === '1' ? '&stories=1' : '');
    var iframe = document.createElement('iframe');
    iframe.src = src;
    iframe.title = 'Maine high school sports scores and schedules';
    iframe.loading = 'lazy';
    iframe.setAttribute('scrolling', 'no');
    // Until the page reports its real height.
    iframe.style.cssText = 'display:block;width:100%;border:0;height:900px;overflow:hidden;';
    el.appendChild(iframe);
    frames.push(iframe);
  }

  function frameFor(win) {
    for (var i = 0; i < frames.length; i++) {
      if (frames[i].contentWindow === win) return frames[i];
    }
    return null;
  }

  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!d || d.source !== 'bdn-sports') return;
    var iframe = frameFor(e.source);
    if (!iframe) return;
    if (d.type === 'height' && typeof d.height === 'number' && d.height > 0) {
      iframe.style.height = Math.ceil(d.height) + 'px';
    } else if (d.type === 'scroll' && typeof d.top === 'number') {
      var top = iframe.getBoundingClientRect().top + window.pageYOffset + d.top;
      // Leave room for a sticky site header.
      window.scrollTo({ top: Math.max(0, top - 80), behavior: 'smooth' });
    }
  });

  function mountAll() {
    var els = document.querySelectorAll('[data-bdn-sports-embed]');
    for (var i = 0; i < els.length; i++) mount(els[i]);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountAll);
  else mountAll();
})();
