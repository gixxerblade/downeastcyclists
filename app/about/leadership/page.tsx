import { Leader, fetchLeaders } from '@/src/contentful/leaders';
import { Fragment } from 'react';

const sortByOrder = (a: Leader, b: Leader) => {
  if (a.order === undefined && b.order === undefined) {
    return 0;
  } else if (a.order === undefined) {
    return 1;
  } else if (b.order === undefined) {
    return -1;
  }
  return a.order - b.order;
};

export default async function Leaders () {
  const data = await fetchLeaders();
  console.log(data);
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      {data.sort(sortByOrder).map((leader) => (
        <Fragment key={leader.name}>
          <p>{leader.name}</p>
        </Fragment>
      ))}
    </main>
  );
}