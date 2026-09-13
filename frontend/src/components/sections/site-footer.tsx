export function SiteFooter() {
  return (
    <footer className="w-full bg-white dark:bg-neutral-950 border-t border-black/10 dark:border-white/10 py-8 px-4 md:px-6">
      <div className="container mx-auto max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-neutral-500 dark:text-neutral-500">
        <p>© {new Date().getFullYear()} Lanchat. All rights reserved.</p>
        <div className="flex gap-6">
          <a href="/privacy" className="hover:text-black dark:hover:text-white transition-colors">Privacy Policy</a>
          <a href="/terms" className="hover:text-black dark:hover:text-white transition-colors">Terms of Service</a>
          <a href="/contact" className="hover:text-black dark:hover:text-white transition-colors">Contact</a>
        </div>
      </div>
    </footer>
  );
}
