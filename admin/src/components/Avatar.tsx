import React from 'react';

interface AvatarProps {
  name: string;
  size?: number;
}

const COLORS = [
  '#f43f5e', '#ec4899', '#d946ef', '#a855f7', '#8b5cf6', 
  '#6366f1', '#3b82f6', '#0ea5e9', '#10b981', '#f59e0b'
];

export const Avatar = ({ name, size = 40 }: AvatarProps) => {
  const firstLetter = name.charAt(0).toUpperCase();
  
  // Hàm lấy màu cố định dựa trên chuỗi tên
  const getColor = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return COLORS[Math.abs(hash) % COLORS.length];
  };

  return (
    <div className="avatar-circle" style={{ 
      backgroundColor: getColor(name),
      width: size, height: size,
      borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 'bold', fontSize: size * 0.4
    }}>
      {firstLetter}
    </div>
  );
};