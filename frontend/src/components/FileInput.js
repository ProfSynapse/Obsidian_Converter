import React from 'react';
import styled from 'styled-components';

const StyledFileInput = styled.input`
  display: none;
`;

const FileInput = ({ onChange, ...props }) => {
  return (
    <StyledFileInput
      type="file"
      onChange={onChange}
      {...props}
    />
  );
};

export default FileInput;