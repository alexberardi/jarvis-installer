// Keep the poster as a working YouTube link without JavaScript. No player or
// third-party thumbnail is fetched until someone chooses to watch.
(function () {
  var poster = document.querySelector("a.overview-poster");
  if (!poster) return;

  var button = document.createElement("button");
  button.type = "button";
  button.className = poster.className;
  button.setAttribute("aria-label", "Watch overview on YouTube (1 minute 43 seconds)");
  while (poster.firstChild) button.appendChild(poster.firstChild);
  poster.replaceWith(button);

  button.addEventListener("click", function () {
    var frame = document.createElement("iframe");
    frame.title = "Jarvis overview";
    frame.src = "https://www.youtube-nocookie.com/embed/u4mtwoVLTjs?autoplay=1&playsinline=1&rel=0";
    frame.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
    frame.allowFullscreen = true;
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    button.replaceWith(frame);
    frame.focus();
  });
})();
