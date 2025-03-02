'use client';

import React from 'react';
import Image from 'next/image';

const NotFound = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] px-4 py-8">
      <h1 className="text-4xl font-bold text-center mb-2">
        Whoops! Trail Not Found
      </h1>
      
      <h2 className="text-xl text-center mb-8">
        Looks like you&apos;ve pedaled off the beaten path!
      </h2>
      
      <div className="relative w-[400px] h-[300px] mb-8 animate-bounce-slow">
        <style jsx global>{`
          @keyframes bounce-slow {
            0%, 100% {
              transform: translateY(0);
            }
            50% {
              transform: translateY(-10px);
            }
          }
          
          .animate-bounce-slow {
            animation: bounce-slow 2s infinite ease-in-out;
          }
        `}</style>
        <div className="relative flex justify-center items-center w-full h-full">
          <div className="relative w-full h-full">
            <Image
              src="/bicycle.svg"
              alt="Bicycle"
              fill
              priority
              style={{ objectFit: 'contain' }}
            />
          </div>
        </div>
      </div>
      
      <p className="text-center mb-2">
        Even the best cyclists take a wrong turn sometimes.
      </p>
      
      <p className="text-center">
        Head back to the <a href="/" className="text-blue-600 hover:text-blue-800 no-underline">trailhead</a> and start over.
      </p>
    </div>
  );
};

export default NotFound;
