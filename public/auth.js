(function () {
  const form = document.getElementById("authForm");
  const tabs = document.querySelectorAll(".auth-tab");
  const submitBtn = document.getElementById("authSubmit");
  const titleEl = document.getElementById("authTitle");
  const errorEl = document.getElementById("authError");
  const passwordInput = document.getElementById("password");
  let mode = "login";

  // Already logged in? Skip straight to the app.
  fetch("../api/auth.php?action=me", { credentials: "include" })
    .then((r) => r.json())
    .then((d) => { if (d.loggedIn) window.location.href = "app.html"; })
    .catch(() => {});

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      mode = tab.dataset.mode;
      submitBtn.textContent = mode === "login" ? "Log in" : "Create account";
      titleEl.textContent = mode === "login" ? "Welcome back" : "Create your account";
      passwordInput.autocomplete = mode === "login" ? "current-password" : "new-password";
      errorEl.textContent = "";
    });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.textContent = "";
    submitBtn.disabled = true;

    const username = document.getElementById("username").value.trim();
    const password = passwordInput.value;

    try {
      const res = await fetch("../api/auth.php", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: mode, username, password }),
      });
      const data = await res.json();
      if (data.ok) {
        window.location.href = "app.html";
      } else {
        errorEl.textContent = data.error || "Something went wrong.";
      }
    } catch (err) {
      errorEl.textContent = "Could not reach the server. Is it running?";
    } finally {
      submitBtn.disabled = false;
    }
  });
})();