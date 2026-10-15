// Copy buttons: <button data-copy="ID"> copies the text of the element with that id.
(function () {
  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "absolute";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  function flash(button, label) {
    button.textContent = label;
    setTimeout(function () { button.textContent = "Copy"; }, 1500);
  }

  document.querySelectorAll("button[data-copy]").forEach(function (button) {
    button.addEventListener("click", function () {
      var source = document.getElementById(button.getAttribute("data-copy"));
      if (!source) return;
      var text = source.textContent.trim();
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(
          function () { flash(button, "Copied"); },
          function () { flash(button, fallbackCopy(text) ? "Copied" : "Select and copy"); }
        );
      } else {
        flash(button, fallbackCopy(text) ? "Copied" : "Select and copy");
      }
    });
  });
})();
