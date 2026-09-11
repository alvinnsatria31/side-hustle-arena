export const WHATSAPP_SUPPORT_URL = 'https://wa.me/6285117304579?text=Halo%20Admin%20Sekolah%20Karir,%20saya%20butuh%20bantuan%20terkait%20Side%20Hustle%20Arena';

export function FloatingWhatsApp() {
  return (
    <a
      href={WHATSAPP_SUPPORT_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Butuh bantuan? Chat kami di WhatsApp"
      className="group fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-sk-lg transition duration-200 hover:-translate-y-1 hover:shadow-xl focus-visible:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#25D366] motion-reduce:transform-none motion-reduce:transition-none"
    >
      <span role="tooltip" className="pointer-events-none absolute right-0 bottom-full mb-3 w-max max-w-[calc(100vw-3rem)] rounded-md bg-sk-navy px-3 py-2 text-xs font-semibold text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none">
        Butuh bantuan? Chat kami di WhatsApp
      </span>
      <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true" fill="currentColor">
        <path d="M16.04 3C8.86 3 3.02 8.78 3.02 15.9c0 2.27.6 4.48 1.74 6.42L3 28.73l6.61-1.73a13.1 13.1 0 0 0 6.42 1.63h.01c7.18 0 13.02-5.78 13.02-12.9C29.06 8.78 23.22 3 16.04 3Zm0 23.45h-.01a10.9 10.9 0 0 1-5.55-1.5l-.4-.23-3.92 1.03 1.05-3.81-.26-.4a10.65 10.65 0 0 1-1.7-5.64c0-5.92 4.84-10.72 10.8-10.72 5.95 0 10.79 4.8 10.79 10.72 0 5.91-4.85 10.55-10.8 10.55Zm5.92-7.91c-.32-.16-1.92-.94-2.22-1.05-.3-.1-.51-.16-.73.16-.21.32-.83 1.05-1.02 1.26-.19.21-.38.24-.7.08-.33-.16-1.37-.5-2.61-1.6a9.72 9.72 0 0 1-1.8-2.22c-.2-.32-.02-.5.14-.66.15-.14.33-.37.49-.56.16-.18.21-.31.32-.52.11-.21.05-.4-.03-.56-.08-.16-.73-1.74-1-2.38-.26-.63-.53-.54-.73-.55h-.62c-.22 0-.57.08-.87.4-.3.31-1.13 1.1-1.13 2.69s1.16 3.12 1.32 3.33c.16.21 2.28 3.45 5.52 4.84.77.33 1.37.53 1.84.68.77.24 1.48.21 2.03.13.62-.09 1.92-.78 2.2-1.53.26-.76.26-1.42.18-1.55-.08-.13-.3-.21-.62-.37Z" />
      </svg>
    </a>
  );
}
