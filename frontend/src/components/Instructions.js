// src/components/Instructions.js
import React from 'react';
import styled from 'styled-components';

const InstructionsContainer = styled.div`
  width: 100%;
  margin-bottom: 1rem;
`;

const InstructionsButton = styled.button`
  width: 100%;
  background-color: #f5f5f5;
  border: 2px solid #00A99D;
  border-radius: 5px;
  padding: 1rem 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  transition: background-color 0.3s ease, font-size 0.3s ease;
  font-size: 1.2rem;
  font-weight: bold;
  
  &:hover {
    background-color: #e0f7fa;
  }

  &:focus {
    outline: none;
    box-shadow: 0 0 0 3px rgba(0, 169, 157, 0.5);
  }
`;

const InstructionsContent = styled.div`
  margin-top: 0.5rem;
  background-color: #e0f7fa;
  border: 1px solid #00A99D;
  border-radius: 5px;
  padding: 1rem 1.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transition: max-height 0.3s ease, opacity 0.3s ease;
  max-height: ${props => (props.isOpen ? '500px' : '0')};
  opacity: ${props => (props.isOpen ? '1' : '0')};
  overflow: hidden;
`;

const InstructionsList = styled.ol`
  padding-left: 1.5rem;
  margin: 0;
  color: #333;
  line-height: 1.6;
  text-align: left;
`;

const Instructions = ({ isOpen, toggleOpen }) => (
  <InstructionsContainer>
    <InstructionsButton
      onClick={toggleOpen}
      aria-expanded={isOpen}
      aria-controls="instructions-content"
    >
      <span>Instructions</span>
      <span>{isOpen ? '➖' : '➕'}</span>
    </InstructionsButton>
    <InstructionsContent id="instructions-content" isOpen={isOpen}>
      <InstructionsList>
        <li>Enter your OpenAI API key.</li>
        <li>Drag and drop files or click to upload.</li>
        <li>Add URLs if needed.</li>
        <li>Select the output format.</li>
        <li>Click 'Convert' and wait for processing.</li>
        <li>Download the converted files as a .zip.</li>
      </InstructionsList>
    </InstructionsContent>
  </InstructionsContainer>
);

export default React.memo(Instructions);
