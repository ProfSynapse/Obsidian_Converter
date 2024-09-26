import React from 'react';
import styled from 'styled-components';

const StyledInput = styled.input`
  width: 100%;
  padding: 10px;
  margin: 5px 0;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 16px;

  &:focus {
    outline: none;
    border-color: #00A99D;
    box-shadow: 0 0 0 2px rgba(0, 169, 157, 0.2);
  }

  &::placeholder {
    color: #aaa;
  }
`;

const Input = ({ ...props }) => {
  return <StyledInput {...props} />;
};

export default Input;