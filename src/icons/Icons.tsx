import React, { ReactNode } from 'react';
import { IconProps } from '../types/iconprops';

interface IconsProps extends IconProps {
  children: ReactNode;
  className?: string;
}

const Icons = ({ children, className }: IconsProps) => {
  return <div className={className}>{children}</div>;
};

export default Icons;
