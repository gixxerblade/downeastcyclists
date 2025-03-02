import { fetchLeaders } from '@/src/contentful/leaders';
import Image from 'next/image';
import Link from 'next/link';
import { Fragment } from 'react';

export default async function Leaders () {
  const data = await fetchLeaders();
  console.log(data);
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-4 md:p-24 gap-2">
      {data.map((leader) => (
        <Fragment key={leader.name}>
          <Link href={leader.link?.url || ''} target="_blank">
            <div className="flex-col justify-center items-center">
              <Image src={leader.image?.src || ''} height={300} width={300} alt={`Image of ${leader.name}`} />
              <p className="text-center">{leader.name}</p>
            </div>
          </Link>
        </Fragment>
      ))}
    </main>
  );
}
