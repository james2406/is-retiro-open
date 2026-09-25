// Reports the banner's height and the × click to the page that embeds this iframe
// (src/components/SuruAd.tsx), which sizes the iframe and hides the ad.
(function () {
  function send(message) {
    window.parent.postMessage(message, window.location.origin);
  }

  new ResizeObserver(function () {
    send({ type: "suru-ad:height", height: document.body.offsetHeight });
  }).observe(document.body);

  document.querySelector(".suru-ad__close").addEventListener("click", function () {
    send({ type: "suru-ad:close" });
  });
})();
