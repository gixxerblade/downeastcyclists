import { fetchLeaders } from '@/src/contentful/leaders';
import Image from 'next/image';
import Link from 'next/link';
import { Fragment } from 'react';

import { Container, Typography } from '@mui/material';

export default async function Leaders () {
  const data = await fetchLeaders();

  return (
    <Container maxWidth="md" sx={{ paddingTop: 8, paddingBottom: 8 }}>
      <Typography variant="h3" component="h1" gutterBottom align="center">
        Leadership
      </Typography>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {data.map((leader) => (
          <Fragment key={leader.name}>
            <Link href={leader.link?.url || ''} target="_blank">
              <div className="flex flex-col items-center justify-center">
                <Image 
                  src={leader.image?.src || ''} 
                  height={300} 
                  width={300} 
                  alt={`Image of ${leader.name}`}
                  className="rounded-md"
                />
                <p className="text-center mt-2 font-semibold">{leader.name}</p>
              </div>
            </Link>
          </Fragment>
        ))}
      </div>
    </Container>
  );
}
