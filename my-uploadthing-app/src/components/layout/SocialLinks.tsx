"use client";

type Props = {
  className?: string;
  size?: number;
  instagram?: string;
  facebook?: string;
  whatsapp?: string; // usa formato wa.me si quieres abrir chat directo
};

const IconInstagram = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="3.5" />
    <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" />
  </svg>
);

const IconFacebook = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}>
    <path d="M13 21v-8h3l.5-3H13V8.2c0-.9.3-1.2 1.4-1.2H16V4.2C15.6 4.1 14.6 4 13.6 4 11.4 4 10 5.2 10 7.7V10H7v3h3v8h3Z" />
  </svg>
);

const IconWhatsapp = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...p}>
    <path d="M20 11.5A8.5 8.5 0 0 1 7.4 19L4 20l1.1-3.2A8.5 8.5 0 1 1 20 11.5Z"/>
    <path d="M8.8 8.9c-.2.6-.2 1.3.2 2 .6 1.1 1.9 2.5 3.4 3.3.7.4 1.4.5 2 .3l1.2-.6c.2-.1.4-.2.5-.4.1-.2 0-.4-.1-.6l-1-1c-.2-.2-.4-.2-.6-.2l-.6.2c-.2 0-.4 0-.6-.1-.7-.3-1.6-1.1-2-1.8-.1-.2-.1-.4-.1-.6l.2-.6c0-.2 0-.4-.2-.6l-1-1c-.2-.2-.4-.3-.6-.2-.2 0-.4.2-.5.4l-.6 1.1Z"/>
  </svg>
);

export default function SocialLinks({
  className,
  size = 18,
  instagram = "#",
  facebook = "#",
  whatsapp = "#",
}: Props) {
  const btn = "inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-700 text-zinc-300 hover:bg-zinc-800/80 hover:text-white";
  return (
    <div className={`flex items-center gap-3 ${className || ""}`}>
      <a href={instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className={btn}>
        <IconInstagram width={size} height={size} />
      </a>
      <a href={facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className={btn}>
        <IconFacebook width={size} height={size} />
      </a>
      <a href={whatsapp} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className={btn}>
        <IconWhatsapp width={size} height={size} />
      </a>
    </div>
  );
}
