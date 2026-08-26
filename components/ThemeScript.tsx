export default function ThemeScript() {
  const script = `
    (function () {
      try {
        var root = document.documentElement;
        root.classList.remove("light", "dark");
        // Light mode is temporarily disabled.
        // var theme = localStorage.getItem("tower-theme");
        // root.classList.add(theme === "light" ? "light" : "dark");
        // root.style.colorScheme = theme === "light" ? "light" : "dark";
        root.classList.add("dark");
        root.style.colorScheme = "dark";
      } catch (e) {
        document.documentElement.classList.add("dark");
      }
    })();
  `;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
