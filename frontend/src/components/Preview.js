// src/components/Preview.js
import React from 'react';
import styled from 'styled-components';
import { FaFileAlt, FaLink } from 'react-icons/fa';

const ImagePreview = styled.img`
  width: 50px;
  height: 50px;
  object-fit: cover;
  border-radius: 4px;
  margin-right: 0.5rem;
`;

const FileIcon = styled.div`
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f0f0f0;
  border-radius: 4px;
  margin-right: 0.5rem;
  font-size: 1.2rem;
  color: #555;
`;

const PreviewWrapper = styled.div`
  display: flex;
  align-items: center;
`;

const Preview = ({ item }) => {
  if (item.type === 'file') {
    const isImage = item.content.type.startsWith('image/');
    return isImage ? (
      <ImagePreview src={URL.createObjectURL(item.content)} alt={item.content.name} />
    ) : (
      <FileIcon>
        <FaFileAlt />
      </FileIcon>
    );
  }
  return (
    <FileIcon>
      <FaLink />
    </FileIcon>
  );
};

export default React.memo(Preview);
