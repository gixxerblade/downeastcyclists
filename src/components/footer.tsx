'use client';

import {Facebook, Instagram} from '@mui/icons-material';
import Link from 'next/link';

const friends = [
  {title: 'Bicycle Gallery', link: 'https://www.bicycle-gallery.com/'},
  {title: 'The Bicycle Shop', link: 'https://www.thebicycle.com'},
  {title: 'Cape Fear Cyclists', link: 'https://www.capefearcyclists.org/'},
  {title: 'Cape Fear SORBA', link: 'https://capefearsorba.org/'},
  {title: 'Strava club', link: 'https://www.strava.com/clubs/4097'},
];

function Wordmark() {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-11 w-11 -skew-x-6 place-items-center bg-[#F20E02] font-[Anton] text-xl text-white">
        <span className="skew-x-6">DEC</span>
      </div>
      <div className="font-[Anton] text-[15px] leading-none tracking-[.05em]">
        DOWN EAST
        <br />
        <span className="text-[var(--dec-muted-2)]">CYCLISTS</span>
      </div>
    </div>
  );
}

export default function Footer() {
  return (
    <footer className="border-t border-[var(--dec-border)] bg-[var(--dec-surface)] text-[var(--dec-ink)]">
      <div className="dec-container grid gap-10 py-14 md:grid-cols-[1.35fr_1fr_1fr]">
        <div>
          <Wordmark />
          <p className="mt-4 max-w-sm text-sm leading-6 text-[var(--dec-muted-2)]">
            Promoting safe, social cycling across Eastern North Carolina since 2009.
          </p>
          <div className="mt-6 flex gap-3">
            <a
              aria-label="Down East Cyclists Facebook"
              href="https://www.facebook.com/downeastcyclists"
              target="_blank"
              rel="noreferrer noopener"
              className="grid h-11 w-11 place-items-center rounded-full border border-[var(--dec-border)]"
            >
              <Facebook fontSize="small" />
            </a>
            <a
              aria-label="Down East Cyclists Instagram"
              href="https://www.instagram.com/downeastcyclists/"
              target="_blank"
              rel="noreferrer noopener"
              className="grid h-11 w-11 place-items-center rounded-full border border-[var(--dec-border)]"
            >
              <Instagram fontSize="small" />
            </a>
          </div>
        </div>

        <div>
          <h2 className="mb-4 text-xs font-bold tracking-[.08em] text-[var(--dec-muted-2)]">
            CLUB
          </h2>
          <div className="flex flex-col gap-3 text-sm font-medium">
            <a href="https://www.meetup.com/down-east-cyclists/events/calendar/" target="_blank" rel="noreferrer noopener">
              Rides & events ↗
            </a>
            <Link href="/trails/b3">Trails</Link>
            <Link href="/blog">Blog</Link>
            <Link href="/about/leadership">Leadership</Link>
          </div>
        </div>

        <div>
          <h2 className="mb-4 text-xs font-bold tracking-[.08em] text-[var(--dec-muted-2)]">
            FRIENDS OF THE CLUB
          </h2>
          <div className="flex flex-col gap-3 text-sm font-medium">
            {friends.map((friend) => (
              <a key={friend.title} href={friend.link} target="_blank" rel="noreferrer noopener">
                {friend.title} ↗
              </a>
            ))}
          </div>
        </div>
      </div>
      <div className="border-t border-[var(--dec-border)] py-5 text-center text-xs text-[var(--dec-muted-2)]">
        &copy; {new Date().getFullYear()} Down East Cyclists
      </div>
    </footer>
  );
}
